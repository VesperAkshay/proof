import { eq, and, lt } from "drizzle-orm";
import crypto from "crypto";
import { db } from "@/db/client";
import { assets, uploadSessions, type Asset } from "@/db/schema";
import {
  validateFilenameAndMime,
  validateUploadedBytes,
  MAX_FILE_SIZE_BYTES,
  type MalwareScanner,
  DefaultMalwareScanner,
} from "@/lib/storage/validation";
import { defaultStorageService, type StorageService } from "@/lib/storage/r2";

export class AssetError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = "AssetError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface CreateUploadSessionInput {
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface SingleUploadDescriptor {
  type: "single";
  url: string;
  expiresInSeconds: number;
}

export interface MultipartUploadDescriptor {
  type: "multipart";
  uploadId: string;
  parts: Array<{
    partNumber: number;
    url: string;
  }>;
}

export interface CreateUploadSessionResult {
  sessionId: string;
  assetId: string;
  upload: SingleUploadDescriptor | MultipartUploadDescriptor;
}

export interface AssetDTO {
  id: string;
  ownerId: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  detectedMimeType: string | null;
  sizeBytes: number;
  sha256: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapAssetToDTO(asset: Asset): AssetDTO {
  return {
    id: asset.id,
    ownerId: asset.ownerId,
    objectKey: asset.objectKey,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    detectedMimeType: asset.detectedMimeType,
    sizeBytes: asset.sizeBytes,
    sha256: asset.sha256,
    status: asset.status,
    rejectionReason: asset.rejectionReason,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB
const MULTIPART_CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per part

/**
 * Initializes a direct upload session with presigned R2 URLs.
 * App servers never proxy bytes directly.
 */
export async function createUploadSession(
  userId: string,
  input: CreateUploadSessionInput,
  storage: StorageService = defaultStorageService
): Promise<CreateUploadSessionResult> {
  const { filename, sizeBytes, mimeType } = input;

  // 1. Validate filename, path traversal, extension, and declared MIME type
  const filenameCheck = validateFilenameAndMime(filename, mimeType);
  if (!filenameCheck.isValid) {
    throw new AssetError("INVALID_FILE_METADATA", 400, filenameCheck.error || "Invalid file metadata");
  }

  // 2. Validate size bounds
  if (sizeBytes <= 0) {
    throw new AssetError("INVALID_FILE_SIZE", 400, "File size must be strictly positive");
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new AssetError(
      "FILE_OVERSIZED",
      413,
      `File exceeds maximum limit of 10 MB (${sizeBytes} bytes)`
    );
  }

  // 3. Generate quarantine object key (server-generated, safe filename, quarantine prefix)
  const safeBase = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const assetUuid = crypto.randomUUID();
  const quarantineKey = `quarantine/${assetUuid}-${safeBase}`;

  // 4. Create Asset in PENDING_UPLOAD status
  const [newAsset] = await db
    .insert(assets)
    .values({
      ownerId: userId,
      objectKey: quarantineKey,
      originalFilename: filename,
      mimeType,
      sizeBytes,
      status: "PENDING_UPLOAD",
    })
    .returning();

  if (!newAsset) {
    throw new AssetError("INTERNAL_ERROR", 500, "Failed to create asset record");
  }

  const isMultipart = sizeBytes > MULTIPART_THRESHOLD_BYTES;

  if (!isMultipart) {
    // Single upload via presigned PUT URL (5 minutes expiry)
    const presignedUrl = await storage.createPresignedUploadUrl(quarantineKey, mimeType, 300);

    const [session] = await db
      .insert(uploadSessions)
      .values({
        ownerId: userId,
        assetId: newAsset.id,
        status: "PENDING",
        expectedSize: sizeBytes,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min session
      })
      .returning();

    if (!session) {
      throw new AssetError("INTERNAL_ERROR", 500, "Failed to create upload session");
    }

    return {
      sessionId: session.id,
      assetId: newAsset.id,
      upload: {
        type: "single",
        url: presignedUrl,
        expiresInSeconds: 300,
      },
    };
  } else {
    // Multipart upload
    const uploadId = await storage.createMultipartUpload(quarantineKey, mimeType);
    const numParts = Math.ceil(sizeBytes / MULTIPART_CHUNK_SIZE_BYTES);
    const parts: Array<{ partNumber: number; url: string }> = [];

    for (let partNumber = 1; partNumber <= numParts; partNumber++) {
      const partUrl = await storage.createPresignedPartUrl(quarantineKey, uploadId, partNumber, 1800);
      parts.push({ partNumber, url: partUrl });
    }

    const [session] = await db
      .insert(uploadSessions)
      .values({
        ownerId: userId,
        assetId: newAsset.id,
        status: "PENDING",
        expectedSize: sizeBytes,
        multipartUploadId: uploadId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 60 min session for large upload
      })
      .returning();

    if (!session) {
      throw new AssetError("INTERNAL_ERROR", 500, "Failed to create upload session");
    }

    return {
      sessionId: session.id,
      assetId: newAsset.id,
      upload: {
        type: "multipart",
        uploadId,
        parts,
      },
    };
  }
}

/**
 * Completes an upload session, fetching the quarantined object and executing
 * magic bytes verification, PDF structural analysis, malware scanning, and sha256 checksumming.
 */
export async function completeUploadSession(
  sessionId: string,
  userId: string,
  parts?: Array<{ partNumber: number; etag: string }>,
  storage: StorageService = defaultStorageService,
  scanner: MalwareScanner = new DefaultMalwareScanner()
): Promise<AssetDTO> {
  // 1. Fetch and validate session ownership
  const [session] = await db
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.ownerId, userId)))
    .limit(1);

