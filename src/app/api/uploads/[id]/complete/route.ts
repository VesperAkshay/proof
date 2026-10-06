import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getProfileByAuthUserId } from "@/services/identity";
import { completeUploadSession, AssetError } from "@/services/assets";
import { apiError, apiSuccess, type ApiErrorCode } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const completeUploadSchema = z
  .object({
    parts: z
      .array(
        z.object({
          partNumber: z.number().int().positive(),
          etag: z.string().min(1),
        })
      )
      .optional(),
  })
  .strict();

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
    const body = await req.json().catch(() => ({}));
    const parseResult = completeUploadSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError("VALIDATION_ERROR", "Invalid completion payload.", 400);
    }

    const asset = await completeUploadSession(id, user.id, parseResult.data.parts);
    return apiSuccess({ asset });
  } catch (error: unknown) {
    if (error instanceof AssetError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Complete upload error:", error);
    return apiError("INTERNAL_ERROR", "Failed to complete upload session.", 500);
  }
}
