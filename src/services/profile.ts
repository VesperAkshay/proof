import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { users, handleHistory, proofs, issuers, assets } from "@/db/schema";
import { normalizeHandle } from "@/lib/handle";
import type { VerificationState } from "@/components/ui/StatusBadge";

export interface PublicProofItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  proofType: string;
  issuerDisplayName: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  effectiveStatus: VerificationState;
  sortOrder: number;
  publishedAt: Date | null;
}

export interface PublicUserProfile {
  id: string;
  username: string;
  usernameNormalized: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

export type PublicProfileResult =
  | {
      isRedirect: true;
      redirectTo: string;
    }
  | {
      isRedirect: false;
      user: PublicUserProfile;
      proofs: PublicProofItem[];
    };

/**
 * Derives the effective verification status of a proof.
 * Rules per SPEC-NOTES.md & api-contract.md:
 * - REVOKED overrides display.
 * - EXPIRED is derived when current date > expiresAt.
 * - Otherwise returns the stored verificationStatus.
 */
export function getEffectiveVerificationStatus(
  status: string,
  expiresAt: Date | null,
  now = new Date()
): VerificationState {
  if (status === "REVOKED") {
    return "REVOKED";
  }
  if (expiresAt && new Date(expiresAt) < now) {
    return "EXPIRED";
  }
  return status as VerificationState;
}

/**
 * Fetches the public profile and published proofs for a given handle.
 * Returns null if the user does not exist, is suspended, or is deleted.
 * Returns a redirect descriptor if the handle was historically renamed.
 */
export async function getPublicProfile(handle: string): Promise<PublicProfileResult | null> {
  const normalized = normalizeHandle(handle);

  // 1. Check active user by handle
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.usernameNormalized, normalized))
    .limit(1);

  if (!user) {
    // 2. Check handle history for 301/308 redirect
    const [historyEntry] = await db
      .select({
        currentUsername: users.username,
        userStatus: users.status,
      })
      .from(handleHistory)
      .innerJoin(users, eq(handleHistory.userId, users.id))
      .where(eq(handleHistory.handleNormalized, normalized))
      .limit(1);

    if (historyEntry && historyEntry.userStatus === "active") {
      return {
        isRedirect: true,
        redirectTo: historyEntry.currentUsername,
      };
    }

    return null;
  }

  // 3. User must be active to have a public profile
  if (user.status !== "active") {
    return null;
  }

  // 4. Check avatar asset status if present
  let avatarUrl: string | null = null;
  if (user.avatarAssetId) {
    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, user.avatarAssetId), eq(assets.status, "READY")))
      .limit(1);

    if (asset) {
      avatarUrl = `/api/assets/${asset.id}/view`;
    }
  }

  // 5. Fetch published and public proofs, sorted by sort_order ASC, createdAt DESC
  const proofRows = await db
    .select({
      id: proofs.id,
      slug: proofs.slug,
      title: proofs.title,
      description: proofs.description,
      proofType: proofs.proofType,
      issuerNameText: proofs.issuerNameText,
      issuedAt: proofs.issuedAt,
      expiresAt: proofs.expiresAt,
      verificationStatus: proofs.verificationStatus,
      sortOrder: proofs.sortOrder,
      publishedAt: proofs.publishedAt,
      issuerName: issuers.name,
    })
    .from(proofs)
    .leftJoin(issuers, eq(proofs.issuerId, issuers.id))
    .where(
      and(
        eq(proofs.userId, user.id),
        eq(proofs.lifecycleState, "PUBLISHED"),
        eq(proofs.visibility, "public")
      )
    )
    .orderBy(asc(proofs.sortOrder), desc(proofs.createdAt));

  const now = new Date();
  const publicProofs: PublicProofItem[] = proofRows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    proofType: p.proofType,
    issuerDisplayName: p.issuerName || p.issuerNameText,
    issuedAt: p.issuedAt,
    expiresAt: p.expiresAt,
    effectiveStatus: getEffectiveVerificationStatus(p.verificationStatus, p.expiresAt, now),
    sortOrder: p.sortOrder,
    publishedAt: p.publishedAt,
  }));

  return {
    isRedirect: false,
    user: {
      id: user.id,
      username: user.username,
      usernameNormalized: user.usernameNormalized,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl,
      createdAt: user.createdAt,
    },
    proofs: publicProofs,
  };
}
