import { eq, and, desc, sql, count, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { reports, auditLog, users, proofs, type Report } from "@/db/schema";
import type { ApiErrorCode } from "@/lib/api";

export class TrustError extends Error {
  code: ApiErrorCode;
  statusCode: number;

  constructor(code: ApiErrorCode, statusCode: number, message: string) {
    super(message);
    this.name = "TrustError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface CreateReportParams {
  reporterUserId?: string | null;
  targetType: "proof" | "profile";
  targetId: string;
  reason: "impersonation" | "spam" | "copyright" | "fraud" | "harassment" | "other";
  details?: string | null;
}

export interface ReportDTO {
  id: string;
  reporterUserId: string | null;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  handledBy: string | null;
  createdAt: Date;
}

export interface ListReportsOptions {
  status?: "OPEN" | "ACTIONED" | "DISMISSED";
  targetType?: "proof" | "profile";
  limit?: number;
  offset?: number;
}

export function mapReportToDTO(report: Report): ReportDTO {
  return {
    id: report.id,
    reporterUserId: report.reporterUserId,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    details: report.details,
    status: report.status,
    handledBy: report.handledBy,
    createdAt: report.createdAt,
  };
}

/**
 * Creates an abuse or impersonation report for a proof or user profile.
 * Verifies that the target exists in the database.
 */
export async function createReport(params: CreateReportParams): Promise<ReportDTO> {
  const { reporterUserId, targetType, targetId, reason, details } = params;

  // 1. Verify target existence
  if (targetType === "proof") {
    const [proofExists] = await db
      .select({ id: proofs.id })
      .from(proofs)
      .where(eq(proofs.id, targetId))
      .limit(1);

    if (!proofExists) {
      throw new TrustError("NOT_FOUND", 404, "Target proof not found.");
    }
  } else if (targetType === "profile") {
    const [userExists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!userExists) {
      throw new TrustError("NOT_FOUND", 404, "Target profile not found.");
    }
  }

  // 2. Insert report
  const [newReport] = await db
    .insert(reports)
    .values({
      reporterUserId: reporterUserId || null,
      targetType,
      targetId,
      reason,
      details: details || null,
      status: "OPEN",
    })
    .returning();

  if (!newReport) {
    throw new TrustError("INTERNAL_ERROR", 500, "Failed to submit abuse report.");
  }

  return mapReportToDTO(newReport);
}

/**
 * Lists abuse reports in the moderation queue with filtering and pagination.
 */
export async function listReports(options: ListReportsOptions = {}): Promise<{
  reports: ReportDTO[];
  total: number;
}> {
  const { status, targetType, limit = 50, offset = 0 } = options;

  const conditions = [];
  if (status) {
    conditions.push(eq(reports.status, status));
  }
  if (targetType) {
    conditions.push(eq(reports.targetType, targetType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(reports)
    .where(whereClause);

  const reportRows = await db
    .select()
    .from(reports)
    .where(whereClause)
    .orderBy(desc(reports.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    reports: reportRows.map(mapReportToDTO),
    total: totalResult ? Number(totalResult.count) : 0,
  };
}

/**
 * Updates the resolution status of an abuse report in the queue.
 */
export async function resolveReport(
  reportId: string,
  status: "ACTIONED" | "DISMISSED",
  handledBy: string
): Promise<ReportDTO> {
  const [existing] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!existing) {
    throw new TrustError("NOT_FOUND", 404, "Report not found.");
  }

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(reports)
      .set({
        status,
        handledBy,
      })
      .where(eq(reports.id, reportId))
      .returning();

    if (!updated) {
      throw new TrustError("NOT_FOUND", 404, "Report not found.");
    }

    await tx.insert(auditLog).values({
      action: "REPORT_RESOLVED",
      actorType: "admin",
      actorId: handledBy,
      targetType: "report",
      targetId: reportId,
      metadata: { previousStatus: existing.status, newStatus: status },
    });

    return mapReportToDTO(updated);
  });
}

/**
 * Takedown proof: transitions lifecycleState to ARCHIVED and visibility to private.
 * Immediately propagates: public page, downloads, and preview endpoints return 404.
 * Logs an append-only entry in audit_log.
 */
export async function takedownProof(
  proofId: string,
  reason: string,
  adminActorId: string
): Promise<{ success: boolean; proofId: string }> {
  const [proof] = await db
    .select()
    .from(proofs)
    .where(eq(proofs.id, proofId))
    .limit(1);

  if (!proof) {
    throw new TrustError("NOT_FOUND", 404, "Proof not found.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(proofs)
      .set({
        lifecycleState: "ARCHIVED",
        visibility: "private",
        updatedAt: new Date(),
      })
      .where(eq(proofs.id, proofId));

    await tx.insert(auditLog).values({
      action: "PROOF_TAKEDOWN",
      actorType: "admin",
      actorId: adminActorId,
      targetType: "proof",
      targetId: proofId,
      metadata: { reason, previousState: proof.lifecycleState, previousVisibility: proof.visibility },
    });
  });

  return { success: true, proofId };
}

/**
 * Restores a taken-down proof to published status.
 */
export async function restoreProof(
  proofId: string,
  reason: string,
  adminActorId: string
): Promise<{ success: boolean; proofId: string }> {
  const [proof] = await db
    .select()
    .from(proofs)
    .where(eq(proofs.id, proofId))
    .limit(1);

  if (!proof) {
    throw new TrustError("NOT_FOUND", 404, "Proof not found.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(proofs)
      .set({
        lifecycleState: "PUBLISHED",
        visibility: "public",
        updatedAt: new Date(),
      })
      .where(eq(proofs.id, proofId));

    await tx.insert(auditLog).values({
      action: "PROOF_RESTORED",
      actorType: "admin",
      actorId: adminActorId,
      targetType: "proof",
      targetId: proofId,
      metadata: { reason },
    });
  });

  return { success: true, proofId };
}

/**
 * Suspends a user account: sets users.status = 'suspended'.
 * Immediately propagates: public profile and all user proofs return 404.
 * Logs an append-only entry in audit_log.
 */
export async function suspendUser(
  userId: string,
  reason: string,
  adminActorId: string
): Promise<{ success: boolean; userId: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new TrustError("NOT_FOUND", 404, "User not found.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        status: "suspended",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await tx.insert(auditLog).values({
      action: "USER_SUSPENDED",
      actorType: "admin",
      actorId: adminActorId,
      targetType: "user",
      targetId: userId,
      metadata: { reason, previousStatus: user.status },
    });
  });

  return { success: true, userId };
}

