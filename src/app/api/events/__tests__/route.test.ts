import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as analyticsService from "@/services/analytics";

vi.mock("@/services/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/analytics")>();
  return {
    ...actual,
    recordAnalyticsEvent: vi.fn(),
  };
});

describe("POST /api/events Beacon API Route (M11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates and accepts a valid analytics beacon payload", async () => {
    vi.mocked(analyticsService.recordAnalyticsEvent).mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "cf-ipcountry": "US",
        "x-forwarded-for": "198.51.100.22",
      },
      body: JSON.stringify({
        eventType: "proof_view",
        profileUserId: "a0000000-0000-0000-0000-000000000001",
        proofId: "b0000000-0000-0000-0000-000000000002",
        referrer: "https://proof.so/@alice",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.recorded).toBe(true);
    expect(analyticsService.recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "proof_view",
        profileUserId: "a0000000-0000-0000-0000-000000000001",
        proofId: "b0000000-0000-0000-0000-000000000002",
        countryCode: "US",
        ip: "198.51.100.22",
      })
    );
  });

  it("rejects invalid event types with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "invalid_arbitrary_event",
        profileUserId: "a0000000-0000-0000-0000-000000000001",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects non-uuid profileUserId with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "profile_view",
        profileUserId: "not-a-uuid",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects payloads containing unknown fields", async () => {
    const req = new NextRequest("http://localhost:3000/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "profile_view",
        profileUserId: "a0000000-0000-0000-0000-000000000001",
        maliciousExtraField: "attack",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});
