import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  proofs,
  issuers,
  verificationRecords,
  verificationEvents,
  type Issuer,
  type VerificationEvent,
} from "@/db/schema";
import {
  isValidVerificationTransition,
  type VerificationStatus,
  type ActorRole,
} from "@/db/transitions";
import { getEffectiveVerificationStatus } from "@/services/profile";
import type { ProofResponseDTO } from "@/services/proof";

export class VerificationError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = "VerificationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface CreateIssuerInput {
  name: string;
  websiteUrl?: string | null;
  domain?: string | null;
  verificationMethod?: string | null;
  createdBy?: string | null;
  status?: "active" | "pending_review" | "blocked";
}

export interface ConfirmVerificationInput {
  proofId: string;
  method: "issuer_url" | "issuer_api" | "email_domain" | "manual_admin";
  externalUrl?: string | null;
  evidence?: Record<string, unknown> | null;
  actorType: "system" | "admin" | "issuer";
  actorId: string;
  reason?: string;
}

export interface RevokeVerificationInput {
  proofId: string;
  actorType: "admin" | "issuer";
  actorId: string;
  reason: string;
}

/**
 * Creates an issuer record in the issuers directory.
 */
export async function createIssuer(data: CreateIssuerInput): Promise<Issuer> {
  if (!data.name || data.name.trim().length === 0) {
    throw new VerificationError("INVALID_ISSUER", 400, "Issuer name is required.");
  }

  const [issuer] = await db
    .insert(issuers)
    .values({
      name: data.name.trim(),
      websiteUrl: data.websiteUrl || null,
      domain: data.domain || null,
      verificationMethod: data.verificationMethod || null,
      createdBy: data.createdBy || null,
      status: data.status || "active",
    })
    .returning();

  if (!issuer) {
    throw new VerificationError("INTERNAL_ERROR", 500, "Failed to create issuer record.");
  }

  return issuer;
}

/**
 * Fetches an issuer by ID.
 */
export async function getIssuerById(id: string): Promise<Issuer | null> {
  const [issuer] = await db
    .select()
    .from(issuers)
    .where(eq(issuers.id, id))
    .limit(1);

  return issuer || null;
}

/**
 * Lists all active issuers.
 */
export async function listIssuers(): Promise<Issuer[]> {
  return await db
    .select()
    .from(issuers)
    .where(eq(issuers.status, "active"))
    .orderBy(issuers.name);
}

/**
 * Confirms verification through an authorized issuer or admin flow.
 * Security Invariant: Owner can NEVER call this. Transition is strictly validated.
 * Writes a record to verification_records AND appends to verification_events.
 */
export async function confirmVerification(
  input: ConfirmVerificationInput
): Promise<ProofResponseDTO> {
  const { proofId, method, externalUrl, evidence, actorType, actorId, reason } = input;

  // 1. Strict Actor check: owners can never confirm verification
  if ((actorType as string) === "owner") {
    throw new VerificationError(
      "UNAUTHORIZED_ACTOR",
      403,
      "Owners cannot verify their own credentials."
    );
  }

  // 2. Fetch target proof
  const [proof] = await db
    .select()
    .from(proofs)
    .where(eq(proofs.id, proofId))
    .limit(1);

  if (!proof) {
    throw new VerificationError("NOT_FOUND", 404, "Proof not found.");
  }

  const currentStatus = proof.verificationStatus as VerificationStatus;
  const targetStatus: VerificationStatus = "ISSUER_VERIFIED";

  // 3. State machine validation
  if (!isValidVerificationTransition(currentStatus, targetStatus, actorType as ActorRole)) {
    throw new VerificationError(
      "ILLEGAL_TRANSITION",
      409,
      `Cannot transition verification status from '${currentStatus}' to '${targetStatus}'.`
    );
  }

  return await db.transaction(async (tx) => {
    // 4. Update proof verification status
    const [updatedProof] = await tx
      .update(proofs)
      .set({
        verificationStatus: targetStatus,
        updatedAt: new Date(),
      })
      .where(eq(proofs.id, proofId))
      .returning();

    if (!updatedProof) {
      throw new VerificationError("NOT_FOUND", 404, "Proof not found.");
    }

    // 5. Insert verification record
    await tx.insert(verificationRecords).values({
      proofId,
      method,
      status: "CONFIRMED",
      externalUrl: externalUrl || null,
      evidence: evidence ? JSON.parse(JSON.stringify(evidence)) : null,
      confirmedAt: new Date(),
      actorType,
      actorId,
    });

    // 6. Append-only audit trail event
    await tx.insert(verificationEvents).values({
      proofId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      actorType,
      actorId,
      reason: reason || "Issuer verification confirmed",
    });

    return {
      id: updatedProof.id,
      userId: updatedProof.userId,
      slug: updatedProof.slug,
      title: updatedProof.title,
      description: updatedProof.description,
      proofType: updatedProof.proofType,
      issuerId: updatedProof.issuerId,
      issuerNameText: updatedProof.issuerNameText,
      issuerDisplayName: updatedProof.issuerNameText,
      issuedAt: updatedProof.issuedAt,
      expiresAt: updatedProof.expiresAt,
      credentialId: updatedProof.credentialId,
      credentialUrl: updatedProof.credentialUrl,
      lifecycleState: updatedProof.lifecycleState,
      visibility: updatedProof.visibility,
      verificationStatus: updatedProof.verificationStatus,
      effectiveStatus: getEffectiveVerificationStatus(
        updatedProof.verificationStatus,
        updatedProof.expiresAt
      ),
      sortOrder: updatedProof.sortOrder,
      publishedAt: updatedProof.publishedAt,
      createdAt: updatedProof.createdAt,
      updatedAt: updatedProof.updatedAt,
    };
  });
}

