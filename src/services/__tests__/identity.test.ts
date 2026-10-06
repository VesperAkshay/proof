/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkHandleAvailability,
  claimHandle,
  IdentityError,
} from "../identity";
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

describe("Identity Service (M2.4, M2.7, M2.8, M2.10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkHandleAvailability", () => {
    it("returns INVALID for malformed usernames without querying DB", async () => {
      const result = await checkHandleAvailability("a");
      expect(result.available).toBe(false);
      expect(result.reason).toBe("INVALID");
      expect(result.suggestions).toEqual([]);
      expect(db.select).not.toHaveBeenCalled();
    });

    it("returns RESERVED with suggestions when handle is on reserved list", async () => {
      let callCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              callCount++;
              if (callCount === 1) {
                return [{ handle: "api" }];
              }
              return [];
            }),
          }),
        }),
      }));

      const result = await checkHandleAvailability("api");
      expect(result.available).toBe(false);
      expect(result.reason).toBe("RESERVED");
      expect(result.username).toBe("api");
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("returns available: true when handle is untaken and unreserved", async () => {
      // Mock reserved lookup returning empty, then users lookup returning empty
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await checkHandleAvailability("akshay");
      expect(result.available).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.suggestions).toEqual([]);
    });
  });

  describe("claimHandle", () => {
    it("rejects invalid handles with 422 HANDLE_INVALID", async () => {
      await expect(
        claimHandle({ authUserId: "user_123", rawUsername: "-invalid" })
      ).rejects.toThrow(IdentityError);

      try {
        await claimHandle({ authUserId: "user_123", rawUsername: "-invalid" });
      } catch (err: any) {
        expect(err.code).toBe("HANDLE_INVALID");
        expect(err.statusCode).toBe(422);
      }
    });

    it("rejects reserved handles with 422 HANDLE_RESERVED", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ reason: "System route" }]),
          }),
        }),
      });

      await expect(
        claimHandle({ authUserId: "user_123", rawUsername: "admin" })
      ).rejects.toThrow(IdentityError);

      try {
        await claimHandle({ authUserId: "user_123", rawUsername: "admin" });
      } catch (err: any) {
        expect(err.code).toBe("HANDLE_RESERVED");
        expect(err.statusCode).toBe(422);
      }
    });

    it("claims valid handle successfully in transaction", async () => {
      // Mock reserved lookup empty
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockCreatedUser = {
        id: "mock-uuid",
        authUserId: "user_123",
        username: "akshay",
        usernameNormalized: "akshay",
        displayName: "akshay",
        status: "active",
      };

      (db.transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockCreatedUser]),
            }),
          }),
        });
      });

      const user = await claimHandle({
        authUserId: "user_123",
        rawUsername: "akshay",
      });

      expect(user).toEqual(mockCreatedUser);
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it("maps database unique violation (23505) to 409 HANDLE_TAKEN", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      (db.transaction as any).mockImplementation(async () => {
        const error: any = new Error("duplicate key value violates unique constraint");
        error.code = "23505";
        throw error;
      });

      await expect(
        claimHandle({ authUserId: "user_123", rawUsername: "akshay" })
      ).rejects.toThrow(IdentityError);

      try {
        await claimHandle({ authUserId: "user_123", rawUsername: "akshay" });
      } catch (err: any) {
        expect(err.code).toBe("HANDLE_TAKEN");
        expect(err.statusCode).toBe(409);
      }
    });
  });
});
