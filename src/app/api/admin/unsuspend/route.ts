import { NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { unsuspendUser, TrustError } from "@/services/trust";
import { unsuspendUserSchema } from "@/lib/validations/trust";
import { apiError, apiSuccess } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const adminCtx = await verifyAdminRequest(req);
    if (!adminCtx) {
      return apiError("FORBIDDEN", "Administrative privilege required.", 403);
    }

    const body = await req.json().catch(() => null);
    const parsed = unsuspendUserSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid unsuspend payload",
        400
      );
    }

    const result = await unsuspendUser(
      parsed.data.userId,
      parsed.data.reason,
      adminCtx.adminActorId
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    if (error instanceof TrustError) {
      return apiError(error.code, error.message, error.statusCode);
    }
    console.error("Admin unsuspend user error:", error);
    return apiError("INTERNAL_ERROR", "Failed to unsuspend user.", 500);
  }
}
