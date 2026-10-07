import { NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { restoreProof, TrustError } from "@/services/trust";
import { restoreProofSchema } from "@/lib/validations/trust";
import { apiError, apiSuccess } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const adminCtx = await verifyAdminRequest(req);
    if (!adminCtx) {
      return apiError("FORBIDDEN", "Administrative privilege required.", 403);
    }

    const body = await req.json().catch(() => null);
    const parsed = restoreProofSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Invalid restore payload",
        400
      );
    }

    const result = await restoreProof(
      parsed.data.proofId,
      parsed.data.reason,
      adminCtx.adminActorId
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    if (error instanceof TrustError) {
      return apiError(error.code, error.message, error.statusCode);
    }
    console.error("Admin restore proof error:", error);
    return apiError("INTERNAL_ERROR", "Failed to restore proof.", 500);
  }
}
