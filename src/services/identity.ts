import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { users, handleHistory, reservedHandles, type User } from "@/db/schema";
import {
  validateHandle,
  generateHandleSuggestions,
} from "@/lib/handle";

export type AvailabilityResponse = {
  username: string;
  available: boolean;
  reason: "TAKEN" | "RESERVED" | "INVALID" | null;
  suggestions: string[];
};

export class IdentityError extends Error {
  constructor(
    public code:
      | "HANDLE_TAKEN"
      | "HANDLE_RESERVED"
      | "HANDLE_INVALID"
      | "USER_NOT_FOUND"
      | "INTERNAL_ERROR",
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "IdentityError";
  }
}

/**
 * Checks handle availability against reserved handles, active users, and cooling-off history.
 */
export async function checkHandleAvailability(
  rawUsername: string
): Promise<AvailabilityResponse> {
  const validation = validateHandle(rawUsername);
  const normalized = validation.normalized;

  if (!validation.isValid) {
    return {
      username: normalized,
      available: false,
      reason: "INVALID",
      suggestions: [],
    };
  }

  // 1. Check reserved handles (indexed PK lookup)
  const [reserved] = await db
    .select({ handle: reservedHandles.handleNormalized })
    .from(reservedHandles)
    .where(eq(reservedHandles.handleNormalized, normalized))
    .limit(1);

  if (reserved) {
    const suggestions = await generateHandleSuggestions(normalized, async (candidate) => {
      const res = await checkHandleDirectAvailability(candidate);
      return res;
    });

    return {
      username: normalized,
      available: false,
      reason: "RESERVED",
      suggestions,
    };
  }

  // 2. Check active users and cooling-off handle history
  const isAvailable = await checkHandleDirectAvailability(normalized);

  if (!isAvailable) {
    const suggestions = await generateHandleSuggestions(normalized, async (candidate) => {
      const res = await checkHandleDirectAvailability(candidate);
      return res;
    });

    return {
      username: normalized,
      available: false,
      reason: "TAKEN",
      suggestions,
    };
  }

  return {
    username: normalized,
    available: true,
    reason: null,
    suggestions: [],
  };
}

/**
 * Internal direct availability check (users table + 30-day cooling-off in handle_history).
 */
export async function checkHandleDirectAvailability(
  normalized: string
): Promise<boolean> {
  // Check users table
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.usernameNormalized, normalized))
    .limit(1);

  if (existingUser) return false;

  // Check reserved handles
  const [reserved] = await db
    .select({ handle: reservedHandles.handleNormalized })
    .from(reservedHandles)
    .where(eq(reservedHandles.handleNormalized, normalized))
    .limit(1);

  if (reserved) return false;

  // Check cooling-off period (30 days) in handle_history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [historyEntry] = await db
    .select({ id: handleHistory.id })
    .from(handleHistory)
    .where(
      and(
        eq(handleHistory.handleNormalized, normalized),
        gt(handleHistory.createdAt, thirtyDaysAgo)
      )
    )
    .limit(1);

  if (historyEntry) return false;

  return true;
}

/**
 * Claims a handle transactionally for an authenticated Clerk user.
 * Relies on the UNIQUE(username_normalized) constraint as the authoritative barrier.
 */
export async function claimHandle({
  authUserId,
  rawUsername,
  displayName,
}: {
  authUserId: string;
  rawUsername: string;
  displayName?: string;
}): Promise<User> {
  const validation = validateHandle(rawUsername);
  if (!validation.isValid) {
    throw new IdentityError("HANDLE_INVALID", validation.message || "Invalid handle format.", 422);
  }

  const normalized = validation.normalized;
  const displayUsername = rawUsername.trim().replace(/^@/, "");

  // 1. Check reserved list
  const [reserved] = await db
    .select({ reason: reservedHandles.reason })
    .from(reservedHandles)
    .where(eq(reservedHandles.handleNormalized, normalized))
    .limit(1);

  if (reserved) {
    throw new IdentityError(
      "HANDLE_RESERVED",
      `The handle '@${normalized}' is reserved: ${reserved.reason}`,
      422
    );
  }

  // 2. Transactional claim
  try {
    return await db.transaction(async (tx) => {
      // Check 30-day cooling off for other users in handle_history
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [historyConflict] = await tx
        .select({ userId: handleHistory.userId })
        .from(handleHistory)
        .where(
          and(
            eq(handleHistory.handleNormalized, normalized),
            gt(handleHistory.createdAt, thirtyDaysAgo)
          )
        )
        .limit(1);

      // Check if user already exists
      const [existingSelf] = await tx
        .select()
        .from(users)
        .where(eq(users.authUserId, authUserId))
        .limit(1);

      if (historyConflict && (!existingSelf || historyConflict.userId !== existingSelf.id)) {
        throw new IdentityError(
          "HANDLE_TAKEN",
          `Handle '@${normalized}' is currently in a cooling-off period and unavailable.`,
          409
        );
      }

      if (existingSelf) {
        // If user already owns this handle, idempotent return
        if (existingSelf.usernameNormalized === normalized) {
          return existingSelf;
        }

        // Change handle: record previous handle in handle_history
        await tx.insert(handleHistory).values({
          userId: existingSelf.id,
          handleNormalized: existingSelf.usernameNormalized,
          releasedAt: new Date(),
        });

        // Update user
        const [updatedUser] = await tx
          .update(users)
          .set({
            username: displayUsername,
            usernameNormalized: normalized,
            displayName: displayName || existingSelf.displayName,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingSelf.id))
          .returning();

        if (!updatedUser) {
          throw new IdentityError("USER_NOT_FOUND", "Failed to update user profile.", 500);
        }

        return updatedUser;
      }

      // First-time user claim
      const [newUser] = await tx
        .insert(users)
        .values({
          authUserId,
          username: displayUsername,
          usernameNormalized: normalized,
          displayName: displayName || displayUsername,
          status: "active",
        })
        .returning();

      if (!newUser) {
        throw new IdentityError("INTERNAL_ERROR", "Failed to create user record.", 500);
      }

      return newUser;
    });
  } catch (error: unknown) {
    if (error instanceof IdentityError) {
      throw error;
    }

    // PostgreSQL unique violation error code: 23505
    if (
      typeof error === "object" &&
      error !== null &&
      ("code" in error || "message" in error)
    ) {
      const err = error as { code?: string; message?: string };
      if (err.code === "23505" || err.message?.includes("unique")) {
        throw new IdentityError(
          "HANDLE_TAKEN",
          `The handle '@${normalized}' is already taken.`,
          409
        );
      }
    }

    throw error;
  }
}

/**
 * Fetches user profile by authUserId.
 */
export async function getProfileByAuthUserId(authUserId: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);

  return user || null;
}

/**
 * Updates user profile metadata (displayName, bio).
 */
export async function updateProfile(
  authUserId: string,
  data: { displayName?: string; bio?: string }
): Promise<User> {
  const [updatedUser] = await db
    .update(users)
    .set({
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.authUserId, authUserId))
    .returning();

  if (!updatedUser) {
    throw new IdentityError("USER_NOT_FOUND", "Profile not found.", 404);
  }

  return updatedUser;
}
