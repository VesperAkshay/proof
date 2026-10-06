import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { claimHandle, IdentityError } from "@/services/identity";
import { apiError, apiSuccess } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { userId: authUserId } = await auth();

    if (!authUserId) {
      return apiError(
        "UNAUTHORIZED",
        "Authentication required to claim a handle.",
        401
      );
    }

    const body = await req.json().catch(() => ({}));
    const { username, displayName } = body;

    if (!username || typeof username !== "string") {
      return apiError(
        "VALIDATION_ERROR",
        "Field 'username' is required and must be a string.",
        400
      );
    }

    const user = await claimHandle({
      authUserId,
      rawUsername: username,
      displayName: typeof displayName === "string" ? displayName : undefined,
    });

    return apiSuccess({ user }, 201);
  } catch (error: unknown) {
    if (error instanceof IdentityError) {
      return apiError(error.code, error.message, error.statusCode);
    }

    console.error("Handle claim error:", error);
    return apiError("INTERNAL_ERROR", "Failed to claim handle.", 500);
  }
}
