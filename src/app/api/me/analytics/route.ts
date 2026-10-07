import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { getProfileAnalytics } from "@/services/analytics";
import { apiError, apiSuccess } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const user = await getProfileByAuthUserId(authUserId);
    if (!user) {
      return apiError("NOT_FOUND", "Profile not found.", 404);
    }

    const searchParams = req.nextUrl.searchParams;
    const daysParam = searchParams.get("days");
    const proofIdParam = searchParams.get("proofId");

    const days = daysParam ? parseInt(daysParam, 10) : 30;
    const sanitizedDays = isNaN(days) || days <= 0 ? 30 : Math.min(days, 365);

    // Queries strictly from analytics_daily aggregates (Exit Gate requirement)
    const analytics = await getProfileAnalytics(user.id, {
      days: sanitizedDays,
      proofId: proofIdParam || undefined,
    });

    return apiSuccess({ analytics });
  } catch (error) {
    console.error("Get analytics error:", error);
    return apiError("INTERNAL_ERROR", "Failed to retrieve analytics.", 500);
  }
}
