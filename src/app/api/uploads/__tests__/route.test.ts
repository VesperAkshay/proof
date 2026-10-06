/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as createUploadRoute } from "../route";
import { POST as completeUploadRoute } from "../[id]/complete/route";
import { POST as abortUploadRoute } from "../[id]/abort/route";
import { GET as getAssetRoute, DELETE as deleteAssetRoute } from "../../assets/[id]/route";
import * as identityService from "@/services/identity";
import * as assetService from "@/services/assets";
import * as clerkNextjs from "@clerk/nextjs/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/services/identity", () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock("@/services/assets", () => ({
  createUploadSession: vi.fn(),
  completeUploadSession: vi.fn(),
  abortUploadSession: vi.fn(),
  getAssetById: vi.fn(),
  deleteAsset: vi.fn(),
  AssetError: class AssetError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, statusCode: number, message: string) {
      super(message);
      this.name = "AssetError";
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

describe("Uploads & Assets API Routes (M5)", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/uploads", () => {
    it("returns 401 UNAUTHORIZED when no auth token is present", async () => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: null } as any);

      const req = new NextRequest("http://localhost:3000/api/uploads", {
        method: "POST",
        body: JSON.stringify({ filename: "doc.pdf", size: 1000, mime: "application/pdf" }),
      });

      const res = await createUploadRoute(req);
      expect(res.status).toBe(401);
    });

    it("creates upload session successfully with presigned upload details", async () => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk_123" } as any);
      vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
        id: userId,
        username: "akshay",
      } as any);

      vi.mocked(assetService.createUploadSession).mockResolvedValue({
        sessionId: "session-1",
        assetId: "asset-1",
        upload: {
          type: "single",
          url: "https://r2.cloudflarestorage.com/upload-signed-url",
          expiresInSeconds: 300,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/uploads", {
        method: "POST",
        body: JSON.stringify({
          filename: "diploma.pdf",
          size: 2048,
          mime: "application/pdf",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await createUploadRoute(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.session_id).toBe("session-1");
      expect(data.asset_id).toBe("asset-1");
      expect(data.upload.type).toBe("single");
    });
  });

  describe("POST /api/uploads/:id/complete", () => {
    it("completes upload session and returns ready asset", async () => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk_123" } as any);
      vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
        id: userId,
        username: "akshay",
      } as any);

      vi.mocked(assetService.completeUploadSession).mockResolvedValue({
        id: "asset-1",
        ownerId: userId,
        objectKey: "published/asset-1/diploma.pdf",
        originalFilename: "diploma.pdf",
        mimeType: "application/pdf",
        detectedMimeType: "application/pdf",
        sizeBytes: 2048,
        sha256: "hash",
        status: "READY",
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest("http://localhost:3000/api/uploads/session-1/complete", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await completeUploadRoute(req, {
        params: Promise.resolve({ id: "session-1" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.asset.status).toBe("READY");
    });
  });

  describe("POST /api/uploads/:id/abort", () => {
    it("aborts upload session successfully", async () => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk_123" } as any);
      vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
        id: userId,
        username: "akshay",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/uploads/session-1/abort", {
        method: "POST",
      });

      const res = await abortUploadRoute(req, {
        params: Promise.resolve({ id: "session-1" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe("GET /api/assets/:id & DELETE /api/assets/:id", () => {
    it("returns asset metadata by ID", async () => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk_123" } as any);
      vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
        id: userId,
        username: "akshay",
      } as any);

      vi.mocked(assetService.getAssetById).mockResolvedValue({
        id: "asset-1",
        ownerId: userId,
        objectKey: "published/asset-1/diploma.pdf",
        originalFilename: "diploma.pdf",
        mimeType: "application/pdf",
        detectedMimeType: "application/pdf",
        sizeBytes: 2048,
        sha256: "hash",
        status: "READY",
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest("http://localhost:3000/api/assets/asset-1");
      const res = await getAssetRoute(req, {
        params: Promise.resolve({ id: "asset-1" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.asset.id).toBe("asset-1");
    });

    it("deletes asset by ID", async () => {
      vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk_123" } as any);
      vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
        id: userId,
        username: "akshay",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/assets/asset-1", {
        method: "DELETE",
      });
      const res = await deleteAssetRoute(req, {
        params: Promise.resolve({ id: "asset-1" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
