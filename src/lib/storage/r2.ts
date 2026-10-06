import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageService {
  createPresignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
  createMultipartUpload(key: string, contentType: string): Promise<string>;
  createPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds?: number
  ): Promise<string>;
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  getObjectBytes(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  copyObject(sourceKey: string, destinationKey: string): Promise<void>;
}

export class R2StorageService implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor(options?: {
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
  }) {
    const endpoint =
      options?.endpoint ||
      process.env.R2_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : "https://r2.cloudflarestorage.com");

    const accessKeyId = options?.accessKeyId || process.env.R2_ACCESS_KEY_ID || "mock-access-key";
    const secretAccessKey =
      options?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || "mock-secret-key";

    this.bucket = options?.bucket || process.env.R2_BUCKET_NAME || "proof-assets";

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async createPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 300
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const res = await this.client.send(command);
    if (!res.UploadId) {
      throw new Error("Failed to initialize multipart upload in R2");
    }
    return res.UploadId;
  }

  async createPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds = 300
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        })),
      },
    });
    await this.client.send(command);
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    });
    await this.client.send(command);
  }

  async getObjectBytes(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const res = await this.client.send(command);
    if (!res.Body) {
      throw new Error(`Object body is empty for key: ${key}`);
    }
    const byteArray = await res.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(command);
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    });
    await this.client.send(command);
  }
}

/**
 * In-memory storage mock for fast, isolated tests.
 */
export class InMemoryStorageService implements StorageService {
  private store = new Map<string, Buffer>();
  private multipart = new Map<string, { key: string; parts: Map<number, { buffer?: Buffer; etag: string }> }>();

  async createPresignedUploadUrl(key: string): Promise<string> {
    return `https://storage.test/upload?key=${encodeURIComponent(key)}`;
  }

  async createMultipartUpload(key: string): Promise<string> {
    const uploadId = `upload-${Math.random().toString(36).slice(2)}`;
    this.multipart.set(uploadId, { key, parts: new Map() });
    return uploadId;
  }

  async createPresignedPartUrl(key: string, uploadId: string, partNumber: number): Promise<string> {
    return `https://storage.test/upload-part?key=${encodeURIComponent(key)}&uploadId=${uploadId}&partNumber=${partNumber}`;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    const session = this.multipart.get(uploadId);
    if (!session) throw new Error("Upload session not found");

    // Concatenate parts if buffers exist, else mock a buffer
    const buffers: Buffer[] = [];
    for (const p of parts.sort((a, b) => a.partNumber - b.partNumber)) {
      const partData = session.parts.get(p.partNumber);
      if (partData?.buffer) {
        buffers.push(partData.buffer);
      }
    }
    this.store.set(key, buffers.length > 0 ? Buffer.concat(buffers) : Buffer.from("mock-multipart-content"));
    this.multipart.delete(uploadId);
  }

  async abortMultipartUpload(_key: string, uploadId: string): Promise<void> {
    this.multipart.delete(uploadId);
  }

  async getObjectBytes(key: string): Promise<Buffer> {
    const buffer = this.store.get(key);
    if (!buffer) {
      throw new Error(`Object not found in memory store: ${key}`);
    }
    return buffer;
  }

  async deleteObject(key: string): Promise<void> {
    this.store.delete(key);
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const buffer = this.store.get(sourceKey);
    if (!buffer) {
      throw new Error(`Source object not found: ${sourceKey}`);
    }
    this.store.set(destinationKey, buffer);
  }

  // Test helper
  putObjectDirect(key: string, buffer: Buffer): void {
    this.store.set(key, buffer);
  }
}

export const defaultStorageService: StorageService =
  process.env.NODE_ENV === "test" && !process.env.R2_ACCOUNT_ID
    ? new InMemoryStorageService()
    : new R2StorageService();
