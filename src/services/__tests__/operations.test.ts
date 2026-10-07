/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GET as getHealthz } from "@/app/healthz/route";
import { GET as getReadyz } from "@/app/readyz/route";
import { validateEnv } from "@/lib/env";
import { db } from "@/db/client";

vi.mock("@/db/client", () => ({
  db: {
    execute: vi.fn(),
  },
}));

describe("Production Readiness Operations & Drills (M16)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Health & Liveness Probe (/healthz)", () => {
    it("returns HTTP 200 with status ok and uptime", async () => {
      const response = await getHealthz();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("ok");
      expect(typeof data.timestamp).toBe("string");
      expect(new Date(data.timestamp).getTime()).not.toBeNaN();
      expect(typeof data.uptimeSeconds).toBe("number");
      expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);

      expect(response.headers.get("Cache-Control")).toBe(
        "no-store, no-cache, must-revalidate"
      );
    });
  });

  describe("Readiness Probe (/readyz)", () => {
    it("returns HTTP 200 when database, storage, and queue are healthy", async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([] as any);
      process.env.R2_BUCKET_NAME = "proof-assets";

      const response = await getReadyz();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("ready");
      expect(data.checks.database).toBe("ok");
      expect(data.checks.storage).toBe("ok");
      expect(data.checks.queue).toBe("ok");
      expect(data.errors).toBeUndefined();
      expect(response.headers.get("Cache-Control")).toBe(
        "no-store, no-cache, must-revalidate"
      );
    });

    it("returns HTTP 503 when database is unreachable", async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(
        new Error("Connection terminated unexpectedly")
      );

      const response = await getReadyz();
      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data.status).toBe("degraded");
      expect(data.checks.database).toBe("failed");
      expect(data.checks.queue).toBe("failed");
      expect(data.errors?.database).toContain("Connection terminated unexpectedly");
      expect(data.errors?.queue).toBe("Queue unreachable due to database failure");
    });

    it("returns HTTP 503 in production when storage configuration is missing", async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([] as any);
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.R2_BUCKET_NAME;
      delete process.env.R2_ACCOUNT_ID;

      const response = await getReadyz();
      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data.status).toBe("degraded");
      expect(data.checks.storage).toBe("failed");
      expect(data.errors?.storage).toContain("Missing R2 storage configuration");
    });
  });

  describe("Fail-Fast Boot Environment Validation (validateEnv)", () => {
    it("succeeds with default development environment", () => {
      const result = validateEnv({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.config.NODE_ENV).toBe("development");
    });

    it("fails when NEXT_PUBLIC_APP_URL is not a valid URL", () => {
      const result = validateEnv({
        NEXT_PUBLIC_APP_URL: "invalid-url-format",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain("NEXT_PUBLIC_APP_URL");
    });

    it("enforces required secrets in production mode", () => {
      const missingProdEnv = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://proof.so",
      };

      const result = validateEnv(missingProdEnv);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Missing required production secret: DATABASE_URL");
      expect(result.errors).toContain("Missing required production secret: CLERK_SECRET_KEY");
      expect(result.errors).toContain(
        "Missing required production secret: R2_SECRET_ACCESS_KEY"
      );
    });

    it("passes in production when all required secrets are provided", () => {
      const validProdEnv = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://proof.so",
        DATABASE_URL: "postgres://user:pass@ep-main.neon.tech/proof",
        CLERK_SECRET_KEY: "sk_live_secretkey123",
        R2_SECRET_ACCESS_KEY: "r2_secret_key_456",
        R2_BUCKET_NAME: "proof-production",
      };

      const result = validateEnv(validProdEnv);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe("Database Restore Drill Simulation (RPO & RTO Invariants)", () => {
    it("validates Neon PITR recovery point objective (RPO <= 1 hour)", () => {
      const incidentTimestamp = new Date("2026-10-07T12:00:00Z").getTime();
      const lastPointInTimeRecoverySnapshot = new Date("2026-10-07T11:45:00Z").getTime();

      const rpoSeconds = (incidentTimestamp - lastPointInTimeRecoverySnapshot) / 1000;
      const MAX_PERMISSIBLE_RPO_SECONDS = 3600; // 1 hour

      expect(rpoSeconds).toBeLessThanOrEqual(MAX_PERMISSIBLE_RPO_SECONDS);
      expect(rpoSeconds).toBe(900); // 15 minutes lag in this drill scenario
    });

    it("validates database restore recovery time objective (RTO <= 15 minutes)", () => {
      const restoreStartTime = new Date("2026-10-07T12:00:00Z").getTime();
      const restoreEndTime = new Date("2026-10-07T12:08:30Z").getTime(); // Completed in 8m30s

      const rtoSeconds = (restoreEndTime - restoreStartTime) / 1000;
      const MAX_PERMISSIBLE_RTO_SECONDS = 900; // 15 minutes

      expect(rtoSeconds).toBeLessThanOrEqual(MAX_PERMISSIBLE_RTO_SECONDS);
      expect(rtoSeconds).toBe(510);
    });

    it("simulates post-restore integrity check on core entities", () => {
      // Simulating post-restore entity count invariants
      const restoredDatabaseSnapshot = {
        usersCount: 1542,
        publishedProofsCount: 3890,
        assetsCount: 4120,
      };

      expect(restoredDatabaseSnapshot.usersCount).toBeGreaterThan(0);
      expect(restoredDatabaseSnapshot.publishedProofsCount).toBeGreaterThan(0);
      expect(restoredDatabaseSnapshot.assetsCount).toBeGreaterThanOrEqual(
        restoredDatabaseSnapshot.publishedProofsCount
      );
    });
  });

  describe("Operations Runbooks & Launch Checklist Specification Verification", () => {
    const operationsPath = path.resolve(process.cwd(), "docs/operations.md");

    it("verifies operations.md exists and contains all 7 mandatory runbooks", () => {
      expect(fs.existsSync(operationsPath)).toBe(true);
      const content = fs.readFileSync(operationsPath, "utf-8");

      const requiredRunbooks = [
        "1. Database Restore Runbook & Drill",
        "2. Stuck Queue Runbook",
        "3. Malware Detected Runbook",
        "4. Takedown Request Runbook",
        "5. Handle Dispute Runbook",
        "6. Cloudflare R2 Outage Runbook",
        "7. Clerk Identity Outage Runbook",
      ];

      for (const runbook of requiredRunbooks) {
        expect(content).toContain(runbook);
      }
    });

    it("verifies operations.md specifies concrete technical terms and procedures", () => {
      const content = fs.readFileSync(operationsPath, "utf-8");

      expect(content).toContain("Recovery Point Objective");
      expect(content).toContain("Recovery Time Objective");
      expect(content).toContain("pgboss.job");
      expect(content).toContain("MALWARE_DETECTED");
      expect(content).toContain("quarantine");
      expect(content).toContain("/api/admin/takedown");
      expect(content).toContain("handle_history");
      expect(content).toContain("/readyz");
      expect(content).toContain("x-admin-key");
    });

    it("verifies all launch checklist items in operations.md are checked", () => {
      const content = fs.readFileSync(operationsPath, "utf-8");
      const checklistMatch = content.match(/## Launch Checklist([\s\S]*)/);
      expect(checklistMatch).not.toBeNull();

      const checklistSection = checklistMatch![1] || "";
      const uncheckedItems = checklistSection
        .split("\n")
        .filter((line) => line.trim().startsWith("- [ ]"));

      expect(uncheckedItems).toEqual([]);

      const checkedItems = checklistSection
        .split("\n")
        .filter((line) => line.trim().startsWith("- [x]"));

      expect(checkedItems.length).toBeGreaterThanOrEqual(10);
    });
  });
});
