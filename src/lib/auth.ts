import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export interface AdminContext {
  isAdmin: boolean;
  adminActorId: string;
}

/**
 * Validates whether the incoming request possesses administrative privileges.
 * Supports:
 * 1. Admin secret key via 'x-admin-key' header (for system/internal/automated moderation calls)
 * 2. Clerk authenticated user with admin role or matching ADMIN_USER_IDS
 */
export async function verifyAdminRequest(req: NextRequest): Promise<AdminContext | null> {
  // 1. Check admin secret header
  const adminKey = req.headers.get("x-admin-key");
  const configuredAdminKey = process.env.ADMIN_SECRET_KEY || "proof-admin-secret";

  if (adminKey && adminKey === configuredAdminKey) {
    const actorId = req.headers.get("x-admin-actor-id") || "admin-system";
    return {
      isAdmin: true,
      adminActorId: actorId,
    };
  }

  // 2. Check authenticated Clerk session
  try {
    const { userId: authUserId, sessionClaims } = await auth();
    if (authUserId) {
      const adminUserIds = (process.env.ADMIN_USER_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const role =
        (sessionClaims?.metadata as Record<string, unknown>)?.role ||
        (sessionClaims as Record<string, unknown>)?.role;

      if (adminUserIds.includes(authUserId) || role === "admin") {
        return {
          isAdmin: true,
          adminActorId: authUserId,
        };
      }
    }
  } catch {
    // Auth context not available or errored
  }

  return null;
}
