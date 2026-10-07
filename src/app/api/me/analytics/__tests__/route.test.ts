/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as clerkNextjs from "@clerk/nextjs/server";
import * as identityService from "@/services/identity";
import * as analyticsService from "@/services/analytics";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/services/identity", () => ({
  getProfileByAuthUserId: vi.fn(),
}));

vi.mock("@/services/analytics", () => ({
  getProfileAnalytics: vi.fn(),
}));

describe("GET /api/me/analytics Route (M11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: null } as any);

    const req = new NextRequest("http://localhost:3000/api/me/analytics");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 if profile does not exist", async () => {
    vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk-user-1" } as any);
    vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/me/analytics");
    const res = await GET(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("returns aggregate analytics for authenticated user", async () => {
    vi.mocked(clerkNextjs.auth).mockResolvedValue({ userId: "clerk-user-1" } as any);
    vi.mocked(identityService.getProfileByAuthUserId).mockResolvedValue({
      id: "user-uuid-1",
      username: "alice",
    } as any);

    const mockAnalytics = {
      summary: {
        totalViews: 42,
        profileViews: 20,
        proofViews: 22,
        downloads: 5,
        qrScans: 3,
        externalLinkClicks: 2,
        uniqueVisitors: 30,
      },
      daily: [],
      proofBreakdown: [],
    };

    vi.mocked(analyticsService.getProfileAnalytics).mockResolvedValue(mockAnalytics);

    const req = new NextRequest("http://localhost:3000/api/me/analytics?days=7");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.analytics.summary.totalViews).toBe(42);
    expect(analyticsService.getProfileAnalytics).toHaveBeenCalledWith("user-uuid-1", {
      days: 7,
      proofId: undefined,
    });
  });
});
