/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordAnalyticsEvent,
  generateVisitorHash,
  getDailySalt,
  isBotUserAgent,
  detectDeviceClass,
  extractCoarseCountry,
  sanitizeReferrerHost,
  aggregateDailyAnalytics,
  cleanupRawAnalyticsEvents,
  getProfileAnalytics,
} from "../analytics";
import { db } from "@/db/client";

vi.mock("@/db/client", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

describe("Analytics Service (Milestone M11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Privacy & Rotating Salted Visitor Hash", () => {
    it("generates deterministic hash within the same UTC day for same IP and UA", () => {
      const date = new Date("2026-10-07T10:00:00Z");
      const hash1 = generateVisitorHash("198.51.100.42", "Mozilla/5.0", date, "secret-salt");
      const hash2 = generateVisitorHash("198.51.100.42", "Mozilla/5.0", date, "secret-salt");

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(32);
      expect(hash1).not.toContain("198.51.100.42"); // Never stores raw IP
    });

    it("rotates visitor hash across different UTC days to prevent tracking", () => {
      const day1 = new Date("2026-10-07T12:00:00Z");
      const day2 = new Date("2026-10-08T12:00:00Z");

      const hashDay1 = generateVisitorHash("198.51.100.42", "Mozilla/5.0", day1, "secret-salt");
      const hashDay2 = generateVisitorHash("198.51.100.42", "Mozilla/5.0", day2, "secret-salt");

      expect(hashDay1).not.toBe(hashDay2);
    });

    it("ensures getDailySalt produces different salts per calendar day", () => {
      const saltA = getDailySalt(new Date("2026-05-01T00:00:00Z"), "test-secret");
      const saltB = getDailySalt(new Date("2026-05-02T00:00:00Z"), "test-secret");

      expect(saltA).not.toBe(saltB);
    });
  });

  describe("Bot & Crawler Filtering (Exit Gate: bots filtered)", () => {
    it("identifies search crawlers, automated bots, and headless browsers", () => {
      expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
      expect(isBotUserAgent("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(true);
      expect(isBotUserAgent("curl/7.88.1")).toBe(true);
      expect(isBotUserAgent("python-requests/2.31.0")).toBe(true);
      expect(isBotUserAgent("HeadlessChrome/112.0.5615.49")).toBe(true);
      expect(isBotUserAgent("PostmanRuntime/7.32.3")).toBe(true);
    });

    it("allows standard human web browsers", () => {
      expect(
        isBotUserAgent(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
      ).toBe(false);
      expect(
        isBotUserAgent(
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        )
      ).toBe(false);
    });

    it("drops bot events and does not insert them into the database", async () => {
      const recorded = await recordAnalyticsEvent({
        eventType: "proof_view",
        profileUserId: "user-123",
        proofId: "proof-456",
        userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)",
      });

      expect(recorded).toBe(false);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("Coarse Geo & Metadata Extraction", () => {
    it("extracts 2-letter uppercase ISO country code and ignores fine-grained data", () => {
      const headers = new Headers({
        "cf-ipcountry": "DE",
      });
      expect(extractCoarseCountry(headers)).toBe("DE");
    });

    it("rejects invalid or placeholder country codes", () => {
      const headers = new Headers({
        "cf-ipcountry": "XX",
      });
      expect(extractCoarseCountry(headers)).toBeNull();
    });

    it("detects mobile, tablet, and desktop device classes", () => {
      expect(detectDeviceClass("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)")).toBe("mobile");
      expect(detectDeviceClass("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)")).toBe("tablet");
      expect(detectDeviceClass("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
    });

    it("sanitizes referrer URL down to hostname only", () => {
      expect(
        sanitizeReferrerHost("https://news.ycombinator.com/item?id=12345678#comments")
      ).toBe("news.ycombinator.com");
      expect(sanitizeReferrerHost("invalid-url")).toBeNull();
      expect(sanitizeReferrerHost(null)).toBeNull();
    });
  });

  describe("Event Recording Ingestion", () => {
    it("records valid user events with rotating visitor hash and device metadata", async () => {
      let insertedData: any = null;
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockImplementation((val: any) => {
          insertedData = val;
          return Promise.resolve();
        }),
      });

      const recorded = await recordAnalyticsEvent({
        eventType: "proof_view",
        profileUserId: "user-123",
        proofId: "proof-456",
        ip: "203.0.113.195",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        countryCode: "US",
        referrerHost: "twitter.com",
      });

      expect(recorded).toBe(true);
      expect(insertedData).not.toBeNull();
      expect(insertedData.eventType).toBe("proof_view");
      expect(insertedData.profileUserId).toBe("user-123");
      expect(insertedData.proofId).toBe("proof-456");
      expect(insertedData.countryCode).toBe("US");
      expect(insertedData.deviceClass).toBe("desktop");
      expect(insertedData.visitorHash).toBeDefined();
      expect(insertedData.visitorHash.length).toBe(32);
    });
  });

  describe("Daily Aggregation & Raw TTL (Exit Gate: daily aggregation)", () => {
    it("executes atomic upsert aggregation for target date", async () => {
      (db.execute as any).mockResolvedValue({ rowCount: 5 });

      await aggregateDailyAnalytics("2026-10-07");

      expect(db.execute).toHaveBeenCalledTimes(1);
    });

    it("enforces raw event TTL by deleting events older than retention days", async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "1" }, { id: "2" }]),
        }),
      });

      const deletedCount = await cleanupRawAnalyticsEvents(30);

      expect(db.delete).toHaveBeenCalled();
      expect(deletedCount).toBe(2);
    });
  });

  describe("Dashboard Aggregate Reader (Exit Gate: dashboards read aggregates, not raw rows)", () => {
    it("queries exclusively from analytics_daily and aggregates metrics", async () => {
      // Mock db.select for analytics_daily then for proofs
      const mockDailyRows = [
        {
          date: "2026-10-06",
          proofId: "proof-1",
          eventType: "proof_view",
          count: 15,
          uniqueVisitors: 12,
        },
        {
          date: "2026-10-06",
          proofId: null,
          eventType: "profile_view",
          count: 20,
          uniqueVisitors: 18,
        },
        {
          date: "2026-10-06",
          proofId: "proof-1",
          eventType: "download",
          count: 4,
          uniqueVisitors: 3,
        },
        {
          date: "2026-10-06",
          proofId: "proof-1",
          eventType: "qr_scan",
          count: 2,
          uniqueVisitors: 2,
        },
      ];

      const mockProofRows = [
        { id: "proof-1", title: "AWS Solutions Architect" },
      ];

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockDailyRows),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockProofRows),
          }),
        });

      const result = await getProfileAnalytics("user-123", { days: 7 });

      expect(result.summary.totalViews).toBe(35); // 20 profile + 15 proof
      expect(result.summary.profileViews).toBe(20);
      expect(result.summary.proofViews).toBe(15);
      expect(result.summary.downloads).toBe(4);
      expect(result.summary.qrScans).toBe(2);
      expect(result.summary.uniqueVisitors).toBe(18);

      expect(result.proofBreakdown).toHaveLength(1);
      expect(result.proofBreakdown[0]!.title).toBe("AWS Solutions Architect");
      expect(result.proofBreakdown[0]!.views).toBe(15);
      expect(result.proofBreakdown[0]!.downloads).toBe(4);
      expect(result.proofBreakdown[0]!.qrScans).toBe(2);
    });
  });
});
