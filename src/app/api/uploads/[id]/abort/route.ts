import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { abortUploadSession, AssetError } from "@/services/assets";
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
    await abortUploadSession(id, user.id);
    return apiSuccess({ success: true });
  } catch (error: unknown) {
    if (error instanceof AssetError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Abort upload error:", error);
    return apiError("INTERNAL_ERROR", "Failed to abort upload session.", 500);
  }
}
