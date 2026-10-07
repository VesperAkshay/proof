import { NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { resolveReport, TrustError } from "@/services/trust";
import { updateReportStatusSchema } from "@/lib/validations/trust";
import { apiError, apiSuccess } from "@/lib/api";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const adminCtx = await verifyAdminRequest(req);
    if (!adminCtx) {
      return apiError("FORBIDDEN", "Administrative privilege required.", 403);
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = updateReportStatusSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid status update payload",
        400
      );
    }

    const report = await resolveReport(id, parsed.data.status, adminCtx.adminActorId);
    return apiSuccess({ report });
  } catch (error: unknown) {
    if (error instanceof TrustError) {
      return apiError(error.code, error.message, error.statusCode);
    }
    console.error("Resolve report error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update report status.", 500);
  }
}
