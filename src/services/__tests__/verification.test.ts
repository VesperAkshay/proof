/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createIssuer,
  confirmVerification,
  revokeVerification,
  getVerificationAuditTrail,
  VerificationError,
} from "../verification";
import { db } from "@/db/client";
import { createProof } from "../proof";
import { createProofSchema, updateProofSchema } from "@/lib/validations/proof";
import { getEffectiveVerificationStatus } from "../profile";

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

describe("Verification Architecture (M8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProof = {
    id: "proof-100",
    userId: "user-100",
    slug: "cfa-charterholder",
    title: "CFA Charter",
    description: "Chartered Financial Analyst",
    proofType: "certificate",
    issuerId: "issuer-1",
    issuerNameText: "CFA Institute",
    issuedAt: new Date("2023-01-01T00:00:00Z"),
    expiresAt: new Date("2024-01-01T00:00:00Z"), // Expired
    credentialId: "CFA-8888",
    credentialUrl: "https://cfainstitute.org/verify",
    lifecycleState: "PUBLISHED",
    visibility: "public",
    verificationStatus: "ISSUER_REFERENCED",
    sortOrder: 0,
    publishedAt: new Date("2023-01-02T00:00:00Z"),
    createdAt: new Date("2023-01-01T00:00:00Z"),
    updatedAt: new Date("2023-01-02T00:00:00Z"),
  };

  describe("Exit Gate Invariant: User claiming an issuer can NEVER set ISSUER_VERIFIED", () => {
    it("sets status to ISSUER_REFERENCED when owner names an issuer, never ISSUER_VERIFIED", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const insertedRow = {
        ...mockProof,
        verificationStatus: "ISSUER_REFERENCED",
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockImplementation((val: any) => {
          expect(val.verificationStatus).toBe("ISSUER_REFERENCED");
          expect(val.verificationStatus).not.toBe("ISSUER_VERIFIED");
          return {
            returning: vi.fn().mockResolvedValue([insertedRow]),
          };
        }),
      });

      const res = await createProof("user-100", {
        title: "CFA Charter",
        proofType: "certificate",
        issuerNameText: "CFA Institute",
        visibility: "public",
      });

      expect(res.verificationStatus).toBe("ISSUER_REFERENCED");
    });

    it("sets status to SELF_REPORTED when owner does not supply issuer, never ISSUER_VERIFIED", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const insertedRow = {
        ...mockProof,
        issuerNameText: null,
        verificationStatus: "SELF_REPORTED",
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockImplementation((val: any) => {
          expect(val.verificationStatus).toBe("SELF_REPORTED");
          expect(val.verificationStatus).not.toBe("ISSUER_VERIFIED");
          return {
            returning: vi.fn().mockResolvedValue([insertedRow]),
          };
        }),
      });

      const res = await createProof("user-100", {
        title: "Independent Project",
        proofType: "project",
        visibility: "public",
      });

      expect(res.verificationStatus).toBe("SELF_REPORTED");
    });

    it("rejects mass-assignment attempts to inject verificationStatus in create schema", () => {
      const maliciousPayload = {
        title: "Hacked Credential",
        proofType: "certificate",
        verificationStatus: "ISSUER_VERIFIED", // Hostile field injection
      };

      const parsed = createProofSchema.safeParse(maliciousPayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toMatch(/Unknown fields are forbidden/i);
      }
    });

    it("rejects mass-assignment attempts to inject verificationStatus in update schema", () => {
      const maliciousPayload = {
        verificationStatus: "ISSUER_VERIFIED",
      };

      const parsed = updateProofSchema.safeParse(maliciousPayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toMatch(/Unknown fields are forbidden/i);
      }
    });

    it("rejects confirmation when actorType is 'owner'", async () => {
      await expect(
        confirmVerification({
          proofId: "proof-100",
          method: "issuer_url",
          actorType: "owner" as any,
          actorId: "user-100",
        })
      ).rejects.toThrow(VerificationError);
    });
  });

  describe("Exit Gate Invariant: REVOKED overrides display even over expired status", () => {
    it("returns REVOKED for an expired credential if verificationStatus is REVOKED", () => {
      const pastExpiry = new Date("2020-01-01T00:00:00Z");
      const effective = getEffectiveVerificationStatus("REVOKED", pastExpiry);
      expect(effective).toBe("REVOKED");
    });

    it("derives EXPIRED for an expired credential only if not revoked", () => {
      const pastExpiry = new Date("2020-01-01T00:00:00Z");
      const effective = getEffectiveVerificationStatus("ISSUER_VERIFIED", pastExpiry);
      expect(effective).toBe("EXPIRED");
    });
  });

  describe("Authorized Verification Flow & Audit Trail Invariant", () => {
    it("confirms verification as admin, creates verification_records row and audit log row", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProof]),
          }),
        }),
      });

      const updatedRow = {
        ...mockProof,
        verificationStatus: "ISSUER_VERIFIED",
      };

      let insertedRecord: any = null;
      let insertedAudit: any = null;

      (db.transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([updatedRow]),
              }),
            }),
          }),
          insert: vi.fn().mockImplementation((_table: any) => ({
            values: vi.fn().mockImplementation((val: any) => {
              if (!insertedRecord) {
                insertedRecord = val;
              } else {
                insertedAudit = val;
              }
              return Promise.resolve();
            }),
          })),
        };
        return await cb(tx);
      });

      const res = await confirmVerification({
        proofId: "proof-100",
        method: "issuer_url",
        externalUrl: "https://cfainstitute.org/verify/8888",
        evidence: { verifiedBy: "admin@proof.so" },
        actorType: "admin",
        actorId: "admin-1",
        reason: "Manual audit approved",
      });

      expect(res.verificationStatus).toBe("ISSUER_VERIFIED");
      expect(insertedRecord).not.toBeNull();
      expect(insertedRecord.method).toBe("issuer_url");
      expect(insertedRecord.status).toBe("CONFIRMED");

      expect(insertedAudit).not.toBeNull();
      expect(insertedAudit.fromStatus).toBe("ISSUER_REFERENCED");
      expect(insertedAudit.toStatus).toBe("ISSUER_VERIFIED");
      expect(insertedAudit.actorType).toBe("admin");
      expect(insertedAudit.reason).toBe("Manual audit approved");
    });

    it("revokes verification as issuer, updates records and appends audit event", async () => {
      const verifiedProof = {
        ...mockProof,
        verificationStatus: "ISSUER_VERIFIED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([verifiedProof]),
          }),
        }),
      });

      const revokedRow = {
        ...mockProof,
        verificationStatus: "REVOKED",
      };

      let insertedAudit: any = null;

      (db.transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([revokedRow]),
              }),
            }),
          }),
          insert: vi.fn().mockImplementation((_table: any) => ({
            values: vi.fn().mockImplementation((val: any) => {
              insertedAudit = val;
              return Promise.resolve();
            }),
          })),
        };
        return await cb(tx);
      });

      const res = await revokeVerification({
        proofId: "proof-100",
        actorType: "issuer",
        actorId: "cfa-institute",
        reason: "Credential revoked by issuing body",
      });

      expect(res.verificationStatus).toBe("REVOKED");
      expect(insertedAudit.fromStatus).toBe("ISSUER_VERIFIED");
      expect(insertedAudit.toStatus).toBe("REVOKED");
      expect(insertedAudit.actorType).toBe("issuer");
      expect(insertedAudit.reason).toBe("Credential revoked by issuing body");
    });

    it("retrieves the append-only audit trail ordered by createdAt DESC", async () => {
      const mockAuditEvents = [
        {
          id: "event-2",
          proofId: "proof-100",
          fromStatus: "ISSUER_VERIFIED",
          toStatus: "REVOKED",
          actorType: "admin",
          actorId: "admin-1",
          reason: "Takedown",
          createdAt: new Date("2024-02-01"),
        },
        {
          id: "event-1",
          proofId: "proof-100",
          fromStatus: "ISSUER_REFERENCED",
          toStatus: "ISSUER_VERIFIED",
          actorType: "system",
          actorId: "api",
          reason: "Confirmed",
          createdAt: new Date("2024-01-01"),
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAuditEvents),
          }),
        }),
      });

      const trail = await getVerificationAuditTrail("proof-100");
      expect(trail).toHaveLength(2);
      expect(trail[0]?.toStatus).toBe("REVOKED");
    });
  });

  describe("Issuer Management", () => {
    it("creates an issuer record with trimmed name", async () => {
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "issuer-123",
              name: "Coursera",
              domain: "coursera.org",
              status: "active",
            },
          ]),
        }),
      });

      const res = await createIssuer({
        name: "  Coursera  ",
        domain: "coursera.org",
      });

      expect(res.name).toBe("Coursera");
    });

    it("rejects blank issuer name", async () => {
      await expect(createIssuer({ name: "   " })).rejects.toThrow(VerificationError);
    });
  });
});
