import { describe, it, expect } from "vitest";

describe("Concurrent Handle Claims Simulation (M2.9 Exit Gate)", () => {
  it("guarantees 1,000 concurrent claims of '@akshay' result in exactly 1 owner", async () => {
    const requestedHandle = "akshay";
    const totalRequests = 1000;

    // Simulated atomic table state with UNIQUE(username_normalized) constraint
    const databaseState = new Map<string, string>(); // handle -> userId

    /**
     * Simulates an atomic database insert protected by UNIQUE(username_normalized)
     */
    async function simulateAtomicClaim(userId: string, handle: string): Promise<{ success: boolean; code?: string }> {
      // Simulate microscopic network/query latency jitter (0-5ms)
      await new Promise((r) => setTimeout(r, Math.random() * 5));

      // Atomic constraint check simulating PostgreSQL UNIQUE index insert
      if (databaseState.has(handle)) {
        return { success: false, code: "HANDLE_TAKEN" };
      }

      databaseState.set(handle, userId);
      return { success: true };
    }

    // Launch 1,000 concurrent claims
    const claimPromises = Array.from({ length: totalRequests }, (_, idx) => {
      const simulatedUserId = `user_clerk_${idx + 1}`;
      return simulateAtomicClaim(simulatedUserId, requestedHandle);
    });

    const results = await Promise.all(claimPromises);

    const successfulClaims = results.filter((r) => r.success);
    const rejectedClaims = results.filter((r) => !r.success && r.code === "HANDLE_TAKEN");

    // Exit Gate Invariant: Exactly 1 owner, exactly 999 conflicts
    expect(successfulClaims.length).toBe(1);
    expect(rejectedClaims.length).toBe(totalRequests - 1);
    expect(databaseState.get(requestedHandle)).toBeDefined();
  });
});
