/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getEffectiveVerificationStatus,
  getPublicProfile,
} from "../profile";
import { db } from "@/db/client";

vi.mock("@/db/client", () => {
  return {
    db: {
      select: vi.fn(),
    },
  };
});

describe("Profile Service (M3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEffectiveVerificationStatus", () => {
    const fixedNow = new Date("2026-10-06T12:00:00Z");

    it("returns REVOKED even if credential is also expired", () => {
      const past = new Date("2025-01-01T00:00:00Z");
      expect(getEffectiveVerificationStatus("REVOKED", past, fixedNow)).toBe("REVOKED");
    });

    it("derives EXPIRED when current date is past expiresAt", () => {
      const past = new Date("2026-10-01T00:00:00Z");
      expect(getEffectiveVerificationStatus("ISSUER_VERIFIED", past, fixedNow)).toBe("EXPIRED");
    });

    it("preserves verificationStatus when credential is not expired", () => {
      const future = new Date("2027-01-01T00:00:00Z");
      expect(getEffectiveVerificationStatus("ISSUER_VERIFIED", future, fixedNow)).toBe("ISSUER_VERIFIED");
      expect(getEffectiveVerificationStatus("SELF_REPORTED", null, fixedNow)).toBe("SELF_REPORTED");
      expect(getEffectiveVerificationStatus("DOCUMENT_UPLOADED", future, fixedNow)).toBe("DOCUMENT_UPLOADED");
    });
  });

  describe("getPublicProfile", () => {
    it("returns null when user does not exist and no handle history exists", async () => {
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              return [];
            }),
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(async () => {
                return [];
              }),
            }),
          }),
        }),
      }));

      const profile = await getPublicProfile("nonexistent");
      expect(profile).toBeNull();
    });

    it("returns 301 redirect descriptor when handle is found in handle_history", async () => {
      let callCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              callCount++;
              if (callCount === 1) {
                return []; // not in users
              }
              return [];
            }),
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(async () => {
                return [
                  {
                    currentUsername: "newhandle",
                    userStatus: "active",
                  },
                ];
              }),
            }),
          }),
        }),
      }));

      const result = await getPublicProfile("oldhandle");
      expect(result).toEqual({
        isRedirect: true,
        redirectTo: "newhandle",
      });
    });

    it("returns null if handle history entry belongs to a suspended/deleted user", async () => {
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  currentUsername: "newhandle",
                  userStatus: "suspended",
                },
              ]),
            }),
          }),
        }),
      }));

      const result = await getPublicProfile("oldhandle");
      expect(result).toBeNull();
    });

    it("returns null when user is suspended or deleted", async () => {
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "uuid-1",
                username: "badactor",
                usernameNormalized: "badactor",
                status: "suspended",
              },
            ]),
          }),
        }),
      }));

      const result = await getPublicProfile("badactor");
      expect(result).toBeNull();
    });

    it("returns active user with sorted published proofs and avatar", async () => {
      const mockUser = {
        id: "user-123",
        username: "akshay",
        usernameNormalized: "akshay",
        displayName: "Akshay Patel",
        bio: "Systems Engineer. https://github.com/akshay",
        avatarAssetId: "asset-1",
        status: "active",
        createdAt: new Date("2026-01-01"),
      };

      const mockAsset = {
        id: "asset-1",
        status: "READY",
      };

      const mockProofs = [
        {
          id: "proof-1",
          slug: "aws-csa",
          title: "AWS Solutions Architect",
          description: "Cloud architecture",
          proofType: "certificate",
          issuerNameText: null,
          issuedAt: new Date("2026-05-01"),
          expiresAt: new Date("2029-05-01"),
          verificationStatus: "ISSUER_VERIFIED",
          sortOrder: 0,
          publishedAt: new Date("2026-05-01"),
          issuerName: "Amazon Web Services",
        },
        {
          id: "proof-2",
          slug: "dist-systems",
          title: "Distributed Systems Paper",
          description: "Consensus protocols",
          proofType: "publication",
          issuerNameText: "ACM",
          issuedAt: new Date("2025-01-01"),
          expiresAt: new Date("2025-06-01"), // Past -> should derive EXPIRED
          verificationStatus: "DOCUMENT_UPLOADED",
          sortOrder: 1,
          publishedAt: new Date("2025-01-01"),
          issuerName: null,
        },
      ];

      let queryIndex = 0;
      (db.select as any).mockImplementation(() => {
        queryIndex++;
        const currentQuery = queryIndex;

        return {
          from: vi.fn().mockImplementation((_table: any) => {
            // First query: users
            if (currentQuery === 1) {
              return {
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockUser]),
                }),
              };
            }
            // Second query: assets (for avatar)
            if (currentQuery === 2) {
              return {
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockAsset]),
                }),
              };
            }
            // Third query: proofs with leftJoin on issuers
            return {
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockProofs),
                }),
              }),
            };
          }),
        };
      });

      const result = await getPublicProfile("akshay");
      expect(result).not.toBeNull();
      if (!result || result.isRedirect) {
        throw new Error("Expected public profile");
      }

      expect(result.user.username).toBe("akshay");
      expect(result.user.displayName).toBe("Akshay Patel");
      expect(result.user.avatarUrl).toBe("/api/assets/asset-1/view");
      expect(result.proofs.length).toBe(2);

      const [firstProof, secondProof] = result.proofs;
      expect(firstProof).toBeDefined();
      expect(secondProof).toBeDefined();

      if (!firstProof || !secondProof) {
        throw new Error("Proofs should be defined");
      }

      // Check first proof: ISSUER_VERIFIED
      expect(firstProof.title).toBe("AWS Solutions Architect");
      expect(firstProof.issuerDisplayName).toBe("Amazon Web Services");
      expect(firstProof.effectiveStatus).toBe("ISSUER_VERIFIED");

      // Check second proof: derived EXPIRED
      expect(secondProof.title).toBe("Distributed Systems Paper");
      expect(secondProof.issuerDisplayName).toBe("ACM");
      expect(secondProof.effectiveStatus).toBe("EXPIRED");
    });
  });
});
