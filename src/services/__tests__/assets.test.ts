/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createUploadSession,
  completeUploadSession,
  abortUploadSession,
  getAssetById,
  deleteAsset,
  cleanupOrphanAssets,
  AssetError,
} from "../assets";
import { db } from "@/db/client";
import { InMemoryStorageService } from "@/lib/storage/r2";

vi.mock("@/db/client", () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

describe("Assets & Upload Session Service (M5)", () => {
  const userId = "user-123";
  const validPdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  let memoryStorage: InMemoryStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    memoryStorage = new InMemoryStorageService();
  });

  describe("createUploadSession", () => {
    it("creates single upload session for files <= 5 MB with quarantine key", async () => {
      let insertedAsset: any = null;
      let insertedSession: any = null;

      (db.insert as any).mockImplementation((_table: any) => ({
        values: vi.fn().mockImplementation((val) => {
          if (!insertedAsset) {
            insertedAsset = { ...val, id: "asset-1" };
            return { returning: vi.fn().mockResolvedValue([insertedAsset]) };
          }
          insertedSession = { ...val, id: "session-1" };
          return { returning: vi.fn().mockResolvedValue([insertedSession]) };
        }),
      }));

      const result = await createUploadSession(
        userId,
        {
          filename: "diploma.pdf",
          sizeBytes: 1024 * 100, // 100 KB
          mimeType: "application/pdf",
        },
        memoryStorage
      );

      expect(result.sessionId).toBe("session-1");
      expect(result.assetId).toBe("asset-1");
      expect(result.upload.type).toBe("single");
      if (result.upload.type === "single") {
        expect(result.upload.url).toContain("quarantine%2F");
      }
      expect(insertedAsset.objectKey).toContain("quarantine/");
      expect(insertedAsset.status).toBe("PENDING_UPLOAD");
      expect(insertedSession.status).toBe("PENDING");
    });

    it("creates multipart upload session for files > 5 MB", async () => {
      let insertedAsset: any = null;
      let insertedSession: any = null;

      (db.insert as any).mockImplementation((_table: any) => ({
        values: vi.fn().mockImplementation((val) => {
          if (!insertedAsset) {
            insertedAsset = { ...val, id: "asset-large" };
            return { returning: vi.fn().mockResolvedValue([insertedAsset]) };
          }
          insertedSession = { ...val, id: "session-large" };
          return { returning: vi.fn().mockResolvedValue([insertedSession]) };
        }),
      }));

      const result = await createUploadSession(
        userId,
        {
          filename: "large-thesis.pdf",
          sizeBytes: 8 * 1024 * 1024, // 8 MB
          mimeType: "application/pdf",
        },
        memoryStorage
      );

      expect(result.upload.type).toBe("multipart");
      if (result.upload.type === "multipart") {
        expect(result.upload.uploadId).toBeDefined();
        expect(result.upload.parts.length).toBe(2); // 8 MB = two 5MB parts
      }
    });

    it("rejects files exceeding 10 MB limit with 413 FILE_OVERSIZED", async () => {
      await expect(
        createUploadSession(
          userId,
          {
            filename: "huge.pdf",
            sizeBytes: 11 * 1024 * 1024,
            mimeType: "application/pdf",
          },
          memoryStorage
        )
      ).rejects.toThrowError(AssetError);

      try {
        await createUploadSession(
          userId,
          {
            filename: "huge.pdf",
            sizeBytes: 11 * 1024 * 1024,
            mimeType: "application/pdf",
          },
          memoryStorage
        );
      } catch (err: any) {
        expect(err.statusCode).toBe(413);
        expect(err.code).toBe("FILE_OVERSIZED");
      }
    });
  });

  describe("completeUploadSession", () => {
    it("validates bytes from quarantine, moves to published, and updates asset to READY", async () => {
      const quarantineKey = "quarantine/test-asset-uuid-cert.pdf";
      memoryStorage.putObjectDirect(quarantineKey, validPdfBytes);

      const mockSession = {
        id: "session-1",
        ownerId: userId,
        assetId: "asset-1",
        status: "PENDING",
        expectedSize: validPdfBytes.length,
        expiresAt: new Date(Date.now() + 10000),
      };

      const mockAsset = {
        id: "asset-1",
        ownerId: userId,
        objectKey: quarantineKey,
        originalFilename: "cert.pdf",
        mimeType: "application/pdf",
        sizeBytes: validPdfBytes.length,
        status: "PENDING_UPLOAD",
      };

      let selectStep = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectStep++;
              if (selectStep === 1) return [mockSession];
              return [mockAsset];
            }),
          }),
        }),
      }));

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                ...mockAsset,
                status: "READY",
                objectKey: "published/asset-1/cert.pdf",
                detectedMimeType: "application/pdf",
                sha256: "computed-sha256",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const readyAsset = await completeUploadSession("session-1", userId, undefined, memoryStorage);

      expect(readyAsset.status).toBe("READY");
      expect(readyAsset.objectKey).toBe("published/asset-1/cert.pdf");

      // Verify object was moved to published key in storage
      const publishedBytes = await memoryStorage.getObjectBytes("published/asset-1/cert.pdf");
      expect(publishedBytes).toEqual(validPdfBytes);

      // Verify quarantine key was deleted
      await expect(memoryStorage.getObjectBytes(quarantineKey)).rejects.toThrow();
    });

    it("rejects malicious file, purges quarantine object, marks asset REJECTED and session ABORTED", async () => {
      const quarantineKey = "quarantine/bad-payload.pdf";
      const maliciousPdfBytes = Buffer.from(
        "%PDF-1.4\n<< /Type /Action /S /JavaScript /JS (alert(1)) >>\n%%EOF"
      );
      memoryStorage.putObjectDirect(quarantineKey, maliciousPdfBytes);

      const mockSession = {
        id: "session-bad",
        ownerId: userId,
        assetId: "asset-bad",
        status: "PENDING",
        expectedSize: maliciousPdfBytes.length,
        expiresAt: new Date(Date.now() + 10000),
      };

      const mockAsset = {
        id: "asset-bad",
        ownerId: userId,
        objectKey: quarantineKey,
        originalFilename: "bad.pdf",
        mimeType: "application/pdf",
        sizeBytes: maliciousPdfBytes.length,
        status: "PENDING_UPLOAD",
      };

      let selectStep = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectStep++;
              if (selectStep === 1) return [mockSession];
              return [mockAsset];
            }),
          }),
        }),
      }));

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      try {
        await completeUploadSession("session-bad", userId, undefined, memoryStorage);
        expect.unreachable("Should have thrown AssetError");
      } catch (err: any) {
        expect(err).toBeInstanceOf(AssetError);
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe("VALIDATION_FAILED");
      }

      // Verify quarantine object was purged
      await expect(memoryStorage.getObjectBytes(quarantineKey)).rejects.toThrow();
    });

    it("enforces anti-IDOR: rejects attempt by another user to complete upload session", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No session matching sessionId AND attacker userId
          }),
        }),
      });

      await expect(
        completeUploadSession("session-1", "attacker-id", undefined, memoryStorage)
      ).rejects.toThrowError(AssetError);

      try {
        await completeUploadSession("session-1", "attacker-id", undefined, memoryStorage);
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("abortUploadSession", () => {
    it("aborts session and deletes quarantine object", async () => {
      const quarantineKey = "quarantine/aborted.png";
      memoryStorage.putObjectDirect(quarantineKey, Buffer.from("dummy"));

      const mockSession = {
        id: "session-abort",
        ownerId: userId,
        assetId: "asset-abort",
        status: "PENDING",
      };

      const mockAsset = {
        id: "asset-abort",
        objectKey: quarantineKey,
      };

      let selectStep = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectStep++;
              if (selectStep === 1) return [mockSession];
              return [mockAsset];
            }),
          }),
        }),
      }));

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      await abortUploadSession("session-abort", userId, memoryStorage);

      // Verify object deleted
      await expect(memoryStorage.getObjectBytes(quarantineKey)).rejects.toThrow();
    });
  });

  describe("getAssetById & deleteAsset", () => {
    it("retrieves asset metadata with ownership check", async () => {
      const mockAsset = {
        id: "asset-123",
        ownerId: userId,
        objectKey: "published/asset-123/cert.pdf",
        originalFilename: "cert.pdf",
        mimeType: "application/pdf",
        detectedMimeType: "application/pdf",
        sizeBytes: 2048,
        sha256: "hash123",
        status: "READY",
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      const res = await getAssetById("asset-123", userId);
      expect(res.id).toBe("asset-123");
      expect(res.status).toBe("READY");
    });

    it("deletes asset record and storage object", async () => {
      const key = "published/del/cert.pdf";
      memoryStorage.putObjectDirect(key, Buffer.from("content"));

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "asset-del", ownerId: userId, objectKey: key }]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await deleteAsset("asset-del", userId, memoryStorage);
      await expect(memoryStorage.getObjectBytes(key)).rejects.toThrow();
    });
  });

  describe("cleanupOrphanAssets", () => {
    it("cleans up stale uncompleted sessions", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "stale-s1", ownerId: userId }]),
        }),
      });

      // Abort session mocks
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const cleanedCount = await cleanupOrphanAssets(24, memoryStorage);
      expect(cleanedCount).toBe(1);
    });
  });
});