  if (!session) {
    throw new AssetError("NOT_FOUND", 404, "Upload session not found");
  }

  if (session.status !== "PENDING") {
    throw new AssetError(
      "INVALID_SESSION_STATE",
      400,
      `Cannot complete session with status '${session.status}'`
    );
  }

  // 2. Fetch associated asset
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, session.assetId))
    .limit(1);

  if (!asset) {
    throw new AssetError("NOT_FOUND", 404, "Associated asset record not found");
  }

  // 3. Check expiration
  if (new Date() > session.expiresAt) {
    await db
      .update(uploadSessions)
      .set({ status: "EXPIRED" })
      .where(eq(uploadSessions.id, session.id));

    await db
      .update(assets)
      .set({ status: "REJECTED", rejectionReason: "Upload session expired" })
      .where(eq(assets.id, asset.id));

    await storage.deleteObject(asset.objectKey).catch(() => {});
    throw new AssetError("SESSION_EXPIRED", 400, "Upload session has expired");
  }

  // 4. If multipart, complete the multipart upload in storage
  if (session.multipartUploadId) {
    if (!parts || parts.length === 0) {
      throw new AssetError("MISSING_PARTS", 400, "Multipart completion requires parts array");
    }
    await storage.completeMultipartUpload(asset.objectKey, session.multipartUploadId, parts);
  }

  // 5. Transition to QUARANTINED
  await db.update(assets).set({ status: "QUARANTINED" }).where(eq(assets.id, asset.id));

  // 6. Fetch bytes from storage quarantine for server-side verification
  let buffer: Buffer;
  try {
    buffer = await storage.getObjectBytes(asset.objectKey);
  } catch {
    await db
      .update(assets)
      .set({ status: "REJECTED", rejectionReason: "Failed to read uploaded bytes from storage" })
      .where(eq(assets.id, asset.id));
    await db
      .update(uploadSessions)
      .set({ status: "ABORTED" })
      .where(eq(uploadSessions.id, session.id));
    throw new AssetError("STORAGE_READ_FAILED", 500, "Failed to read uploaded bytes from storage");
  }

  // 7. Validate actual size matches expected
  if (buffer.length !== session.expectedSize) {
    const errorMsg = `Uploaded size mismatch: expected ${session.expectedSize} bytes, received ${buffer.length} bytes`;
    await db
      .update(assets)
      .set({ status: "REJECTED", rejectionReason: errorMsg })
      .where(eq(assets.id, asset.id));
    await db
      .update(uploadSessions)
      .set({ status: "ABORTED" })
      .where(eq(uploadSessions.id, session.id));
    await storage.deleteObject(asset.objectKey).catch(() => {});
    throw new AssetError("SIZE_MISMATCH", 400, errorMsg);
  }

  // 8. Run validation pipeline: magic bytes, PDF structure, malware scan, sha256
  const validation = await validateUploadedBytes(buffer, asset.mimeType, scanner);

  if (!validation.isValid) {
    await db
      .update(assets)
      .set({
        status: "REJECTED",
        rejectionReason: validation.rejectionReason,
        detectedMimeType: validation.detectedMimeType,
        sha256: validation.sha256,
      })
      .where(eq(assets.id, asset.id));

    await db
      .update(uploadSessions)
      .set({ status: "ABORTED" })
      .where(eq(uploadSessions.id, session.id));

    // Delete hostile / invalid file from quarantine
    await storage.deleteObject(asset.objectKey).catch(() => {});

    throw new AssetError(
      "VALIDATION_FAILED",
      422,
      validation.rejectionReason || "File validation failed"
    );
  }

  // 9. Transition to SCANNING -> READY and move to published key
  await db.update(assets).set({ status: "SCANNING" }).where(eq(assets.id, asset.id));

  const safeBase = asset.originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const publishedKey = `published/${asset.id}/${safeBase}`;

  await storage.copyObject(asset.objectKey, publishedKey);
  await storage.deleteObject(asset.objectKey).catch(() => {});

  const [readyAsset] = await db
    .update(assets)
    .set({
      status: "READY",
      objectKey: publishedKey,
      detectedMimeType: validation.detectedMimeType,
      sha256: validation.sha256,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(assets.id, asset.id))
    .returning();

  await db
    .update(uploadSessions)
    .set({ status: "COMPLETED" })
    .where(eq(uploadSessions.id, session.id));

  if (!readyAsset) {
    throw new AssetError("INTERNAL_ERROR", 500, "Failed to update asset status to READY");
  }

  return mapAssetToDTO(readyAsset);
}

