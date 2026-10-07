import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createReport, TrustError } from "@/services/trust";
import { getProfileByAuthUserId } from "@/services/identity";
import { createReportSchema } from "@/lib/validations/trust";
import { apiError, apiSuccess } from "@/lib/api";
import { rateLimiter, RATE_LIMIT_CONFIGS, rateLimitResponse } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    // 1. Identify client for rate limiting
    const { userId: authUserId } = await auth();
    let reporterProfileId: string | null = null;

    if (authUserId) {
      const user = await getProfileByAuthUserId(authUserId);
      if (user) {
        reporterProfileId = user.id;
      }
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rateLimitKey = reporterProfileId ? `report:user:${reporterProfileId}` : `report:ip:${ip}`;

    const limitCheck = rateLimiter.check(
      rateLimitKey,
      RATE_LIMIT_CONFIGS.REPORT.limit,
      RATE_LIMIT_CONFIGS.REPORT.windowSeconds
    );

    if (!limitCheck.allowed) {
      return rateLimitResponse(limitCheck, "Report rate limit exceeded. Please retry later.");
    }

    // 2. Validate request body
    const body = await req.json().catch(() => null);
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid report payload",
        400,
        { issues: parsed.error.issues }
      );
    }

    // 3. Create report
    const report = await createReport({
      reporterUserId: reporterProfileId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details,
    });

    return apiSuccess({ report }, 201);
  } catch (error: unknown) {
    if (error instanceof TrustError) {
      return apiError(error.code, error.message, error.statusCode);
    }
    console.error("Submit report error:", error);
    return apiError("INTERNAL_ERROR", "Failed to submit abuse report.", 500);
  }
}
