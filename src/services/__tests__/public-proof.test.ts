/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPublicProof } from "../proof";
import { db } from "@/db/client";

vi.mock("@/db/client", () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

describe("getPublicProof Service (M7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockActiveUser = {
    id: "user-123",
    username: "akshay",
    displayName: "Akshay Patel",
    bio: "Systems Engineer",
    avatarAssetId: "avatar-asset-1",
    status: "active",
  };

  const mockPublishedProof = {
    id: "proof-456",
    userId: "user-123",
    slug: "aws-solutions-architect",
    title: "AWS Certified Solutions Architect",
    description: "Professional level cloud architecture credential",
    proofType: "certificate",
    issuerId: "issuer-1",
    issuerNameText: null,
    issuedAt: new Date("2024-01-01T00:00:00Z"),
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    credentialId: "AWS-123456",
    credentialUrl: "https://aws.amazon.com/verify/123456",
    lifecycleState: "PUBLISHED",
    visibility: "public",
    verificationStatus: "ISSUER_VERIFIED",
    publishedAt: new Date("2024-01-02T00:00:00Z"),
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-02T00:00:00Z"),
  };

  const mockReadyAsset = {
    id: "asset-789",
    ownerId: "user-123",
    objectKey: "proof-assets/user-123/asset-789/original",
    originalFilename: "aws-certificate.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1048576,
    status: "READY",
  };

  it("successfully retrieves published public proof with ready assets and active user", async () => {
    (db.select as any).mockImplementation((fields: any) => {
      // 1. User query
      if (fields?.username) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockActiveUser]),
            }),
          }),
        };
      }
      // 2. Proof query
      if (fields?.proof) {
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    proof: mockPublishedProof,
                    issuerName: "Amazon Web Services",
                  },
                ]),
              }),
            }),
          }),
        };
      }
      // 3. Assets query
      if (fields?.proofAsset) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  {
                    proofAsset: { proofId: "proof-456", assetId: "asset-789", role: "evidence", sortOrder: 0 },
                    asset: mockReadyAsset,
                  },
                ]),
              }),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    const result = await getPublicProof("akshay", "aws-solutions-architect");
    expect(result).not.toBeNull();
    if (!result || result.isRedirect) {
      throw new Error("Expected non-redirect result");
    }

    expect(result.isRedirect).toBe(false);
    expect(result.user.username).toBe("akshay");
    expect(result.user.displayName).toBe("Akshay Patel");
    expect(result.user.avatarUrl).toBe("/api/assets/avatar-asset-1/preview");
    expect(result.proof.slug).toBe("aws-solutions-architect");
    expect(result.proof.issuerDisplayName).toBe("Amazon Web Services");
    expect(result.proof.effectiveStatus).toBe("ISSUER_VERIFIED");
    expect(result.primaryAsset).not.toBeNull();
    expect(result.primaryAsset?.originalFilename).toBe("aws-certificate.pdf");
    expect(result.primaryAsset?.downloadUrl).toBe("/@akshay/aws-solutions-architect/download");
    expect(result.assets).toHaveLength(1);
  });

  it("returns redirect descriptor when handle has been historically renamed", async () => {
    (db.select as any).mockImplementation((fields: any) => {
      // 1. User lookup returns not found
      if (fields?.username) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      }
      // 2. Handle history lookup returns active user
      if (fields?.currentUsername) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { currentUsername: "newhandle", userStatus: "active" },
                ]),
              }),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    const result = await getPublicProof("oldhandle", "aws-solutions-architect");
    expect(result).toEqual({
      isRedirect: true,
      redirectTo: "/@newhandle/aws-solutions-architect",
    });
  });

  it("returns redirect descriptor when proof slug has been historically renamed", async () => {
    (db.select as any).mockImplementation((fields: any) => {
      // 1. User lookup returns active user
      if (fields?.username) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockActiveUser]),
            }),
          }),
        };
      }
      // 2. Proof lookup returns not found
      if (fields?.proof) {
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };
      }
      // 3. Slug history lookup returns current published slug
      if (fields?.currentSlug) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    currentSlug: "new-canonical-slug",
                    lifecycleState: "PUBLISHED",
                    visibility: "public",
                  },
                ]),
              }),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    const result = await getPublicProof("akshay", "old-slug");
    expect(result).toEqual({
      isRedirect: true,
      redirectTo: "/@akshay/new-canonical-slug",
    });
  });

  it("returns null when user is suspended or deleted", async () => {
    (db.select as any).mockImplementation((fields: any) => {
      if (fields?.username) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ ...mockActiveUser, status: "suspended" }]),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    const result = await getPublicProof("akshay", "aws-solutions-architect");
    expect(result).toBeNull();
  });

  it("returns null when proof lifecycleState is DRAFT or ARCHIVED", async () => {
    (db.select as any).mockImplementation((fields: any) => {
      if (fields?.username) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockActiveUser]),
            }),
          }),
        };
      }
      if (fields?.proof) {
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    proof: { ...mockPublishedProof, lifecycleState: "DRAFT" },
                    issuerName: "AWS",
                  },
                ]),
              }),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    const result = await getPublicProof("akshay", "aws-solutions-architect");
    expect(result).toBeNull();
  });

  it("returns null when proof visibility is private", async () => {
    (db.select as any).mockImplementation((fields: any) => {
      if (fields?.username) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockActiveUser]),
            }),
          }),
        };
      }
      if (fields?.proof) {
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    proof: { ...mockPublishedProof, visibility: "private" },
                    issuerName: "AWS",
                  },
                ]),
              }),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    const result = await getPublicProof("akshay", "aws-solutions-architect");
    expect(result).toBeNull();
  });

  it("allows unlisted visibility and derives EXPIRED status if expired", async () => {
    (db.select as any).mockImplementation((fields: any) => {
      if (fields?.username) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockActiveUser]),
            }),
          }),
        };
      }
      if (fields?.proof) {
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    proof: {
                      ...mockPublishedProof,
                      visibility: "unlisted",
                      expiresAt: new Date("2020-01-01T00:00:00Z"),
                    },
                    issuerName: "AWS",
                  },
                ]),
              }),
            }),
          }),
        };
      }
      if (fields?.proofAsset) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    const result = await getPublicProof("akshay", "aws-solutions-architect");
    expect(result).not.toBeNull();
    if (!result || result.isRedirect) {
      throw new Error("Expected non-redirect result");
    }
    expect(result.proof.visibility).toBe("unlisted");
    expect(result.proof.effectiveStatus).toBe("EXPIRED");
  });
});
