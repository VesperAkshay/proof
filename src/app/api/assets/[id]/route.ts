import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByAuthUserId } from "@/services/identity";
import { getAssetById, deleteAsset, AssetError } from "@/services/assets";
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
    const asset = await getAssetById(id, user.id);
    return apiSuccess({ asset });
  } catch (error: unknown) {
    if (error instanceof AssetError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Get asset error:", error);
    return apiError("INTERNAL_ERROR", "Failed to retrieve asset.", 500);
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
    await deleteAsset(id, user.id);
    return apiSuccess({ success: true });
  } catch (error: unknown) {
    if (error instanceof AssetError) {
      return apiError(error.code as ApiErrorCode, error.message, error.statusCode);
    }
    console.error("Delete asset error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete asset.", 500);
  }
}
