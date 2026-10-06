/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordAnalyticsEvent } from "../analytics";
import { db } from "@/db/client";

vi.mock("@/db/client", () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe("Analytics Service (M9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records qr_scan event linked to proof and profile user", async () => {
    let insertedData: any = null;
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockImplementation((val: any) => {
        insertedData = val;
        return Promise.resolve();
      }),
    });

    await recordAnalyticsEvent({
      eventType: "qr_scan",
      profileUserId: "user-123",
      proofId: "proof-456",
      referrerHost: "camera.ios",
      deviceClass: "mobile",
    });

    expect(insertedData).not.toBeNull();
    expect(insertedData.eventType).toBe("qr_scan");
    expect(insertedData.profileUserId).toBe("user-123");
    expect(insertedData.proofId).toBe("proof-456");
    expect(insertedData.referrerHost).toBe("camera.ios");
  });

  it("records external_link_click or download event", async () => {
    let insertedData: any = null;
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockImplementation((val: any) => {
        insertedData = val;
        return Promise.resolve();
      }),
    });

    await recordAnalyticsEvent({
      eventType: "download",
      profileUserId: "user-123",
      proofId: "proof-456",
    });

    expect(insertedData.eventType).toBe("download");
  });
});
