/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createReport,
  listReports,
  resolveReport,
  takedownProof,
  restoreProof,
  suspendUser,
  unsuspendUser,
  detectSpamContent,
  detectSuspiciousAccountActivity,
  TrustError,
} from "../trust";
import { rateLimiter } from "@/lib/ratelimit";
import { db } from "@/db/client";
import { getPublicProfile } from "../profile";
import { getPublicProof } from "../proof";

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

describe("Trust & Abuse System (M13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter.reset();
  });

  describe("Rate Limiting Engine", () => {
    it("allows requests under the threshold", () => {
      const key = "test:user:1";
      for (let i = 0; i < 5; i++) {
        const res = rateLimiter.check(key, 5, 60);
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(5 - (i + 1));
      }
    });

    it("blocks requests once the threshold is exceeded and provides reset seconds", () => {
      const key = "test:user:2";
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key, 3, 60);
      }

      const blocked = rateLimiter.check(key, 3, 60);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetSeconds).toBeGreaterThan(0);
    });

    it("clears buckets when reset() is called", () => {
      const key = "test:user:3";
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key, 3, 60);
      }
      expect(rateLimiter.check(key, 3, 60).allowed).toBe(false);

      rateLimiter.reset();
      expect(rateLimiter.check(key, 3, 60).allowed).toBe(true);
    });
  });

  describe("Spam Detection Heuristics", () => {
    it("detects scam and phishing keywords", () => {
      const text = "Claim your free crypto and free bitcoin now on telegram @freecoins";
      const result = detectSpamContent(text);
      expect(result.isSpam).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("detects high URL density in short content", () => {
      const text = "Links: https://example.com https://spam.org https://promo.net";
      const result = detectSpamContent(text);
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes("Suspicious URL density"))).toBe(true);
    });

    it("detects excessive repeating characters", () => {
      const text = "Check this aaaaaaaaaaaaaaaa out";
      const result = detectSpamContent(text);
      expect(result.reasons.some((r) => r.includes("repeating characters"))).toBe(true);
    });

    it("passes clean and normal professional evidence text", () => {
      const text = "AWS Certified Solutions Architect certificate completed in 2024.";
      const result = detectSpamContent(text);
      expect(result.isSpam).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reasons).toEqual([]);
    });
  });

  describe("Suspicious Activity Detection", () => {
    it("flags account with rapid proof creation velocity", async () => {
      const userId = "u-rapid";
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 15 }]),
        }),
      } as any);

      // open reports mock
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as any);

      // user proofs mock
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await detectSuspiciousAccountActivity(userId);
      expect(result.isSuspicious).toBe(true);
      expect(result.reasons.some((r) => r.includes("High creation velocity"))).toBe(true);
    });

    it("flags account with high open abuse reports threshold", async () => {
      const userId = "u-reported";
      // rapid proofs: normal
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      } as any);

      // profile reports: 2
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      } as any);

      // user proofs: 1 proof
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "p-1" }]),
        }),
      } as any);

      // proof reports: 1
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any);

      const result = await detectSuspiciousAccountActivity(userId);
      expect(result.isSuspicious).toBe(true);
      expect(result.reasons.some((r) => r.includes("Multiple abuse reports"))).toBe(true);
    });
  });

  describe("Abuse Reporting (createReport)", () => {
    it("successfully creates a report for an existing proof", async () => {
      const mockProof = { id: "p-100" };
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProof]),
          }),
        }),
      } as any);

      const insertedReport = {
        id: "rep-1",
        reporterUserId: "u-reporter",
        targetType: "proof",
        targetId: "p-100",
        reason: "copyright",
        details: "Stolen certificate screenshot",
        status: "OPEN",
        handledBy: null,
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedReport]),
        }),
      } as any);

      const report = await createReport({
        reporterUserId: "u-reporter",
        targetType: "proof",
        targetId: "p-100",
        reason: "copyright",
        details: "Stolen certificate screenshot",
      });

      expect(report.id).toBe("rep-1");
      expect(report.targetType).toBe("proof");
      expect(report.status).toBe("OPEN");
    });

    it("successfully creates an impersonation report for a profile", async () => {
      const mockUser = { id: "u-target" };
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      } as any);

      const insertedReport = {
        id: "rep-2",
        reporterUserId: null,
        targetType: "profile",
        targetId: "u-target",
        reason: "impersonation",
        details: "Impersonating Google staff account",
        status: "OPEN",
        handledBy: null,
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedReport]),
        }),
      } as any);

      const report = await createReport({
        targetType: "profile",
        targetId: "u-target",
        reason: "impersonation",
        details: "Impersonating Google staff account",
      });

      expect(report.id).toBe("rep-2");
      expect(report.targetType).toBe("profile");
      expect(report.reason).toBe("impersonation");
    });

    it("throws 404 when target proof does not exist", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(
        createReport({
          targetType: "proof",
          targetId: "p-nonexistent",
          reason: "spam",
        })
      ).rejects.toThrowError(new TrustError("NOT_FOUND", 404, "Target proof not found."));
    });

    it("throws 404 when target profile does not exist", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(
        createReport({
          targetType: "profile",
          targetId: "u-nonexistent",
          reason: "impersonation",
        })
      ).rejects.toThrowError(new TrustError("NOT_FOUND", 404, "Target profile not found."));
    });
  });

  describe("Moderation Queue & Resolution", () => {
    it("lists reports with status filter and count", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any);

      const mockRows = [
        {
          id: "rep-1",
          reporterUserId: null,
          targetType: "proof",
          targetId: "p-1",
          reason: "spam",
          details: null,
          status: "OPEN",
          handledBy: null,
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockRows),
              }),
            }),
          }),
        }),
      } as any);

      const result = await listReports({ status: "OPEN" });
      expect(result.total).toBe(1);
      expect(result.reports.length).toBe(1);
      expect(result.reports[0]?.id).toBe("rep-1");
    });

    it("resolves report to ACTIONED and writes an audit log entry", async () => {
      const existing = {
        id: "rep-1",
        status: "OPEN",
      };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existing]),
          }),
        }),
      } as any);

      const updated = {
        ...existing,
        status: "ACTIONED",
        handledBy: "admin-42",
        createdAt: new Date(),
        reporterUserId: null,
        targetType: "proof",
        targetId: "p-1",
        reason: "copyright",
        details: null,
      };

      let auditEntry: any = null;
      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([updated]),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((val) => {
              auditEntry = val;
              return Promise.resolve();
            }),
          }),
        };
        return callback(tx);
      });

      const res = await resolveReport("rep-1", "ACTIONED", "admin-42");
      expect(res.status).toBe("ACTIONED");
      expect(res.handledBy).toBe("admin-42");
      expect(auditEntry).not.toBeNull();
      expect(auditEntry.action).toBe("REPORT_RESOLVED");
      expect(auditEntry.actorId).toBe("admin-42");
    });
  });

  describe("Takedown & Exit Gate Enforcement", () => {
    it("takes down proof, archives it, sets private, and logs audit record", async () => {
      const mockProof = {
        id: "proof-1",
        lifecycleState: "PUBLISHED",
        visibility: "public",
      };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProof]),
          }),
        }),
      } as any);

      let updatedProofValues: any = null;
      let auditLogValues: any = null;

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockImplementation((val) => {
              updatedProofValues = val;
              return {
                where: vi.fn().mockResolvedValue([{}]),
              };
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((val) => {
              auditLogValues = val;
              return Promise.resolve();
            }),
          }),
        };
        return callback(tx);
      });

      const result = await takedownProof("proof-1", "DMCA copyright infringement", "admin-mod");
      expect(result.success).toBe(true);
      expect(updatedProofValues.lifecycleState).toBe("ARCHIVED");
      expect(updatedProofValues.visibility).toBe("private");
      expect(auditLogValues.action).toBe("PROOF_TAKEDOWN");
      expect(auditLogValues.targetId).toBe("proof-1");
      expect(auditLogValues.metadata.reason).toBe("DMCA copyright infringement");
    });

    it("restores taken-down proof, sets published, and logs audit record", async () => {
      const mockProof = {
        id: "proof-1",
        lifecycleState: "ARCHIVED",
        visibility: "private",
      };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProof]),
          }),
        }),
      } as any);

      let updatedProofValues: any = null;
      let auditLogValues: any = null;

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockImplementation((val) => {
              updatedProofValues = val;
              return {
                where: vi.fn().mockResolvedValue([{}]),
              };
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((val) => {
              auditLogValues = val;
              return Promise.resolve();
            }),
          }),
        };
        return callback(tx);
      });

      const result = await restoreProof("proof-1", "DMCA dispute resolved", "admin-mod");
      expect(result.success).toBe(true);
      expect(updatedProofValues.lifecycleState).toBe("PUBLISHED");
      expect(updatedProofValues.visibility).toBe("public");
      expect(auditLogValues.action).toBe("PROOF_RESTORED");
    });

    it("suspends user, sets status to suspended, and logs audit record", async () => {
      const mockUser = {
        id: "user-1",
        status: "active",
      };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      } as any);

      let updatedUserValues: any = null;
      let auditLogValues: any = null;

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockImplementation((val) => {
              updatedUserValues = val;
              return {
                where: vi.fn().mockResolvedValue([{}]),
              };
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((val) => {
              auditLogValues = val;
              return Promise.resolve();
            }),
          }),
        };
        return callback(tx);
      });

      const result = await suspendUser("user-1", "Multiple terms violations", "admin-mod");
      expect(result.success).toBe(true);
      expect(updatedUserValues.status).toBe("suspended");
      expect(auditLogValues.action).toBe("USER_SUSPENDED");
      expect(auditLogValues.targetId).toBe("user-1");
    });

    it("unsuspends user, sets status to active, and logs audit record", async () => {
      const mockUser = {
        id: "user-1",
        status: "suspended",
      };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      } as any);

      let updatedUserValues: any = null;
      let auditLogValues: any = null;

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockImplementation((val) => {
              updatedUserValues = val;
              return {
                where: vi.fn().mockResolvedValue([{}]),
              };
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((val) => {
              auditLogValues = val;
              return Promise.resolve();
            }),
          }),
        };
        return callback(tx);
      });

      const result = await unsuspendUser("user-1", "Appeal approved", "admin-mod");
      expect(result.success).toBe(true);
      expect(updatedUserValues.status).toBe("active");
      expect(auditLogValues.action).toBe("USER_UNSUSPENDED");
    });
  });

  describe("Exit Gate: Suspended User Pages 404 & Taken-Down Proofs 404", () => {
    it("public profile returns null (404) for suspended user", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "u-suspended",
                username: "badactor",
                usernameNormalized: "badactor",
                status: "suspended",
              },
            ]),
          }),
        }),
      } as any);

      const profile = await getPublicProfile("badactor");
      expect(profile).toBeNull();
    });

    it("public proof returns null (404) when owner is suspended", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "u-suspended",
                username: "badactor",
                status: "suspended",
              },
            ]),
          }),
        }),
      } as any);

      const proof = await getPublicProof("badactor", "any-slug");
      expect(proof).toBeNull();
    });

    it("public proof returns null (404) when proof is taken down (ARCHIVED / private)", async () => {
      // 1. User is active
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "u-active",
                username: "akshay",
                status: "active",
              },
            ]),
          }),
        }),
      } as any);

      // 2. Proof is ARCHIVED and private
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  proof: {
                    id: "p-taken-down",
                    userId: "u-active",
                    slug: "compromised",
                    lifecycleState: "ARCHIVED",
                    visibility: "private",
                  },
                  issuerName: null,
                },
              ]),
            }),
          }),
        }),
      } as any);

      const proof = await getPublicProof("akshay", "compromised");
      expect(proof).toBeNull();
    });
  });
});
