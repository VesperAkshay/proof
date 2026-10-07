import crypto from "node:crypto";
import { eq, and, gte, lt, asc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  analyticsEvents,
  analyticsDaily,
  proofs,
} from "@/db/schema";

export type AnalyticsEventType =
  | "profile_view"
  | "proof_view"
  | "download"
  | "qr_scan"
  | "external_link_click";

export interface RecordEventInput {
  eventType: AnalyticsEventType;
  profileUserId: string;
  proofId?: string | null;
  referrerHost?: string | null;
  deviceClass?: string | null;
  countryCode?: string | null;
  visitorHash?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}

const ANALYTICS_SALT_SECRET =
  process.env.ANALYTICS_SALT_SECRET || "proof-default-analytics-salt";

// Bot and crawler pattern heuristics
const BOT_REGEX =
  /bot|spider|crawl|slurp|googlebot|bingbot|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|curl|wget|python|postman|headless|phantomjs|lighthouse|pingdom|uptimerobot|node-fetch|axios|go-http-client/i;

/**
 * Identifies if a request originates from an automated bot, scraper, or web crawler.
 */
export function isBotUserAgent(userAgent?: string | null): boolean {
  if (!userAgent || typeof userAgent !== "string") return false;
  return BOT_REGEX.test(userAgent);
}

/**
 * Computes a rotating salt that changes daily at UTC midnight.
 * Guarantees visitor hashes cannot be correlated across different days.
 */
export function getDailySalt(
  date: Date = new Date(),
  secret = ANALYTICS_SALT_SECRET
): string {
  const utcDate = date.toISOString().split("T")[0]; // YYYY-MM-DD
  return crypto
    .createHmac("sha256", secret)
    .update(`proof-salt-${utcDate}`)
    .digest("hex");
}

/**
 * Generates an anonymous, daily-rotating salted visitor hash.
 * Never stores or exposes raw IP.
 */