/**
 * Unsuspends a user account: restores users.status = 'active'.
 */
export async function unsuspendUser(
  userId: string,
  reason: string,
  adminActorId: string
): Promise<{ success: boolean; userId: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new TrustError("NOT_FOUND", 404, "User not found.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await tx.insert(auditLog).values({
      action: "USER_UNSUSPENDED",
      actorType: "admin",
      actorId: adminActorId,
      targetType: "user",
      targetId: userId,
      metadata: { reason },
    });
  });

  return { success: true, userId };
}

/**
 * Spam detection heuristics: detects known high-risk phrases, casino/crypto scams,
 * and high URL density.
 */
export function detectSpamContent(content: string): {
  isSpam: boolean;
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  if (!content) {
    return { isSpam: false, score: 0, reasons: [] };
  }

  const lower = content.toLowerCase();

  // 1. Phishing & scam keywords
  const spamKeywords = [
    "free crypto",
    "free bitcoin",
    "claim airdrop",
    "guaranteed returns",
    "earn money fast",
    "casino bonus",
    "viagra",
    "cialis",
    "whatsapp +",
    "telegram @",
    "double your investment",
    "send eth to",
  ];

  for (const keyword of spamKeywords) {
    if (lower.includes(keyword)) {
      score += 30;
      reasons.push(`Contains high-risk scam phrase: "${keyword}"`);
    }
  }

  // 2. High URL density
  const urlMatches = content.match(/https?:\/\/[^\s]+/g);
  const urlCount = urlMatches ? urlMatches.length : 0;
  if (urlCount >= 3 && content.length < 200) {
    score += 40;
    reasons.push(`Suspicious URL density: ${urlCount} links in ${content.length} characters`);
  }

  // 3. Excessive repetitive characters / words
  const repeatedPattern = /(.)\1{6,}/;
  if (repeatedPattern.test(content)) {
    score += 20;
    reasons.push("Excessive repeating characters detected");
  }

  return {
    isSpam: score >= 50,
    score,
    reasons,
  };
}

/**
 * Detects suspicious user activity:
 * 1. Rapid proof creation (> 10 proofs in last 10 minutes)
 * 2. High open abuse reports threshold (>= 3 open reports against this user or their proofs)
 */
export async function detectSuspiciousAccountActivity(userId: string): Promise<{
  isSuspicious: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  // 1. Check proof creation frequency
  const [recentProofs] = await db
    .select({ count: count() })
    .from(proofs)
    .where(and(eq(proofs.userId, userId), sql`${proofs.createdAt} > ${tenMinutesAgo}`));

  const proofCount = recentProofs ? Number(recentProofs.count) : 0;
  if (proofCount > 10) {
    reasons.push(`High creation velocity: ${proofCount} proofs created in the last 10 minutes.`);
  }

  // 2. Check open abuse reports targeting this user directly
  const [profileReports] = await db
    .select({ count: count() })
    .from(reports)
    .where(and(eq(reports.targetType, "profile"), eq(reports.targetId, userId), eq(reports.status, "OPEN")));

  // Check open abuse reports targeting user's proofs
  const userProofIds = await db
    .select({ id: proofs.id })
    .from(proofs)
    .where(eq(proofs.userId, userId));

  let proofReportsCount = 0;
  if (userProofIds.length > 0) {
    const ids = userProofIds.map((p) => p.id);
    const [proofReports] = await db
      .select({ count: count() })
      .from(reports)
      .where(and(eq(reports.targetType, "proof"), inArray(reports.targetId, ids), eq(reports.status, "OPEN")));
    proofReportsCount = proofReports ? Number(proofReports.count) : 0;
  }

  const totalOpenReports = (profileReports ? Number(profileReports.count) : 0) + proofReportsCount;
  if (totalOpenReports >= 3) {
    reasons.push(`Multiple abuse reports: ${totalOpenReports} open reports filed against account.`);
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
  };
}
