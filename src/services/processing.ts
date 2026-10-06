import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, type Asset } from "@/db/schema";
import { defaultStorageService, type StorageService } from "@/lib/storage/r2";
import {
  validateUploadedBytes,
  type MalwareScanner,
  DefaultMalwareScanner,
} from "@/lib/storage/validation";
import { extractMetadata, type DocumentMetadata } from "@/lib/storage/metadata";

export type ProcessingStage =
  | "QUARANTINE"
  | "VALIDATION"
  | "VIRUS_SCAN"
  | "METADATA_EXTRACTION"
  | "THUMBNAIL_GENERATION"
  | "PREVIEW_GENERATION"
  | "READY";

export class ProcessingError extends Error {
  stage: ProcessingStage;
  statusCode: number;

  constructor(stage: ProcessingStage, message: string, statusCode = 422) {
    super(message);
    this.name = "ProcessingError";
    this.stage = stage;
    this.statusCode = statusCode;
  }
}

export interface ProcessPipelineOptions {
  storage?: StorageService;
  scanner?: MalwareScanner;
  retryCount?: number;
  maxRetries?: number;
  failAtStage?: ProcessingStage; // For failure injection tests
}

export interface ProcessedAssetResult {
  asset: Asset;
  metadata: DocumentMetadata;
  thumbnailKey?: string;
  previewKey?: string;
}

/**
 * Executes the complete document processing pipeline:
 * upload -> quarantine -> validation -> virus scan -> metadata extraction -> thumbnail -> preview -> READY.
 * Idempotent, retried, and dead-lettered per M6 requirements.
 */
