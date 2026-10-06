import { db } from "@/db/client";
import { analyticsEvents } from "@/db/schema";

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
}

/**
 * Records an analytics event with privacy protections (no raw IP stored).
 */
export async function recordAnalyticsEvent(input: RecordEventInput): Promise<void> {
  await db.insert(analyticsEvents).values({
    eventType: input.eventType,
    profileUserId: input.profileUserId,
    proofId: input.proofId || null,
    referrerHost: input.referrerHost || null,
    deviceClass: input.deviceClass || null,
    countryCode: input.countryCode || null,
    visitorHash: input.visitorHash || null,
  });
}
