export type LifecycleState = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AssetStatus =
  | "PENDING_UPLOAD"
  | "QUARANTINED"
  | "SCANNING"
  | "READY"
  | "REJECTED"
  | "DELETED";

export type VerificationStatus =
  | "SELF_REPORTED"
  | "DOCUMENT_UPLOADED"
  | "ISSUER_REFERENCED"
  | "ISSUER_VERIFIED"
  | "REVOKED";

export type ActorRole = "owner" | "admin" | "system" | "issuer";

/**
 * Validates editorial lifecycle state transitions (docs/data-model.md §State machines)
 * DRAFT -> PUBLISHED -> ARCHIVED
 * PUBLISHED -> DRAFT (unpublish)
 * ARCHIVED -> DRAFT | PUBLISHED (restore)
 */
export function isValidLifecycleTransition(
  from: LifecycleState,
  to: LifecycleState
): boolean {
  if (from === to) return true;

  switch (from) {
    case "DRAFT":
      return to === "PUBLISHED" || to === "ARCHIVED";
    case "PUBLISHED":
      return to === "DRAFT" || to === "ARCHIVED";
    case "ARCHIVED":
      return to === "DRAFT" || to === "PUBLISHED";
    default:
      return false;
  }
}

/**
 * Validates asset processing state transitions (docs/data-model.md §State machines)
 * PENDING_UPLOAD -> QUARANTINED -> SCANNING -> READY | REJECTED
 * any -> DELETED
 */
export function isValidAssetTransition(from: AssetStatus, to: AssetStatus): boolean {
  if (from === to) return true;
  if (from === "DELETED") return false; // Terminal state
  if (to === "DELETED") return true; // Any non-deleted state can transition to DELETED

  switch (from) {
    case "PENDING_UPLOAD":
      return to === "QUARANTINED";
    case "QUARANTINED":
      return to === "SCANNING" || to === "REJECTED";
    case "SCANNING":
      return to === "READY" || to === "REJECTED";
    case "READY":
    case "REJECTED":
      return false; // Can only transition to DELETED, which was checked above
    default:
      return false;
  }
}

/**
 * Validates verification status transitions and actor permissions (docs/data-model.md §State machines)
 * Owner may NEVER set ISSUER_VERIFIED or REVOKED.
 */
export function isValidVerificationTransition(
  from: VerificationStatus,
  to: VerificationStatus,
  actorRole: ActorRole
): boolean {
  if (from === to) return true;

  // Protected Word Rule: Owner can NEVER set ISSUER_VERIFIED or REVOKED
  if (actorRole === "owner") {
    if (to === "ISSUER_VERIFIED" || to === "REVOKED") {
      return false;
    }
  }

  // REVOKED can only be set by admin or issuer
  if (to === "REVOKED") {
    return actorRole === "admin" || actorRole === "issuer";
  }

  // Once REVOKED, only admin may alter state
  if (from === "REVOKED") {
    return actorRole === "admin";
  }

  switch (from) {
    case "SELF_REPORTED":
      if (to === "DOCUMENT_UPLOADED") return true;
      if (to === "ISSUER_REFERENCED") return true;
      if (to === "ISSUER_VERIFIED") return actorRole !== "owner";
      return false;

    case "DOCUMENT_UPLOADED":
      if (to === "SELF_REPORTED") return true; // evidence asset unattached
      if (to === "ISSUER_REFERENCED") return true;
      if (to === "ISSUER_VERIFIED") return actorRole !== "owner";
      return false;

    case "ISSUER_REFERENCED":
      if (to === "SELF_REPORTED") return true;
      if (to === "DOCUMENT_UPLOADED") return true;
      if (to === "ISSUER_VERIFIED") return actorRole !== "owner";
      return false;

    case "ISSUER_VERIFIED":
      // Can only transition to REVOKED, which was checked above
      return false;

    default:
      return false;
  }
}