/**
 * Aborts an upload session and cleans up quarantine objects.
 */
export async function abortUploadSession(
  sessionId: string,
  userId: string,
  storage: StorageService = defaultStorageService
): Promise<void> {
  const [session] = await db
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.ownerId, userId)))
    .limit(1);

  if (!session) {
    throw new AssetError("NOT_FOUND", 404, "Upload session not found");
  }

  if (session.multipartUploadId) {
    const [asset] = await db.select().from(assets).where(eq(assets.id, session.assetId)).limit(1);
    if (asset) {
      await storage.abortMultipartUpload(asset.objectKey, session.multipartUploadId).catch(() => {});
    }
  }

  await db
    .update(uploadSessions)
    .set({ status: "ABORTED" })
    .where(eq(uploadSessions.id, session.id));

  const [asset] = await db
    .update(assets)
    .set({ status: "REJECTED", rejectionReason: "Upload session aborted by owner" })
    .where(eq(assets.id, session.assetId))
    .returning();

  if (asset) {
    await storage.deleteObject(asset.objectKey).catch(() => {});
  }
}

/**
 * Fetches asset by ID with strict ownership validation.
 */
export async function getAssetById(assetId: string, userId: string): Promise<AssetDTO> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.ownerId, userId)))
    .limit(1);

  if (!asset) {
    throw new AssetError("NOT_FOUND", 404, "Asset not found");
  }

  return mapAssetToDTO(asset);
}

/**
 * Deletes an asset and removes its stored object from R2.
 */
export async function deleteAsset(
  assetId: string,
  userId: string,
  storage: StorageService = defaultStorageService
): Promise<void> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.ownerId, userId)))
    .limit(1);

  if (!asset) {
    throw new AssetError("NOT_FOUND", 404, "Asset not found");
  }

  await storage.deleteObject(asset.objectKey).catch(() => {});

  await db
    .update(assets)
    .set({
      status: "DELETED",
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(assets.id, assetId));
}

/**
 * Cleans up unattached/orphaned or abandoned upload sessions older than a retention window.
 */
export async function cleanupOrphanAssets(
  olderThanHours = 24,
  storage: StorageService = defaultStorageService
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const staleSessions = await db
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.status, "PENDING"), lt(uploadSessions.expiresAt, cutoff)));

  let cleaned = 0;
  for (const s of staleSessions) {
    await abortUploadSession(s.id, s.ownerId, storage).catch(() => {});
    cleaned++;
  }

  return cleaned;
}
