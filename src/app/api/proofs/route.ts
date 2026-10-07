import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { createProof, listProofsForUser, ProofError } from "@/services/proof";
import { createProofSchema } from "@/lib/validations/proof";
import { apiError, apiSuccess, type ApiErrorCode } from "@/lib/api";

export async function GET() {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const user = await getProfileByAuthUserId(authUserId);
    if (!user) {
      return apiError("NOT_FOUND", "Profile not found. You must claim a handle first.", 404);
    }

    const proofsList = await listProofsForUser(user.id);
    return apiSuccess({ proofs: proofsList });
  } catch (error: unknown) {
    console.error("List proofs error:", error);
    return apiError("INTERNAL_ERROR", "Failed to retrieve proofs.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const user = await getProfileByAuthUserId(authUserId);
    if (!user) {
      return apiError("NOT_FOUND", "Profile not found. You must claim a handle first.", 404);
    }

    if (user.status === "suspended") {
      return apiError("FORBIDDEN", "Account is suspended.", 403);
    }

    const { rateLimiter, RATE_LIMIT_CONFIGS, rateLimitResponse } = await import("@/lib/ratelimit");
    const writeLimit = rateLimiter.check(
      `write:${user.id}`,
      RATE_LIMIT_CONFIGS.WRITE.limit,
      RATE_LIMIT_CONFIGS.WRITE.windowSeconds
    );
    if (!writeLimit.allowed) {
      return rateLimitResponse(writeLimit, "Write rate limit exceeded (60 per minute).");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("VALIDATION_ERROR", "Invalid request body.", 400);
    }

    const parseResult = createProofSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return apiError("VALIDATION_ERROR", issue?.message || "Invalid input.", 400, {
        issues: parseResult.error.format() as unknown as Record<string, unknown>,
      });
    }

    const proof = await createProof(user.id, parseResult.data);
    return apiSuccess({ proof }, 201);
  } catch (error: unknown) {
    if (error instanceof ProofError) {
      return apiError(
        error.code as ApiErrorCode,
        error.message,
        error.statusCode,
        error.suggestions ? { suggestions: error.suggestions } : undefined
      );
    }
    console.error("Create proof error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create proof.", 500);
  }
}
