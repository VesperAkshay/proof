import { NextRequest } from "next/server";
import { z } from "zod";
import {
  recordAnalyticsEvent,
  extractCoarseCountry,
  sanitizeReferrerHost,
  type AnalyticsEventType,
} from "@/services/analytics";
import { apiError, apiSuccess } from "@/lib/api";

const eventBeaconSchema = z
  .object({
    eventType: z.enum([
      "profile_view",
      "proof_view",
      "download",
      "qr_scan",
      "external_link_click",
    ]),
    profileUserId: z.string().uuid("Invalid profileUserId format"),
    proofId: z.string().uuid("Invalid proofId format").optional().nullable(),
    referrer: z.string().max(1000).optional().nullable(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("VALIDATION_ERROR", "Invalid event payload.", 400);
    }

    const parseResult = eventBeaconSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return apiError(
        "VALIDATION_ERROR",
        issue?.message || "Invalid event payload.",
        400
      );
    }

    const { eventType, profileUserId, proofId, referrer } = parseResult.data;

    // Extract privacy headers
    const userAgent = req.headers.get("user-agent") || "";
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const countryCode = extractCoarseCountry(req.headers);
    const referrerHost = sanitizeReferrerHost(referrer);

    const recorded = await recordAnalyticsEvent({
      eventType: eventType as AnalyticsEventType,
      profileUserId,
      proofId: proofId || null,
      referrerHost,
      countryCode,
      userAgent,
      ip,
    });

    return apiSuccess({ recorded });
  } catch (error) {
    console.error("Record event error:", error);
    return apiError("INTERNAL_ERROR", "Failed to record event.", 500);
  }
}
