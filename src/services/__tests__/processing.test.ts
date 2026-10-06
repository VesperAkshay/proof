/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processAssetPipeline,
  getAuthorizedDownloadUrl,
  getAuthorizedPreviewUrl,
  ProcessingError,
} from "../processing";
import { db } from "@/db/client";
import { InMemoryStorageService } from "@/lib/storage/r2";

vi.mock("@/db/client", () => {
  return {
    db: {
      select: vi.fn(),
      update: vi.fn(),
    },
  };
});

describe("Document Processing Pipeline Engine (M6)", () => {
  const assetId = "asset-proc-123";
  const validPdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  let memoryStorage: InMemoryStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    memoryStorage = new InMemoryStorageService();
  });

  describe("End-to-End Pipeline Execution", () => {
    it("processes quarantined PDF through all stages to READY status", async () => {
      const quarantineKey = `quarantine/${assetId}-cert.pdf`;
      memoryStorage.putObjectDirect(quarantineKey, validPdfBytes);

      const mockAsset = {
        id: assetId,
        ownerId: "owner-1",
        objectKey: quarantineKey,
        originalFilename: "cert.pdf",
        mimeType: "application/pdf",
        sizeBytes: validPdfBytes.length,
        status: "QUARANTINED",
        rejectionReason: null,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      const readyAsset = {
        ...mockAsset,
        status: "READY",
        objectKey: `published/${assetId}/cert.pdf`,
        detectedMimeType: "application/pdf",
        sha256: "hash123",
      };

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([readyAsset]),
          }),
        }),
      });

      const result = await processAssetPipeline(assetId, { storage: memoryStorage });

      expect(result.asset.status).toBe("READY");
      expect(result.metadata.mimeType).toBe("application/pdf");
      expect(result.metadata.pageCount).toBe(1);

      // Verify promoted to published key in storage
      const publishedBytes = await memoryStorage.getObjectBytes(`published/${assetId}/cert.pdf`);
      expect(publishedBytes).toEqual(validPdfBytes);

      // Verify deleted from quarantine
      await expect(memoryStorage.getObjectBytes(quarantineKey)).rejects.toThrow();
    });

    it("is idempotent: returns already READY asset immediately", async () => {
      const mockReadyAsset = {
        id: assetId,
        ownerId: "owner-1",
        objectKey: `published/${assetId}/cert.pdf`,
        originalFilename: "cert.pdf",
        mimeType: "application/pdf",
        sizeBytes: validPdfBytes.length,
        status: "READY",
        rejectionReason: null,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockReadyAsset]),
          }),
        }),
      });

      const result = await processAssetPipeline(assetId, { storage: memoryStorage });

      expect(result.asset.status).toBe("READY");
      // DB update should NOT have been called because it was already READY
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe("Failure Injection at Each Stage (M6 Exit Gate)", () => {
    it("handles failure at QUARANTINE stage: marks REJECTED and purges quarantine", async () => {
      const quarantineKey = `quarantine/${assetId}-cert.pdf`;
      memoryStorage.putObjectDirect(quarantineKey, validPdfBytes);

      const mockAsset = {
        id: assetId,
        objectKey: quarantineKey,
        mimeType: "application/pdf",
        status: "PENDING_UPLOAD",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        processAssetPipeline(assetId, {
          storage: memoryStorage,
          failAtStage: "QUARANTINE",
        })
      ).rejects.toThrowError(ProcessingError);

      await expect(memoryStorage.getObjectBytes(quarantineKey)).rejects.toThrow();
    });

    it("handles failure at VALIDATION stage: marks REJECTED and purges quarantine", async () => {
      const quarantineKey = `quarantine/${assetId}-cert.pdf`;
      memoryStorage.putObjectDirect(quarantineKey, validPdfBytes);

      const mockAsset = {
        id: assetId,
        objectKey: quarantineKey,
        mimeType: "application/pdf",
        status: "QUARANTINED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        processAssetPipeline(assetId, {
          storage: memoryStorage,
          failAtStage: "VALIDATION",
        })
      ).rejects.toThrowError(ProcessingError);

      await expect(memoryStorage.getObjectBytes(quarantineKey)).rejects.toThrow();
    });

    it("handles failure at VIRUS_SCAN stage: marks REJECTED and purges quarantine", async () => {
      const quarantineKey = `quarantine/${assetId}-cert.pdf`;
      memoryStorage.putObjectDirect(quarantineKey, validPdfBytes);

      const mockAsset = {
        id: assetId,
        objectKey: quarantineKey,
        mimeType: "application/pdf",
        status: "QUARANTINED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        processAssetPipeline(assetId, {
          storage: memoryStorage,
          failAtStage: "VIRUS_SCAN",
        })
      ).rejects.toThrowError(ProcessingError);

      await expect(memoryStorage.getObjectBytes(quarantineKey)).rejects.toThrow();
    });

    it("handles failure at METADATA_EXTRACTION stage: marks REJECTED and purges quarantine", async () => {
      const quarantineKey = `quarantine/${assetId}-cert.pdf`;
      memoryStorage.putObjectDirect(quarantineKey, validPdfBytes);

      const mockAsset = {
        id: assetId,
        objectKey: quarantineKey,
        mimeType: "application/pdf",
        status: "QUARANTINED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        processAssetPipeline(assetId, {
          storage: memoryStorage,
          failAtStage: "METADATA_EXTRACTION",
        })
      ).rejects.toThrowError(ProcessingError);

      await expect(memoryStorage.getObjectBytes(quarantineKey)).rejects.toThrow();
    });

    it("handles failure at THUMBNAIL_GENERATION stage: marks REJECTED and purges quarantine", async () => {
      const quarantineKey = `quarantine/${assetId}-cert.pdf`;
      memoryStorage.putObjectDirect(quarantineKey, validPdfBytes);

      const mockAsset = {
        id: assetId,
        objectKey: quarantineKey,
        mimeType: "application/pdf",
        status: "QUARANTINED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        processAssetPipeline(assetId, {
          storage: memoryStorage,
          failAtStage: "THUMBNAIL_GENERATION",
        })
      ).rejects.toThrowError(ProcessingError);

      await expect(memoryStorage.getObjectBytes(quarantineKey)).rejects.toThrow();
    });
  });

  describe("Dead-Letter Handling", () => {
    it("dead-letters asset after exceeding max retries", async () => {
      const mockAsset = {
        id: assetId,
        objectKey: `quarantine/${assetId}.pdf`,
        status: "QUARANTINED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      let updatedRecord: any = null;
      (db.update as any).mockReturnValue({
        set: vi.fn().mockImplementation((val) => {
          updatedRecord = val;
          return {
            where: vi.fn().mockResolvedValue([]),
          };
        }),
      });

      await expect(
        processAssetPipeline(assetId, {
          storage: memoryStorage,
          retryCount: 3,
          maxRetries: 3,
        })
      ).rejects.toThrowError(ProcessingError);

      expect(updatedRecord.status).toBe("REJECTED");
      expect(updatedRecord.rejectionReason).toContain("Max retries exceeded");
    });
  });

  describe("Security Exit Gate: REJECTED & Non-READY Assets Are Never Reachable", () => {
    it("forbids download for REJECTED assets with 403 error", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: assetId,
                status: "REJECTED",
                objectKey: "quarantine/bad.pdf",
                mimeType: "application/pdf",
              },
            ]),
          }),
        }),
      });

      await expect(getAuthorizedDownloadUrl(assetId, memoryStorage)).rejects.toThrowError(
        ProcessingError
      );

      try {
        await getAuthorizedDownloadUrl(assetId, memoryStorage);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain("Only READY assets are reachable");
      }
    });

    it("forbids download for QUARANTINED assets with 403 error", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: assetId,
                status: "QUARANTINED",
                objectKey: "quarantine/pending.pdf",
                mimeType: "application/pdf",
              },
            ]),
          }),
        }),
      });

      await expect(getAuthorizedDownloadUrl(assetId, memoryStorage)).rejects.toThrowError(
        ProcessingError
      );

      try {
        await getAuthorizedDownloadUrl(assetId, memoryStorage);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });

    it("forbids preview for non-READY assets with 403 error", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: assetId,
                status: "PENDING_UPLOAD",
                objectKey: "quarantine/test.png",
                mimeType: "image/png",
              },
            ]),
          }),
        }),
      });

      await expect(getAuthorizedPreviewUrl(assetId, memoryStorage)).rejects.toThrowError(
        ProcessingError
      );

      try {
        await getAuthorizedPreviewUrl(assetId, memoryStorage);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });

    it("allows download and preview only when asset is READY", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: assetId,
                status: "READY",
                objectKey: "published/asset-1/cert.pdf",
                mimeType: "application/pdf",
              },
            ]),
          }),
        }),
      });

      const downloadUrl = await getAuthorizedDownloadUrl(assetId, memoryStorage);
      expect(downloadUrl).toBeDefined();

      const previewUrl = await getAuthorizedPreviewUrl(assetId, memoryStorage);
      expect(previewUrl).toBeDefined();
    });
  });
});
