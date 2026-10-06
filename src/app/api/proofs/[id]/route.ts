import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { getProofById, updateProof, deleteProof, ProofError } from "@/services/proof";
import { updateProofSchema } from "@/lib/validations/proof";
import { apiError, apiSuccess, type ApiErrorCode } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
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
    const proof = await getProofById(id, user.id);
    return apiSuccess({ proof });
  } catch (error: unknown) {
    if (error instanceof ProofError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Get proof error:", error);
    return apiError("INTERNAL_ERROR", "Failed to retrieve proof.", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

    const parseResult = updateProofSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return apiError("VALIDATION_ERROR", issue?.message || "Invalid input.", 400, {
        issues: parseResult.error.format() as unknown as Record<string, unknown>,
      });
    }

    const proof = await updateProof(id, user.id, parseResult.data);
    return apiSuccess({ proof });
  } catch (error: unknown) {
    if (error instanceof ProofError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Update proof error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update proof.", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
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
    await deleteProof(id, user.id);
    return apiSuccess({ success: true });
  } catch (error: unknown) {
    if (error instanceof ProofError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Delete proof error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete proof.", 500);
  }
}
