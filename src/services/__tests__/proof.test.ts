/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createProof,
  getProofById,
  listProofsForUser,
  updateProof,
  deleteProof,
  transitionLifecycle,
  changeProofSlug,
  reorderProofs,
  ProofError,
} from "../proof";
import { db } from "@/db/client";

vi.mock("@/db/client", () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

describe("Proof Service (M4)", () => {
  const userId = "user-123";
  const proofId = "proof-abc";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createProof", () => {
    it("creates proof in DRAFT state with generated slug from title", async () => {
      // isSlugTaken returns false
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const mockInserted = {
        id: proofId,
        userId,
        slug: "aws-certified-solutions-architect",
        title: "AWS Certified Solutions Architect",
        description: "Cloud computing credential",
        proofType: "certificate",
        issuerId: null,
        issuerNameText: null,
        issuedAt: new Date("2026-01-01"),
        expiresAt: new Date("2029-01-01"),
        credentialId: "AWS-991",
        credentialUrl: "https://aws.amazon.com/verify",
        lifecycleState: "DRAFT",
        visibility: "private",
        verificationStatus: "SELF_REPORTED",
        sortOrder: 0,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInserted]),
        }),
      });

      const result = await createProof(userId, {
        title: "AWS Certified Solutions Architect",
        proofType: "certificate",
        description: "Cloud computing credential",
        credentialId: "AWS-991",
        credentialUrl: "https://aws.amazon.com/verify",
        visibility: "private",
      });

      expect(result.id).toBe(proofId);
      expect(result.slug).toBe("aws-certified-solutions-architect");
      expect(result.lifecycleState).toBe("DRAFT");
      expect(result.verificationStatus).toBe("SELF_REPORTED");
      expect(result.effectiveStatus).toBe("SELF_REPORTED");
    });

    it("sets ISSUER_REFERENCED if issuerNameText is provided", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      let insertedValues: any = null;
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          insertedValues = val;
          return {
            returning: vi.fn().mockResolvedValue([
              {
                ...val,
                id: proofId,
                publishedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          };
        }),
      });

      const result = await createProof(userId, {
        title: "Certified Kubernetes Administrator",
        proofType: "certificate",
        issuerNameText: "Linux Foundation",
        visibility: "public",
      });

      expect(insertedValues.verificationStatus).toBe("ISSUER_REFERENCED");
      expect(result.verificationStatus).toBe("ISSUER_REFERENCED");
    });

    it("throws 409 SLUG_TAKEN with suggestions if user-specified slug conflicts", async () => {
      // isSlugTaken returns true on first query
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "existing-proof-id" }]),
          }),
        }),
      });

      await expect(
        createProof(userId, {
          title: "My Proof",
          proofType: "project",
          slug: "my-proof",
          visibility: "private",
        })
      ).rejects.toThrowError(ProofError);

      try {
        await createProof(userId, {
          title: "My Proof",
          proofType: "project",
          slug: "my-proof",
          visibility: "private",
        });
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe("SLUG_TAKEN");
        expect(err.suggestions).toEqual(["my-proof-2", "my-proof-3", "my-proof-4"]);
      }
    });
  });

  describe("getProofById & anti-IDOR", () => {
    it("returns proof if owned by authenticated user", async () => {
      const mockProof = {
        id: proofId,
        userId,
        slug: "my-proof",
        title: "My Proof",
        description: null,
        proofType: "project",
        issuerId: null,
        issuerNameText: null,
        issuedAt: null,
        expiresAt: null,
        credentialId: null,
        credentialUrl: null,
        lifecycleState: "DRAFT",
        visibility: "private",
        verificationStatus: "SELF_REPORTED",
        sortOrder: 0,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ proof: mockProof, issuerName: null }]),
            }),
          }),
        }),
      });

      const result = await getProofById(proofId, userId);
      expect(result.id).toBe(proofId);
      expect(result.userId).toBe(userId);
    });

    it("throws 404 NOT_FOUND if proof belongs to another user (IDOR protection)", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No record matching (id AND userId)
            }),
          }),
        }),
      });

      await expect(getProofById(proofId, "attacker-user-id")).rejects.toThrowError(
        ProofError
      );
      try {
        await getProofById(proofId, "attacker-user-id");
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("listProofsForUser", () => {
    it("returns all proofs for user ordered by sort_order", async () => {
      const mockRows = [
        {
          proof: {
            id: "p1",
            userId,
            slug: "proof-1",
            title: "Proof 1",
            description: null,
            proofType: "award",
            issuerId: null,
            issuerNameText: null,
            issuedAt: null,
            expiresAt: null,
            credentialId: null,
            credentialUrl: null,
            lifecycleState: "PUBLISHED",
            visibility: "public",
            verificationStatus: "SELF_REPORTED",
            sortOrder: 0,
            publishedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          issuerName: null,
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockRows),
            }),
          }),
        }),
      });

      const list = await listProofsForUser(userId);
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe("p1");
    });
  });

  describe("updateProof & deleteProof", () => {
    it("updates proof metadata and adjusts verificationStatus if issuer added", async () => {
      const existingProof = {
        id: proofId,
        userId,
        title: "Old Title",
        issuerNameText: null,
        issuerId: null,
        verificationStatus: "SELF_REPORTED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingProof]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                ...existingProof,
                title: "New Title",
                issuerNameText: "Issuer Org",
                verificationStatus: "ISSUER_REFERENCED",
                slug: "proof-slug",
                proofType: "award",
                visibility: "public",
                sortOrder: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const updated = await updateProof(proofId, userId, {
        title: "New Title",
        issuerNameText: "Issuer Org",
      });

      expect(updated.title).toBe("New Title");
      expect(updated.verificationStatus).toBe("ISSUER_REFERENCED");
    });

    it("deletes proof when owned by user", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: proofId }]),
          }),
        }),
      });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await expect(deleteProof(proofId, userId)).resolves.not.toThrow();
    });
  });

  describe("transitionLifecycle (State Machine)", () => {
    it("transitions DRAFT -> PUBLISHED and stamps publishedAt", async () => {
      const existingProof = {
        id: proofId,
        userId,
        lifecycleState: "DRAFT",
        verificationStatus: "SELF_REPORTED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingProof]),
          }),
        }),
      });

      let updatedFields: any = null;
      (db.update as any).mockReturnValue({
        set: vi.fn().mockImplementation((fields) => {
          updatedFields = fields;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  ...existingProof,
                  ...fields,
                  slug: "my-proof",
                  title: "My Proof",
                  proofType: "award",
                  visibility: "public",
                  sortOrder: 0,
                  createdAt: new Date(),
                },
              ]),
            }),
          };
        }),
      });

      const result = await transitionLifecycle(proofId, userId, "PUBLISHED");
      expect(result.lifecycleState).toBe("PUBLISHED");
      expect(updatedFields.lifecycleState).toBe("PUBLISHED");
      expect(updatedFields.publishedAt).toBeInstanceOf(Date);
    });

    it("transitions PUBLISHED -> DRAFT (unpublish)", async () => {
      const existingProof = {
        id: proofId,
        userId,
        lifecycleState: "PUBLISHED",
        verificationStatus: "SELF_REPORTED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingProof]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                ...existingProof,
                lifecycleState: "DRAFT",
                slug: "my-proof",
                title: "My Proof",
                proofType: "award",
                visibility: "public",
                sortOrder: 0,
                createdAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const result = await transitionLifecycle(proofId, userId, "DRAFT");
      expect(result.lifecycleState).toBe("DRAFT");
    });

    it("rejects illegal transitions with 409 ILLEGAL_TRANSITION", async () => {
      const existingProof = {
        id: proofId,
        userId,
        lifecycleState: "ARCHIVED",
        verificationStatus: "SELF_REPORTED",
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingProof]),
          }),
        }),
      });

      // ARCHIVED cannot transition to an invalid state
      await expect(
        transitionLifecycle(proofId, userId, "UNKNOWN" as any)
      ).rejects.toThrowError(ProofError);

      try {
        await transitionLifecycle(proofId, userId, "UNKNOWN" as any);
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe("ILLEGAL_TRANSITION");
      }
    });
  });

  describe("changeProofSlug & Slug History", () => {
    it("records old slug in proof_slug_history when slug changes", async () => {
      const existingProof = {
        id: proofId,
        userId,
        slug: "old-slug",
        title: "Title",
        proofType: "certificate",
        lifecycleState: "DRAFT",
        verificationStatus: "SELF_REPORTED",
        visibility: "private",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 1. Fetch existing proof
      // 2. Check collision for new slug (none found)
      let selectCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCount++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(async () => {
                if (selectCount === 1) return [existingProof];
                return []; // not taken
              }),
            }),
          }),
        };
      });

      let insertedHistory: any = null;
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((val) => {
              insertedHistory = val;
              return Promise.resolve();
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  {
                    ...existingProof,
                    slug: "new-slug",
                  },
                ]),
              }),
            }),
          }),
        };
        return await callback(tx);
      });

      const result = await changeProofSlug(proofId, userId, "new-slug");
      expect(result.slug).toBe("new-slug");
      expect(insertedHistory).toEqual({
        proofId,
        userId,
        slug: "old-slug",
      });
    });

    it("rejects slug change with 409 if new slug is taken in history", async () => {
      const existingProof = {
        id: proofId,
        userId,
        slug: "current-slug",
      };

      let selectCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCount++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(async () => {
                if (selectCount === 1) return [existingProof];
                if (selectCount === 2) return []; // not in proofs
                return [{ id: "history-id" }]; // in history!
              }),
            }),
          }),
        };
      });

      await expect(changeProofSlug(proofId, userId, "taken-slug")).rejects.toThrowError(
        ProofError
      );

      try {
        await changeProofSlug(proofId, userId, "taken-slug");
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe("SLUG_TAKEN");
        expect(err.suggestions?.length).toBeGreaterThan(0);
      }
    });
  });

  describe("reorderProofs", () => {
    it("updates sort_order sequentially for user's proofs", async () => {
      const p1 = "11111111-1111-1111-1111-111111111111";
      const p2 = "22222222-2222-2222-2222-222222222222";

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: p1 }, { id: p2 }]),
        }),
      });

      const updatedOrders: Array<{ id: string; sortOrder: number }> = [];
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockImplementation((val) => {
              return {
                where: vi.fn().mockImplementation(() => {
                  updatedOrders.push({ id: val.id, sortOrder: val.sortOrder });
                  return Promise.resolve();
                }),
              };
            }),
          }),
        };
        return await callback(tx);
      });

      await reorderProofs(userId, [p2, p1]);
      expect(db.transaction).toHaveBeenCalled();
    });

    it("rejects reordering if one or more proofs do not belong to user", async () => {
      const p1 = "11111111-1111-1111-1111-111111111111";
      const p2 = "22222222-2222-2222-2222-222222222222";

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: p1 }]), // p2 is missing / not owned
        }),
      });

      await expect(reorderProofs(userId, [p1, p2])).rejects.toThrowError(ProofError);
    });
  });
});
