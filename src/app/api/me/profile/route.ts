import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getProfileByAuthUserId,
  updateProfile,
  IdentityError,
} from "@/services/identity";
import { apiError, apiSuccess } from "@/lib/api";

export async function GET() {
  try {
    const { userId: authUserId } = await auth();

    if (!authUserId) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const user = await getProfileByAuthUserId(authUserId);

    if (!user) {
      return apiError(
        "NOT_FOUND",
        "Profile not found. You must claim a handle first.",
        404
      );
    }

    return apiSuccess({ user });
  } catch (error: unknown) {
    console.error("Get profile error:", error);
    return apiError("INTERNAL_ERROR", "Failed to retrieve profile.", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId: authUserId } = await auth();

    if (!authUserId) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }

    const body = await req.json().catch(() => ({}));
    const { displayName, bio } = body;

    const updatedUser = await updateProfile(authUserId, {
      displayName: typeof displayName === "string" ? displayName : undefined,
      bio: typeof bio === "string" ? bio : undefined,
    });

    return apiSuccess({ user: updatedUser });
  } catch (error: unknown) {
    if (error instanceof IdentityError) {
      return apiError(error.code, error.message, error.statusCode);
    }

    console.error("Update profile error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update profile.", 500);
  }
}
