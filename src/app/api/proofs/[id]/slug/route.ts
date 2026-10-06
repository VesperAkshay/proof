import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { changeProofSlug, ProofError } from "@/services/proof";
import { changeSlugSchema } from "@/lib/validations/proof";
import { apiError, apiSuccess, type ApiErrorCode } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
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
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("VALIDATION_ERROR", "Invalid request body.", 400);
    }

    const parseResult = changeSlugSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return apiError("VALIDATION_ERROR", issue?.message || "Invalid slug format.", 400);
    }

    const proof = await changeProofSlug(id, user.id, parseResult.data.slug);
    return apiSuccess({ proof });
  } catch (error: unknown) {
    if (error instanceof ProofError) {
      return apiError(
        error.code as ApiErrorCode,
        error.message,
        error.statusCode,
        error.suggestions ? { suggestions: error.suggestions } : undefined
      );
    }
    console.error("Change slug error:", error);
    return apiError("INTERNAL_ERROR", "Failed to change slug.", 500);
  }
}