/**
 * Revokes a credential's verification status.
 * Security Invariant: Only admin or issuer can revoke. REVOKED overrides all display.
 * Writes to verification_records AND appends to verification_events audit log.
 */
export async function revokeVerification(
  input: RevokeVerificationInput
): Promise<ProofResponseDTO> {
  const { proofId, actorType, actorId, reason } = input;

  if (actorType !== "admin" && actorType !== "issuer") {
    throw new VerificationError(
      "UNAUTHORIZED_ACTOR",
      403,
      "Only issuers or system administrators may revoke verification."
    );
  }

  const [proof] = await db
    .select()
    .from(proofs)
    .where(eq(proofs.id, proofId))
    .limit(1);

  if (!proof) {
    throw new VerificationError("NOT_FOUND", 404, "Proof not found.");
  }

  const currentStatus = proof.verificationStatus as VerificationStatus;
  const targetStatus: VerificationStatus = "REVOKED";

  if (!isValidVerificationTransition(currentStatus, targetStatus, actorType as ActorRole)) {
    throw new VerificationError(
      "ILLEGAL_TRANSITION",
      409,
      `Cannot transition verification status from '${currentStatus}' to '${targetStatus}'.`
    );
  }

  return await db.transaction(async (tx) => {
    // 1. Update proof verification status to REVOKED
    const [updatedProof] = await tx
      .update(proofs)
      .set({
        verificationStatus: targetStatus,
        updatedAt: new Date(),
      })
      .where(eq(proofs.id, proofId))
      .returning();

    if (!updatedProof) {
      throw new VerificationError("NOT_FOUND", 404, "Proof not found.");
    }

    // 2. Mark any confirmed record as revoked
    await tx
      .update(verificationRecords)
      .set({
        status: "REVOKED",
        revokedAt: new Date(),
      })
      .where(eq(verificationRecords.proofId, proofId));

    // 3. Append-only audit trail event
    await tx.insert(verificationEvents).values({
      proofId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      actorType,
      actorId,
      reason,
    });

    return {
      id: updatedProof.id,
      userId: updatedProof.userId,
      slug: updatedProof.slug,
      title: updatedProof.title,
      description: updatedProof.description,
      proofType: updatedProof.proofType,
      issuerId: updatedProof.issuerId,
      issuerNameText: updatedProof.issuerNameText,
      issuerDisplayName: updatedProof.issuerNameText,
      issuedAt: updatedProof.issuedAt,
      expiresAt: updatedProof.expiresAt,
      credentialId: updatedProof.credentialId,
      credentialUrl: updatedProof.credentialUrl,
      lifecycleState: updatedProof.lifecycleState,
      visibility: updatedProof.visibility,
      verificationStatus: updatedProof.verificationStatus,
      effectiveStatus: getEffectiveVerificationStatus(
        updatedProof.verificationStatus,
        updatedProof.expiresAt
      ),
      sortOrder: updatedProof.sortOrder,
      publishedAt: updatedProof.publishedAt,
      createdAt: updatedProof.createdAt,
      updatedAt: updatedProof.updatedAt,
    };
  });
}

/**
 * Fetches the immutable verification audit trail for a proof.
 */
export async function getVerificationAuditTrail(
  proofId: string
): Promise<VerificationEvent[]> {
  return await db
    .select()
    .from(verificationEvents)
    .where(eq(verificationEvents.proofId, proofId))
    .orderBy(desc(verificationEvents.createdAt));
}
