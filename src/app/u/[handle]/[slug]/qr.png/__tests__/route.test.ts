import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as proofService from "@/services/proof";

vi.mock("@/services/proof");

describe("Public QR PNG Route Handler (M9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPublicProofResult: proofService.PublicProofResult = {
    isRedirect: false,
    user: {
      id: "u1",
      username: "akshay",
      displayName: "Akshay",
      bio: null,
      avatarUrl: null,
    },
    proof: {
      id: "p1",
      slug: "aws-cert",
      title: "AWS Cert",
      description: null,
      proofType: "certificate",
      issuerDisplayName: "Amazon",
      issuedAt: null,
      expiresAt: null,
      credentialId: null,
      credentialUrl: null,
      lifecycleState: "PUBLISHED",
      visibility: "public",
      verificationStatus: "ISSUER_VERIFIED",
      effectiveStatus: "ISSUER_VERIFIED",
      publishedAt: new Date(),
    },
    primaryAsset: null,
    assets: [],
  };

  it("returns 200 with PNG image buffer and cache headers for public proof", async () => {
    vi.spyOn(proofService, "getPublicProof").mockResolvedValue(mockPublicProofResult);

    const req = new NextRequest("https://proof.so/@akshay/aws-cert/qr.png");
    const res = await GET(req, {
      params: Promise.resolve({ handle: "akshay", slug: "aws-cert" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("public");

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
  });

  it("returns 301 permanent redirect when proof was renamed", async () => {
    vi.spyOn(proofService, "getPublicProof").mockResolvedValue({
      isRedirect: true,
      redirectTo: "/@akshay/canonical-slug",
    });

    const req = new NextRequest("https://proof.so/@akshay/old-slug/qr.png");
    const res = await GET(req, {
      params: Promise.resolve({ handle: "akshay", slug: "old-slug" }),
    });

    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toContain("/@akshay/canonical-slug/qr.png");
  });

  it("returns 404 with noindex when proof does not exist or is non-public", async () => {
    vi.spyOn(proofService, "getPublicProof").mockResolvedValue(null);

    const req = new NextRequest("https://proof.so/@akshay/private-proof/qr.png");
    const res = await GET(req, {
      params: Promise.resolve({ handle: "akshay", slug: "private-proof" }),
    });

    expect(res.status).toBe(404);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