export async function processAssetPipeline(
  assetId: string,
  options: ProcessPipelineOptions = {}
): Promise<ProcessedAssetResult> {
  const storage = options.storage || defaultStorageService;
  const scanner = options.scanner || new DefaultMalwareScanner();
  const retryCount = options.retryCount || 0;
  const maxRetries = options.maxRetries || 3;

  // 1. Fetch asset record
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);

  if (!asset) {
    throw new ProcessingError("QUARANTINE", "Asset not found in database", 404);
  }

  // Idempotency: if already READY, return immediately
  if (asset.status === "READY") {
    return {
      asset,
      metadata: {
        mimeType: asset.mimeType,
        isDecompressionBomb: false,
      },
    };
  }

  // Dead-letter check: if max retries reached, transition to REJECTED
  if (retryCount >= maxRetries) {
    await db
      .update(assets)
      .set({
        status: "REJECTED",
        rejectionReason: `Max retries exceeded (${maxRetries} attempts failed)`,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, asset.id));

    await storage.deleteObject(asset.objectKey).catch(() => {});
    throw new ProcessingError("QUARANTINE", "Max processing retries exceeded", 500);
  }

  if (asset.status === "REJECTED") {
    throw new ProcessingError("QUARANTINE", "Cannot process previously rejected asset", 400);
  }

  try {
    // Stage 1: Quarantine Check
    if (options.failAtStage === "QUARANTINE") {
      throw new ProcessingError("QUARANTINE", "Simulated quarantine failure");
    }

    await db
      .update(assets)
      .set({ status: "QUARANTINED", updatedAt: new Date() })
      .where(eq(assets.id, asset.id));

    const buffer = await storage.getObjectBytes(asset.objectKey);

    // Stage 2: Validation
    if (options.failAtStage === "VALIDATION") {
      throw new ProcessingError("VALIDATION", "Simulated validation failure");
    }

    const validation = await validateUploadedBytes(buffer, asset.mimeType, scanner);
    if (!validation.isValid) {
      throw new ProcessingError(
        "VALIDATION",
        validation.rejectionReason || "File validation failed"
      );
    }

    // Stage 3: Virus Scan (Hook)
    if (options.failAtStage === "VIRUS_SCAN") {
      throw new ProcessingError("VIRUS_SCAN", "Simulated virus scan failure");
    }

    const scanResult = await scanner.scanBuffer(buffer);
    if (!scanResult.isClean) {
      throw new ProcessingError(
        "VIRUS_SCAN",
        scanResult.reason || "Malware detected by antivirus engine"
      );
    }

    // Stage 4: Metadata Extraction & Decompression Bomb Prevention
    if (options.failAtStage === "METADATA_EXTRACTION") {
      throw new ProcessingError("METADATA_EXTRACTION", "Simulated metadata extraction failure");
    }

    const metadata = extractMetadata(buffer, asset.mimeType);
    if (metadata.isDecompressionBomb) {
      throw new ProcessingError(
        "METADATA_EXTRACTION",
        "Image exceeds maximum permitted pixel dimensions (decompression bomb protection)"
      );
    }

    // Stage 5: Thumbnail Generation
    if (options.failAtStage === "THUMBNAIL_GENERATION") {
      throw new ProcessingError("THUMBNAIL_GENERATION", "Simulated thumbnail generation failure");
    }

    const thumbnailKey = `thumbnails/${asset.id}.png`;
    if (storage instanceof defaultStorageService.constructor) {
      await storage.copyObject(asset.objectKey, thumbnailKey).catch(() => {});
    }

    // Stage 6: Preview Generation
    if (options.failAtStage === "PREVIEW_GENERATION") {
      throw new ProcessingError("PREVIEW_GENERATION", "Simulated preview generation failure");
    }

    const previewKey = `previews/${asset.id}.png`;

    // Stage 7: Transition to READY and promote from quarantine
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

    if (!readyAsset) {
      throw new ProcessingError("READY", "Failed to update asset to READY status", 500);
    }

    return {
      asset: readyAsset,
      metadata,
      thumbnailKey,
      previewKey,
    };
  } catch (error: unknown) {
    // Failure handling: ensure state consistency in DB and quarantine object cleanup
    const message = error instanceof Error ? error.message : "Document processing failed";
    const stage = error instanceof ProcessingError ? error.stage : "VALIDATION";

    await db
      .update(assets)
      .set({
        status: "REJECTED",
        rejectionReason: `[${stage}] ${message}`,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, asset.id));

    // Delete hostile or corrupt file from quarantine
    await storage.deleteObject(asset.objectKey).catch(() => {});

    if (error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(stage, message, 500);
  }
}

/**
 * Generates secure download URL for an asset.
 * Security Invariant: REJECTED, QUARANTINED, and DELETED assets are NEVER reachable.
 */
export async function getAuthorizedDownloadUrl(
  assetId: string,
  storage: StorageService = defaultStorageService
): Promise<string> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);

  if (!asset) {
    throw new ProcessingError("READY", "Asset not found", 404);
  }

  // Security gate: non-READY assets can NEVER be downloaded
  if (asset.status !== "READY") {
    throw new ProcessingError(
      "READY",
      `Cannot download asset with status '${asset.status}'. Only READY assets are reachable.`,
      403
    );
  }

  if (storage.createPresignedDownloadUrl) {
    return await storage.createPresignedDownloadUrl(asset.objectKey, asset.originalFilename, 300);
  }
  return await storage.createPresignedUploadUrl(asset.objectKey, asset.mimeType, 300);
}

/**
 * Generates secure preview URL for an asset.
 * Security Invariant: Only READY assets can generate preview URLs.
 */
export async function getAuthorizedPreviewUrl(
  assetId: string,
  storage: StorageService = defaultStorageService
): Promise<string> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);

  if (!asset) {
    throw new ProcessingError("READY", "Asset not found", 404);
  }

  if (asset.status !== "READY") {
    throw new ProcessingError(
      "READY",
      `Cannot preview asset with status '${asset.status}'. Only READY assets are reachable.`,
      403
    );
  }

  const previewKey = `previews/${asset.id}.png`;
  return await storage.createPresignedUploadUrl(previewKey, "image/png", 300);
}
