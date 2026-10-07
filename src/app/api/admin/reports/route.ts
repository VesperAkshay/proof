import { NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { listReports } from "@/services/trust";
import { apiError, apiSuccess } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const adminCtx = await verifyAdminRequest(req);
    if (!adminCtx) {
      return apiError("FORBIDDEN", "Administrative privilege required.", 403);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as "OPEN" | "ACTIONED" | "DISMISSED" | null;
    const targetType = searchParams.get("targetType") as "proof" | "profile" | null;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const result = await listReports({
      status: status || undefined,
      targetType: targetType || undefined,
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
    });

    return apiSuccess(result);
  } catch (error: unknown) {
    console.error("List abuse queue error:", error);
    return apiError("INTERNAL_ERROR", "Failed to retrieve abuse queue.", 500);
  }
}
