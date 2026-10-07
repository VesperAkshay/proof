/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getReports } from "../reports/route";
import { PATCH as patchReport } from "../reports/[id]/route";
import { POST as postTakedown } from "../takedown/route";
import { POST as postSuspend } from "../suspend/route";
import { POST as postUnsuspend } from "../unsuspend/route";
import { POST as postRestore } from "../restore/route";
import * as trustService from "@/services/trust";
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

vi.mock("@/services/trust", () => ({
  listReports: vi.fn(),
  resolveReport: vi.fn(),
  takedownProof: vi.fn(),
  restoreProof: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  TrustError: class TrustError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, statusCode: number, message: string) {
      super(message);
      this.name = "TrustError";
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

describe("Admin Moderation Endpoints (M13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validAdminHeaders = {
    "x-admin-key": "proof-admin-secret",
    "x-admin-actor-id": "admin-101",
  };

  describe("GET /api/admin/reports", () => {
    it("rejects unauthorized requests with 403 FORBIDDEN", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);
      const req = new NextRequest("https://proof.so/api/admin/reports");
      const res = await getReports(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("allows access with valid admin key and returns reports list", async () => {
      vi.mocked(trustService.listReports).mockResolvedValue({
        reports: [{ id: "rep-1" } as any],
        total: 1,
      });

      const req = new NextRequest("https://proof.so/api/admin/reports?status=OPEN", {
        headers: validAdminHeaders,
      });

      const res = await getReports(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(data.reports[0].id).toBe("rep-1");
    });
  });

  describe("PATCH /api/admin/reports/[id]", () => {
    it("rejects unauthorized requests with 403", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);
      const req = new NextRequest("https://proof.so/api/admin/reports/rep-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIONED" }),
      });
      const res = await patchReport(req, { params: Promise.resolve({ id: "rep-1" }) });
      expect(res.status).toBe(403);
    });

    it("resolves report status with valid admin key", async () => {
      vi.mocked(trustService.resolveReport).mockResolvedValue({
        id: "rep-1",
        status: "ACTIONED",
      } as any);

      const req = new NextRequest("https://proof.so/api/admin/reports/rep-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...validAdminHeaders,
        },
        body: JSON.stringify({ status: "ACTIONED" }),
      });

      const res = await patchReport(req, { params: Promise.resolve({ id: "rep-1" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.report.status).toBe("ACTIONED");
      expect(trustService.resolveReport).toHaveBeenCalledWith("rep-1", "ACTIONED", "admin-101");
    });
  });

  describe("POST /api/admin/takedown", () => {
    it("takes down proof and returns success", async () => {
      vi.mocked(trustService.takedownProof).mockResolvedValue({
        success: true,
        proofId: "00000000-0000-0000-0000-000000000001",
      });

      const req = new NextRequest("https://proof.so/api/admin/takedown", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...validAdminHeaders,
        },
        body: JSON.stringify({
          proofId: "00000000-0000-0000-0000-000000000001",
          reason: "Violates intellectual property policies",
        }),
      });

      const res = await postTakedown(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(trustService.takedownProof).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "Violates intellectual property policies",
        "admin-101"
      );
    });
  });

  describe("POST /api/admin/suspend", () => {
    it("suspends user account and returns success", async () => {
      vi.mocked(trustService.suspendUser).mockResolvedValue({
        success: true,
        userId: "00000000-0000-0000-0000-000000000002",
      });

      const req = new NextRequest("https://proof.so/api/admin/suspend", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...validAdminHeaders,
        },
        body: JSON.stringify({
          userId: "00000000-0000-0000-0000-000000000002",
          reason: "Repeated phishing attempts",
        }),
      });

      const res = await postSuspend(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(trustService.suspendUser).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        "Repeated phishing attempts",
        "admin-101"
      );
    });
  });

  describe("POST /api/admin/unsuspend", () => {
    it("unsuspends user account and returns success", async () => {
      vi.mocked(trustService.unsuspendUser).mockResolvedValue({
        success: true,
        userId: "00000000-0000-0000-0000-000000000002",
      });

      const req = new NextRequest("https://proof.so/api/admin/unsuspend", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...validAdminHeaders,
        },
        body: JSON.stringify({
          userId: "00000000-0000-0000-0000-000000000002",
          reason: "Suspension appeal approved",
        }),
      });

      const res = await postUnsuspend(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(trustService.unsuspendUser).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        "Suspension appeal approved",
        "admin-101"
      );
    });
  });

  describe("POST /api/admin/restore", () => {
    it("restores taken-down proof and returns success", async () => {
      vi.mocked(trustService.restoreProof).mockResolvedValue({
        success: true,
        proofId: "00000000-0000-0000-0000-000000000001",
      });

      const req = new NextRequest("https://proof.so/api/admin/restore", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...validAdminHeaders,
        },
        body: JSON.stringify({
          proofId: "00000000-0000-0000-0000-000000000001",
          reason: "Copyright counter-notice accepted",
        }),
      });

      const res = await postRestore(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(trustService.restoreProof).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "Copyright counter-notice accepted",
        "admin-101"
      );
    });
  });
});
