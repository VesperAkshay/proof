import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getProfileByAuthUserId } from "@/services/identity";
import { createUploadSession, AssetError } from "@/services/assets";
import { apiError, apiSuccess, type ApiErrorCode } from "@/lib/api";

const createUploadSchema = z
  .object({
    filename: z.string().trim().min(1, "Filename is required"),
    size: z.number().int().positive("Size must be a positive integer"),
    mime: z.string().trim().min(1, "MIME type is required"),
  })
  .strict();

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
    const uploadLimit = rateLimiter.check(
      `upload:${user.id}`,
      RATE_LIMIT_CONFIGS.UPLOAD_SESSION.limit,
      RATE_LIMIT_CONFIGS.UPLOAD_SESSION.windowSeconds
    );
    if (!uploadLimit.allowed) {
      return rateLimitResponse(uploadLimit, "Upload session rate limit exceeded (20 per hour).");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("VALIDATION_ERROR", "Invalid request body.", 400);
    }

    const parseResult = createUploadSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return apiError("VALIDATION_ERROR", issue?.message || "Invalid input.", 400);
    }

    const { filename, size, mime } = parseResult.data;
    const session = await createUploadSession(user.id, {
      filename,
      sizeBytes: size,
      mimeType: mime,
    });

    return apiSuccess(
      {
        session_id: session.sessionId,
        asset_id: session.assetId,
        upload: session.upload,
      },
      201
    );
  } catch (error: unknown) {
    if (error instanceof AssetError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Create upload error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create upload session.", 500);
  }
}
