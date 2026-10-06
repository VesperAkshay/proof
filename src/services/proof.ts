import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { proofs, proofSlugHistory, issuers, users, handleHistory, assets, proofAssets, type Proof } from "@/db/schema";
import { normalizeSlug, validateSlug, generateSlugSuggestions } from "@/lib/slug";
import { normalizeHandle } from "@/lib/handle";
import { isValidLifecycleTransition, type LifecycleState } from "@/db/transitions";
import { getEffectiveVerificationStatus } from "@/services/profile";
import type {
  CreateProofInput,
  UpdateProofInput,
} from "@/lib/validations/proof";
import type { VerificationState } from "@/components/ui/StatusBadge";

export class ProofError extends Error {
  code: string;
  statusCode: number;
  suggestions?: string[];

  constructor(code: string, statusCode: number, message: string, suggestions?: string[]) {
    super(message);
    this.name = "ProofError";
    this.code = code;
    this.statusCode = statusCode;
    this.suggestions = suggestions;
  }
}

export interface ProofResponseDTO {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string | null;
  proofType: string;
  issuerId: string | null;
  issuerNameText: string | null;
  issuerDisplayName: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  credentialId: string | null;
  credentialUrl: string | null;
  lifecycleState: string;
  visibility: string;
  verificationStatus: string;
  effectiveStatus: VerificationState;
  sortOrder: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapProofToDTO(
  proof: Proof,
  issuerName: string | null = null
): ProofResponseDTO {
  const effectiveStatus = getEffectiveVerificationStatus(
    proof.verificationStatus,
    proof.expiresAt
  );

  return {
    id: proof.id,
    userId: proof.userId,
    slug: proof.slug,
    title: proof.title,
    description: proof.description,
    proofType: proof.proofType,
    issuerId: proof.issuerId,
    issuerNameText: proof.issuerNameText,
    issuerDisplayName: issuerName || proof.issuerNameText,
    issuedAt: proof.issuedAt,
    expiresAt: proof.expiresAt,
    credentialId: proof.credentialId,
    credentialUrl: proof.credentialUrl,
    lifecycleState: proof.lifecycleState,
    visibility: proof.visibility,
    verificationStatus: proof.verificationStatus,
    effectiveStatus,
    sortOrder: proof.sortOrder,
    publishedAt: proof.publishedAt,
    createdAt: proof.createdAt,
    updatedAt: proof.updatedAt,
  };
}

/**
 * Checks whether a slug is already taken by the user either in proofs or slug history.
 */
async function isSlugTaken(userId: string, slug: string): Promise<boolean> {
  const [existingProof] = await db
    .select({ id: proofs.id })
    .from(proofs)
    .where(and(eq(proofs.userId, userId), eq(proofs.slug, slug)))
    .limit(1);

  if (existingProof) return true;

  const [existingHistory] = await db
    .select({ id: proofSlugHistory.id })
    .from(proofSlugHistory)
    .where(and(eq(proofSlugHistory.userId, userId), eq(proofSlugHistory.slug, slug)))
    .limit(1);

  return !!existingHistory;
}

/**
 * Creates a new proof in DRAFT state.
 */
export async function createProof(
  userId: string,
  data: CreateProofInput
): Promise<ProofResponseDTO> {
  let chosenSlug: string;

  if (data.slug) {
    if (!validateSlug(data.slug)) {
      throw new ProofError("INVALID_SLUG", 400, "Invalid slug format.");
    }
    const taken = await isSlugTaken(userId, data.slug);
    if (taken) {
      const suggestions = generateSlugSuggestions(data.slug);
      throw new ProofError(
        "SLUG_TAKEN",
        409,
        `Slug '${data.slug}' is already taken for your account.`,
        suggestions
      );
    }
    chosenSlug = data.slug;
  } else {
    // Generate slug from title
    const baseSlug = normalizeSlug(data.title);
    chosenSlug = baseSlug;
    let counter = 2;
    while (await isSlugTaken(userId, chosenSlug)) {
      chosenSlug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // Derive initial verification status based on provided issuer info
  const initialVerification =
    data.issuerId || data.issuerNameText ? "ISSUER_REFERENCED" : "SELF_REPORTED";

  const [newProof] = await db
    .insert(proofs)
    .values({
      userId,
      slug: chosenSlug,
      title: data.title,
      description: data.description,
      proofType: data.proofType,
      issuerId: data.issuerId,
      issuerNameText: data.issuerNameText,
      issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      credentialId: data.credentialId,
      credentialUrl: data.credentialUrl,
      lifecycleState: "DRAFT",
      visibility: data.visibility || "private",
      verificationStatus: initialVerification,
      sortOrder: 0,
    })
    .returning();

  if (!newProof) {
    throw new ProofError("INTERNAL_ERROR", 500, "Failed to create proof.");
  }

  return mapProofToDTO(newProof);
}

/**
 * Fetches a single proof by ID with strict owner validation (anti-IDOR).
 */
export async function getProofById(
  proofId: string,
  userId: string
): Promise<ProofResponseDTO> {
  const [proof] = await db
    .select({
      proof: proofs,
      issuerName: issuers.name,
    })
    .from(proofs)
    .leftJoin(issuers, eq(proofs.issuerId, issuers.id))
    .where(and(eq(proofs.id, proofId), eq(proofs.userId, userId)))
    .limit(1);

  if (!proof) {
    throw new ProofError("NOT_FOUND", 404, "Proof not found.");
  }

  return mapProofToDTO(proof.proof, proof.issuerName);
}

/**
 * Lists all proofs for the authenticated user ordered by sort_order ASC, createdAt DESC.
 */
export async function listProofsForUser(userId: string): Promise<ProofResponseDTO[]> {
  const rows = await db
    .select({
      proof: proofs,
      issuerName: issuers.name,
    })
    .from(proofs)
    .leftJoin(issuers, eq(proofs.issuerId, issuers.id))
    .where(eq(proofs.userId, userId))
    .orderBy(asc(proofs.sortOrder), desc(proofs.createdAt));

  return rows.map((r) => mapProofToDTO(r.proof, r.issuerName));
}

/**
 * Updates a proof's metadata. Strictly forbids updating verificationStatus or lifecycleState directly.
 */
export async function updateProof(
  proofId: string,
  userId: string,
  data: UpdateProofInput
): Promise<ProofResponseDTO> {
  const [existing] = await db
    .select()
    .from(proofs)
    .where(and(eq(proofs.id, proofId), eq(proofs.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new ProofError("NOT_FOUND", 404, "Proof not found.");
  }

  // Determine updated verification status if owner changed issuer fields
  let nextVerificationStatus = existing.verificationStatus;
  if (
    existing.verificationStatus === "SELF_REPORTED" ||
    existing.verificationStatus === "ISSUER_REFERENCED"
  ) {
    const nextIssuerName =
      data.issuerNameText !== undefined ? data.issuerNameText : existing.issuerNameText;
    const nextIssuerId =
      data.issuerId !== undefined ? data.issuerId : existing.issuerId;

    if (nextIssuerName || nextIssuerId) {
      nextVerificationStatus = "ISSUER_REFERENCED";
    } else {
      nextVerificationStatus = "SELF_REPORTED";
    }
  }

  const [updated] = await db
    .update(proofs)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.proofType !== undefined ? { proofType: data.proofType } : {}),
      ...(data.issuerNameText !== undefined ? { issuerNameText: data.issuerNameText } : {}),
      ...(data.issuerId !== undefined ? { issuerId: data.issuerId } : {}),
      ...(data.issuedAt !== undefined
        ? { issuedAt: data.issuedAt ? new Date(data.issuedAt) : null }
        : {}),
      ...(data.expiresAt !== undefined
        ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
        : {}),
      ...(data.credentialId !== undefined ? { credentialId: data.credentialId } : {}),
      ...(data.credentialUrl !== undefined ? { credentialUrl: data.credentialUrl } : {}),
      ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
      verificationStatus: nextVerificationStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(proofs.id, proofId), eq(proofs.userId, userId)))
    .returning();

  if (!updated) {
    throw new ProofError("NOT_FOUND", 404, "Proof not found.");
  }

  return mapProofToDTO(updated);
}

/**
 * Deletes a proof permanently.
 */
export async function deleteProof(proofId: string, userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: proofs.id })
    .from(proofs)
    .where(and(eq(proofs.id, proofId), eq(proofs.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new ProofError("NOT_FOUND", 404, "Proof not found.");
  }

  await db.delete(proofs).where(and(eq(proofs.id, proofId), eq(proofs.userId, userId)));
}

/**
 * Transitions editorial lifecycle state (DRAFT, PUBLISHED, ARCHIVED).
 * Enforces strict state machine rules (docs/data-model.md §State machines).
 */
export async function transitionLifecycle(
  proofId: string,
  userId: string,
  targetState: LifecycleState
): Promise<ProofResponseDTO> {
  const [existing] = await db
    .select()
    .from(proofs)
    .where(and(eq(proofs.id, proofId), eq(proofs.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new ProofError("NOT_FOUND", 404, "Proof not found.");
  }

  const currentState = existing.lifecycleState as LifecycleState;
  if (!isValidLifecycleTransition(currentState, targetState)) {
    throw new ProofError(
      "ILLEGAL_TRANSITION",
      409,
      `Cannot transition proof lifecycle state from '${currentState}' to '${targetState}'.`
    );
  }

  const isPublishing = targetState === "PUBLISHED" && currentState !== "PUBLISHED";

  const [updated] = await db
    .update(proofs)
    .set({
      lifecycleState: targetState,
      ...(isPublishing ? { publishedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(proofs.id, proofId), eq(proofs.userId, userId)))
    .returning();

  if (!updated) {
    throw new ProofError("NOT_FOUND", 404, "Proof not found.");
  }

  return mapProofToDTO(updated);
}

/**
 * Changes a proof's slug, recording the old slug in proof_slug_history to preserve permanent redirects.
 */
export async function changeProofSlug(
  proofId: string,
  userId: string,
  newSlug: string
): Promise<ProofResponseDTO> {
  if (!validateSlug(newSlug)) {
    throw new ProofError("INVALID_SLUG", 400, "Invalid slug format.");
  }

  const [existing] = await db
    .select()
    .from(proofs)
    .where(and(eq(proofs.id, proofId), eq(proofs.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new ProofError("NOT_FOUND", 404, "Proof not found.");
  }

  if (existing.slug === newSlug) {
    return mapProofToDTO(existing);
  }

  const taken = await isSlugTaken(userId, newSlug);
  if (taken) {
    const suggestions = generateSlugSuggestions(newSlug);
    throw new ProofError(
      "SLUG_TAKEN",
      409,
      `Slug '${newSlug}' is already taken for your account.`,
      suggestions
    );
  }

  return await db.transaction(async (tx) => {
    // Record old slug into history
    await tx.insert(proofSlugHistory).values({
      proofId: existing.id,
      userId,
      slug: existing.slug,
    });

    // Update proof slug
    const [updated] = await tx
      .update(proofs)
      .set({
        slug: newSlug,
        updatedAt: new Date(),
      })
      .where(and(eq(proofs.id, proofId), eq(proofs.userId, userId)))
      .returning();

    if (!updated) {
      throw new ProofError("NOT_FOUND", 404, "Proof not found.");
    }

    return mapProofToDTO(updated);
  });
}

/**
 * Reorders proofs for an owner by assigning sort_order corresponding to index.
 */
export async function reorderProofs(
  userId: string,
  proofIds: string[]
): Promise<void> {
  // Validate that all proof IDs belong to this user
  const userProofRows = await db
    .select({ id: proofs.id })
    .from(proofs)
    .where(and(eq(proofs.userId, userId), inArray(proofs.id, proofIds)));

  if (userProofRows.length !== proofIds.length) {
    throw new ProofError(
      "INVALID_PROOF_LIST",
      400,
      "One or more proof IDs are invalid or not owned by this account."
    );
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < proofIds.length; i++) {
      const id = proofIds[i];
      if (!id) continue;
      await tx
        .update(proofs)
        .set({
          sortOrder: i,
          updatedAt: new Date(),
        })
        .where(and(eq(proofs.id, id), eq(proofs.userId, userId)));
    }
  });
}

export interface PublicProofAssetDTO {
  id: string;
  role: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string | null;
  downloadUrl: string;
}

export interface PublicProofUserDTO {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

export interface PublicProofDetailDTO {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  proofType: string;
  issuerDisplayName: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  credentialId: string | null;
  credentialUrl: string | null;
  lifecycleState: string;
  visibility: string;
  verificationStatus: string;
  effectiveStatus: VerificationState;
  publishedAt: Date | null;
}

export type PublicProofResult =
  | {
      isRedirect: true;
      redirectTo: string;
    }
  | {
      isRedirect: false;
      user: PublicProofUserDTO;
      proof: PublicProofDetailDTO;
      primaryAsset: PublicProofAssetDTO | null;
      assets: PublicProofAssetDTO[];
    };

/**
 * Fetches the public proof details, associated ready assets, and owner info.
 * Enforces public visibility rules:
 * - Returns redirect descriptor on historical handle or slug change.
 * - Returns null (404) if user is inactive, proof is non-public, or proof is missing.
 */
export async function getPublicProof(
  handle: string,
  slug: string
): Promise<PublicProofResult | null> {
  const normalizedHandle = normalizeHandle(handle);

  // 1. Resolve user by usernameNormalized
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      avatarAssetId: users.avatarAssetId,
      status: users.status,
    })
    .from(users)
    .where(eq(users.usernameNormalized, normalizedHandle))
    .limit(1);

  if (!user) {
    // Check handleHistory for 301 handle redirect
    const [historyEntry] = await db
      .select({
        currentUsername: users.username,
        userStatus: users.status,
      })
      .from(handleHistory)
      .innerJoin(users, eq(handleHistory.userId, users.id))
      .where(eq(handleHistory.handleNormalized, normalizedHandle))
      .limit(1);

    if (historyEntry && historyEntry.userStatus === "active") {
      return {
        isRedirect: true,
        redirectTo: `/@${historyEntry.currentUsername}/${slug}`,
      };
    }

    return null;
  }

  // Suspended or deleted users are never publicly visible (404 + noindex)
  if (user.status !== "active") {
    return null;
  }

  // 2. Resolve proof by (userId, slug)
  const [proofRow] = await db
    .select({
      proof: proofs,
      issuerName: issuers.name,
    })
    .from(proofs)
    .leftJoin(issuers, eq(proofs.issuerId, issuers.id))
    .where(and(eq(proofs.userId, user.id), eq(proofs.slug, slug)))
    .limit(1);

  if (!proofRow) {
    // Check proofSlugHistory for 301 slug redirect
    const [slugHistoryEntry] = await db
      .select({
        currentSlug: proofs.slug,
        lifecycleState: proofs.lifecycleState,
        visibility: proofs.visibility,
      })
      .from(proofSlugHistory)
      .innerJoin(proofs, eq(proofSlugHistory.proofId, proofs.id))
      .where(
        and(
          eq(proofSlugHistory.userId, user.id),
          eq(proofSlugHistory.slug, slug)
        )
      )
      .limit(1);

    if (
      slugHistoryEntry &&
      slugHistoryEntry.lifecycleState === "PUBLISHED" &&
      (slugHistoryEntry.visibility === "public" || slugHistoryEntry.visibility === "unlisted")
    ) {
      return {
        isRedirect: true,
        redirectTo: `/@${user.username}/${slugHistoryEntry.currentSlug}`,
      };
    }

    return null;
  }

  const { proof, issuerName } = proofRow;

  // 3. Verification of public accessibility
  if (
    proof.lifecycleState !== "PUBLISHED" ||
    (proof.visibility !== "public" && proof.visibility !== "unlisted")
  ) {
    return null;
  }

  // 4. Resolve attached READY assets
  const attachedAssets = await db
    .select({
      proofAsset: proofAssets,
      asset: assets,
    })
    .from(proofAssets)
    .innerJoin(assets, eq(proofAssets.assetId, assets.id))
    .where(
      and(
        eq(proofAssets.proofId, proof.id),
        eq(assets.status, "READY"),
        eq(assets.ownerId, user.id)
      )
    )
    .orderBy(asc(proofAssets.sortOrder));

  const effectiveStatus = getEffectiveVerificationStatus(
    proof.verificationStatus,
    proof.expiresAt
  );

  const mappedAssets: PublicProofAssetDTO[] = attachedAssets.map(({ proofAsset, asset }) => {
    return {
      id: asset.id,
      role: proofAsset.role,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      previewUrl: `/api/assets/${asset.id}/preview`,
      downloadUrl: `/@${user.username}/${proof.slug}/download`,
    };
  });

  const primaryAsset =
    mappedAssets.find((a) => a.role === "evidence" || a.role === "cover") ||
    mappedAssets[0] ||
    null;

  let avatarUrl: string | null = null;
  if (user.avatarAssetId) {
    avatarUrl = `/api/assets/${user.avatarAssetId}/preview`;
  }

  return {
    isRedirect: false,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl,
    },
    proof: {
      id: proof.id,
      slug: proof.slug,
      title: proof.title,
      description: proof.description,
      proofType: proof.proofType,
      issuerDisplayName: issuerName || proof.issuerNameText,
      issuedAt: proof.issuedAt,
      expiresAt: proof.expiresAt,
      credentialId: proof.credentialId,
      credentialUrl: proof.credentialUrl,
      lifecycleState: proof.lifecycleState,
      visibility: proof.visibility,
      verificationStatus: proof.verificationStatus,
      effectiveStatus,
      publishedAt: proof.publishedAt,
    },
    primaryAsset,
    assets: mappedAssets,
  };
}
