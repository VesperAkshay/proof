import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { reorderProofs, ProofError } from "@/services/proof";
import { reorderProofsSchema } from "@/lib/validations/proof";
import { apiError, apiSuccess, type ApiErrorCode } from "@/lib/api";

export async function PUT(req: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const user = await getProfileByAuthUserId(authUserId);
    if (!user) {
      return apiError("NOT_FOUND", "Profile not found.", 404);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("VALIDATION_ERROR", "Invalid request body.", 400);
    }

    const parseResult = reorderProofsSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return apiError("VALIDATION_ERROR", issue?.message || "Invalid input.", 400);
    }

    await reorderProofs(user.id, parseResult.data.proofIds);
    return apiSuccess({ success: true });
  } catch (error: unknown) {
    if (error instanceof ProofError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Reorder proofs error:", error);
    return apiError("INTERNAL_ERROR", "Failed to reorder proofs.", 500);
  }
}
