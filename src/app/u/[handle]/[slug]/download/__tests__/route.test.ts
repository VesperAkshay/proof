import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as proofService from "@/services/proof";
import * as processingService from "@/services/processing";

vi.mock("@/services/proof");
vi.mock("@/services/processing");

describe("Public Download Route Handler (M7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockValidProofResult: proofService.PublicProofResult = {
    isRedirect: false,
    user: {
      id: "user-1",
      username: "akshay",
      displayName: "Akshay",
      bio: null,
      avatarUrl: null,
    },
    proof: {
      id: "proof-1",
      slug: "aws-cert",
      title: "AWS Certification",
      description: null,
      proofType: "certificate",
      issuerDisplayName: "Amazon",
      issuedAt: new Date("2024-01-01"),
      expiresAt: null,
      credentialId: null,
      credentialUrl: null,
      lifecycleState: "PUBLISHED",
      visibility: "public",
      verificationStatus: "DOCUMENT_UPLOADED",
      effectiveStatus: "DOCUMENT_UPLOADED",
      publishedAt: new Date("2024-01-01"),
    },
    primaryAsset: {
      id: "asset-1",
      role: "evidence",
      originalFilename: "aws.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      previewUrl: null,
      downloadUrl: "/@akshay/aws-cert/download",
    },
    assets: [],
  };

  it("redirects (307) to presigned download URL when proof and asset are valid and READY", async () => {
    vi.spyOn(proofService, "getPublicProof").mockResolvedValue(mockValidProofResult);
    vi.spyOn(processingService, "getAuthorizedDownloadUrl").mockResolvedValue("https://r2.storage/signed-download");

    const req = new NextRequest("https://proof.so/@akshay/aws-cert/download");
    const res = await GET(req, {
      params: Promise.resolve({ handle: "akshay", slug: "aws-cert" }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://r2.storage/signed-download");
  });

  it("returns 301 permanent redirect when proof or handle was renamed", async () => {
    vi.spyOn(proofService, "getPublicProof").mockResolvedValue({
      isRedirect: true,
      redirectTo: "/@akshay/new-slug",
    });

    const req = new NextRequest("https://proof.so/@akshay/old-slug/download");
    const res = await GET(req, {
      params: Promise.resolve({ handle: "akshay", slug: "old-slug" }),
    });

    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toContain("/@akshay/new-slug/download");
  });

  it("returns 404 with X-Robots-Tag: noindex when proof does not exist or is not public", async () => {
    vi.spyOn(proofService, "getPublicProof").mockResolvedValue(null);

    const req = new NextRequest("https://proof.so/@akshay/secret-proof/download");
    const res = await GET(req, {
      params: Promise.resolve({ handle: "akshay", slug: "secret-proof" }),
    });

    expect(res.status).toBe(404);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("returns 404 with noindex when proof exists but has no attached evidence asset", async () => {
    vi.spyOn(proofService, "getPublicProof").mockResolvedValue({
      ...mockValidProofResult,
      primaryAsset: null,
    });

    const req = new NextRequest("https://proof.so/@akshay/no-asset-proof/download");
    const res = await GET(req, {
      params: Promise.resolve({ handle: "akshay", slug: "no-asset-proof" }),
    });

    expect(res.status).toBe(404);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
