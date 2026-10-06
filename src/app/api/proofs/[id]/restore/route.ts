import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { transitionLifecycle, ProofError } from "@/services/proof";
import { apiError, apiSuccess, type ApiErrorCode } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const user = await getProfileByAuthUserId(authUserId);
    if (!user) {
      return apiError("NOT_FOUND", "Profile not found.", 404);
    }

    const { id } = await params;
    const proof = await transitionLifecycle(id, user.id, "DRAFT");
    return apiSuccess({ proof });
  } catch (error: unknown) {
    if (error instanceof ProofError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Restore proof error:", error);
    return apiError("INTERNAL_ERROR", "Failed to restore proof.", 500);
  }
}