export function generateVisitorHash(
  ip: string,
  userAgent: string,
  date: Date = new Date(),
  secret = ANALYTICS_SALT_SECRET
): string {
  const dailySalt = getDailySalt(date, secret);
  return crypto
    .createHmac("sha256", dailySalt)
    .update(`${ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Derives high-level device class from User-Agent.
 */
export function detectDeviceClass(
  userAgent?: string | null
): "mobile" | "tablet" | "desktop" {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Extracts coarse ISO-3166-1 alpha-2 country code (e.g. "US", "DE").
 * Rejects cities, coordinates, or fine-grained geolocation data.
 */
export function extractCoarseCountry(
  headers: Headers | Record<string, string | string[] | undefined>
): string | null {
  const getHeader = (name: string): string | null => {
    if ("get" in headers && typeof headers.get === "function") {
      return headers.get(name);
    }
    const val = (headers as Record<string, string | string[] | undefined>)[
      name.toLowerCase()
    ];
    if (Array.isArray(val)) return val[0] || null;
    return (val as string) || null;
  };

  const rawCountry =
    getHeader("cf-ipcountry") ||
    getHeader("x-vercel-ip-country") ||
    getHeader("x-country-code");

  if (!rawCountry) return null;
  const clean = rawCountry.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(clean) && clean !== "XX" && clean !== "T1"
    ? clean
    : null;
}

/**
 * Sanitizes and extracts referrer hostname to prevent URL parameter leakage.
 */
export function sanitizeReferrerHost(referrerUrl?: string | null): string | null {
  if (!referrerUrl) return null;
  try {
    const url = new URL(referrerUrl);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Records an analytics event with privacy protections (no raw IP stored).
 * Automatically filters bot user-agents so metrics are not inflated.
 */
export async function recordAnalyticsEvent(
  input: RecordEventInput
): Promise<boolean> {
  // 1. Bot Filter (Exit Gate: bots filtered)
  if (isBotUserAgent(input.userAgent)) {
    return false;
  }

  // 2. Generate daily-rotating salted visitor hash if raw IP is provided
  let calculatedHash = input.visitorHash || null;
  if (!calculatedHash && input.ip) {
    calculatedHash = generateVisitorHash(
      input.ip,
      input.userAgent || "unknown-ua",
      new Date()
    );
  }

  // 3. Resolve device class if not supplied
  const resolvedDeviceClass =
    input.deviceClass || detectDeviceClass(input.userAgent);

  // 4. Insert into raw analytics events
  await db.insert(analyticsEvents).values({
    eventType: input.eventType,
    profileUserId: input.profileUserId,
    proofId: input.proofId || null,
    referrerHost: input.referrerHost || null,
    deviceClass: resolvedDeviceClass || null,
    countryCode: input.countryCode || null,
    visitorHash: calculatedHash,
  });

  return true;
}

/**
 * Aggregates raw events into analytics_daily for a specific target date (YYYY-MM-DD).
 * Computes total counts and unique visitors using an atomic upsert.
 */
export async function aggregateDailyAnalytics(
  targetDate?: string
): Promise<void> {
  const dateStr = targetDate || new Date().toISOString().split("T")[0]!;

  await db.execute(sql`
    INSERT INTO analytics_daily (
      date,
      profile_user_id,
      proof_id,
      event_type,
      count,
      unique_visitors,
      updated_at
    )
    SELECT
      ${dateStr}::date as date,
      profile_user_id,
      proof_id,
      event_type,
      COUNT(*)::int as count,
      COUNT(DISTINCT visitor_hash)::int as unique_visitors,
      NOW() as updated_at
    FROM analytics_events
    WHERE DATE(occurred_at) = ${dateStr}::date
    GROUP BY profile_user_id, proof_id, event_type
    ON CONFLICT (date, profile_user_id, COALESCE(proof_id, '00000000-0000-0000-0000-000000000000'::uuid), event_type)
    DO UPDATE SET
      count = EXCLUDED.count,
      unique_visitors = EXCLUDED.unique_visitors,
      updated_at = NOW();
  `);
}

/**
 * Enforces raw event TTL (default 30 days) by deleting expired raw event rows.
 */
export async function cleanupRawAnalyticsEvents(
  retentionDays = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const deleted = await db
    .delete(analyticsEvents)
    .where(lt(analyticsEvents.occurredAt, cutoffDate))
    .returning({ id: analyticsEvents.id });

  return deleted.length;
}

export interface DashboardAnalyticsOptions {
  days?: number;
  proofId?: string;
}

export interface DashboardAnalyticsResult {
  summary: {
    totalViews: number;
    profileViews: number;
    proofViews: number;
    downloads: number;
    qrScans: number;
    externalLinkClicks: number;
    uniqueVisitors: number;
  };
  daily: Array<{
    date: string;
    views: number;
    uniqueVisitors: number;
    downloads: number;
    qrScans: number;
  }>;
  proofBreakdown: Array<{
    proofId: string;
    title: string;
    views: number;
    downloads: number;
    qrScans: number;
  }>;
}

/**
 * Reads dashboard analytics strictly from analytics_daily aggregates.
 * Satisfies exit gate: dashboards read aggregates, not raw rows.
 */
export async function getProfileAnalytics(
  profileUserId: string,
  options: DashboardAnalyticsOptions = {}
): Promise<DashboardAnalyticsResult> {
  const days = options.days || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0]!;

  // 1. Query exclusively from analytics_daily
  const rows = await db
    .select({
      date: analyticsDaily.date,
      proofId: analyticsDaily.proofId,
      eventType: analyticsDaily.eventType,
      count: analyticsDaily.count,
      uniqueVisitors: analyticsDaily.uniqueVisitors,
    })
    .from(analyticsDaily)
    .where(
      and(
        eq(analyticsDaily.profileUserId, profileUserId),
        gte(analyticsDaily.date, startDateStr),
        options.proofId ? eq(analyticsDaily.proofId, options.proofId) : undefined
      )
    )
    .orderBy(asc(analyticsDaily.date));

  // 2. Query user's proofs for metadata lookup (titles)
  const userProofs = await db
    .select({
      id: proofs.id,
      title: proofs.title,
    })
    .from(proofs)
    .where(eq(proofs.userId, profileUserId));

  const proofTitleMap = new Map<string, string>(
    userProofs.map((p) => [p.id, p.title])
  );

  // 3. Process aggregates into structured response
  let profileViews = 0;
  let proofViews = 0;
  let downloads = 0;
  let qrScans = 0;
  let externalLinkClicks = 0;
  let totalUniqueVisitors = 0;

  const dailyMap = new Map<
    string,
    {
      date: string;
      views: number;
      uniqueVisitors: number;
      downloads: number;
      qrScans: number;
    }
  >();

  const proofMap = new Map<
    string,
    { proofId: string; title: string; views: number; downloads: number; qrScans: number }
  >();

  for (const row of rows) {
    const { date, proofId, eventType, count, uniqueVisitors } = row;

    if (eventType === "profile_view") {
      profileViews += count;
      totalUniqueVisitors += uniqueVisitors;
    } else if (eventType === "proof_view") {
      proofViews += count;
      if (!proofId) totalUniqueVisitors += uniqueVisitors;
    } else if (eventType === "download") {
      downloads += count;
    } else if (eventType === "qr_scan") {
      qrScans += count;
    } else if (eventType === "external_link_click") {
      externalLinkClicks += count;
    }

    // Daily timeline grouping
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        views: 0,
        uniqueVisitors: 0,
        downloads: 0,
        qrScans: 0,
      });
    }
    const dayEntry = dailyMap.get(date)!;
    if (eventType === "profile_view" || eventType === "proof_view") {
      dayEntry.views += count;
      dayEntry.uniqueVisitors += uniqueVisitors;
    } else if (eventType === "download") {
      dayEntry.downloads += count;
    } else if (eventType === "qr_scan") {
      dayEntry.qrScans += count;
    }

    // Proof breakdown grouping
    if (proofId) {
      if (!proofMap.has(proofId)) {
        proofMap.set(proofId, {
          proofId,
          title: proofTitleMap.get(proofId) || "Untitled Proof",
          views: 0,
          downloads: 0,
          qrScans: 0,
        });
      }
      const proofEntry = proofMap.get(proofId)!;
      if (eventType === "proof_view") {
        proofEntry.views += count;
      } else if (eventType === "download") {
        proofEntry.downloads += count;
      } else if (eventType === "qr_scan") {
        proofEntry.qrScans += count;
      }
    }
  }

  return {
    summary: {
      totalViews: profileViews + proofViews,
      profileViews,
      proofViews,
      downloads,
      qrScans,
      externalLinkClicks,
      uniqueVisitors: totalUniqueVisitors,
    },
    daily: Array.from(dailyMap.values()),
    proofBreakdown: Array.from(proofMap.values()),
  };
}
