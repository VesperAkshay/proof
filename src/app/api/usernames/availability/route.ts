import { NextRequest } from "next/server";
import { checkHandleAvailability } from "@/services/identity";
import { apiError, apiSuccess } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const { rateLimiter, RATE_LIMIT_CONFIGS, rateLimitResponse } = await import("@/lib/ratelimit");
    const limitCheck = rateLimiter.check(
      `avail:ip:${ip}`,
      RATE_LIMIT_CONFIGS.AVAILABILITY_IP.limit,
      RATE_LIMIT_CONFIGS.AVAILABILITY_IP.windowSeconds
    );
    if (!limitCheck.allowed) {
      return rateLimitResponse(limitCheck, "Availability rate limit exceeded (30 per minute).");
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return apiError(
        "VALIDATION_ERROR",
        "Query parameter 'username' is required.",
        400
      );
    }

    const result = await checkHandleAvailability(username);
    return apiSuccess(result);
  } catch (error: unknown) {
    console.error("Availability check failed:", error);
    return apiError("INTERNAL_ERROR", "Failed to check handle availability.", 500);
  }
}
