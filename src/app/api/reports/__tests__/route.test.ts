/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import * as trustService from "@/services/trust";
import * as identityService from "@/services/identity";
import { auth } from "@clerk/nextjs/server";
import { rateLimiter } from "@/lib/ratelimit";
import { NextRequest } from "next/server";

vi.mock("@/services/trust", () => ({
  createReport: vi.fn(),
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

vi.mock("@/services/identity", () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

describe("POST /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter.reset();
  });

  function createRequest(body: any, headers: Record<string, string> = {}) {
    return new NextRequest("https://proof.so/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.1",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  it("successfully creates a report anonymously and returns 201", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);
    const mockReport = {
      id: "rep-100",
      reporterUserId: null,
      targetType: "proof",
      targetId: "00000000-0000-0000-0000-000000000001",
      reason: "spam",
      details: "Spam advertisement",
      status: "OPEN",
      handledBy: null,
      createdAt: new Date(),
    };
    vi.mocked(trustService.createReport).mockResolvedValue(mockReport);

    const req = createRequest({
      targetType: "proof",
      targetId: "00000000-0000-0000-0000-000000000001",
      reason: "spam",
      details: "Spam advertisement",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.report.id).toBe("rep-100");
  });

  it("links authenticated user profile as reporter", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_user_1" } as any);
    vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
      id: "u-profile-1",
    } as any);

    const mockReport = {
      id: "rep-101",
      reporterUserId: "u-profile-1",
      targetType: "profile",
      targetId: "00000000-0000-0000-0000-000000000002",
      reason: "impersonation",
      details: null,
      status: "OPEN",
      handledBy: null,
      createdAt: new Date(),
    };
    vi.mocked(trustService.createReport).mockResolvedValue(mockReport);

    const req = createRequest({
      targetType: "profile",
      targetId: "00000000-0000-0000-0000-000000000002",
      reason: "impersonation",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(trustService.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterUserId: "u-profile-1",
      })
    );
  });

  it("returns 400 when payload validation fails", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const req = createRequest({
      targetType: "invalid-type",
      targetId: "not-a-uuid",
      reason: "invalid-reason",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when target does not exist", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);
    vi.mocked(trustService.createReport).mockRejectedValue(
      new trustService.TrustError("NOT_FOUND", 404, "Target proof not found.")
    );

    const req = createRequest({
      targetType: "proof",
      targetId: "00000000-0000-0000-0000-000000000001",
      reason: "copyright",
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("enforces rate limit (10 per hour) and responds with 429 and Retry-After header", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);
    vi.mocked(trustService.createReport).mockResolvedValue({} as any);

    const targetPayload = {
      targetType: "proof",
      targetId: "00000000-0000-0000-0000-000000000001",
      reason: "spam",
    };

    // Fire 10 allowed requests
    for (let i = 0; i < 10; i++) {
      const allowedReq = createRequest(targetPayload);
      const res = await POST(allowedReq);
      expect(res.status).toBe(201);
    }

    // 11th request should be blocked
    const blockedReq = createRequest(targetPayload);
    const blockedRes = await POST(blockedReq);
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    const data = await blockedRes.json();
    expect(data.error.code).toBe("RATE_LIMITED");
  });
});
