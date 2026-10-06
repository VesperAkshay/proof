import React from "react";
import { clsx } from "clsx";

export type VerificationState =
  | "SELF_REPORTED"
  | "DOCUMENT_UPLOADED"
  | "ISSUER_REFERENCED"
  | "ISSUER_VERIFIED"
  | "REVOKED"
  | "EXPIRED";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: VerificationState;
  showCopy?: boolean;
}

export const VERIFICATION_COPY: Record<VerificationState, string> = {
  SELF_REPORTED: "Uploaded by the profile owner. Proof does not independently verify this claim.",
  DOCUMENT_UPLOADED: "Original document uploaded by the profile owner.",
  ISSUER_REFERENCED: "Issuer information supplied by the profile owner.",
  ISSUER_VERIFIED: "Verification confirmed through an issuer-controlled mechanism.",
  REVOKED: "Credential has been revoked.",
  EXPIRED: "Credential has passed its stated validity date.",
};

export const VERIFICATION_LABELS: Record<VerificationState, string> = {
  SELF_REPORTED: "Self Reported",
  DOCUMENT_UPLOADED: "Document Attached",
  ISSUER_REFERENCED: "Issuer Referenced",
  ISSUER_VERIFIED: "Issuer Verified",
  REVOKED: "Revoked",
  EXPIRED: "Expired",
};

export function StatusBadge({ status, showCopy = false, className, ...props }: StatusBadgeProps) {
  const label = VERIFICATION_LABELS[status];
  const copy = VERIFICATION_COPY[status];

  return (
    <div className={clsx("inline-flex flex-col gap-1.5", className)} {...props}>
      <span
        role="status"
        className={clsx(
          "inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs uppercase tracking-wider font-semibold rounded-sm select-none w-fit",
          // Color mappings per design-system.md
          status === "ISSUER_VERIFIED" && "bg-forest text-paper border border-forest",
          status === "REVOKED" && "bg-vermilion text-paper border border-vermilion",
          (status === "DOCUMENT_UPLOADED" || status === "ISSUER_REFERENCED") &&
            "bg-transparent text-ink border border-rule",
          status === "SELF_REPORTED" && "bg-warm-gray text-ink border border-warm-gray",
          status === "EXPIRED" && "bg-transparent text-ink/70 border border-rule-soft line-through"
        )}
      >
        <span
          className={clsx(
            "w-1.5 h-1.5 rounded-full inline-block",
            status === "ISSUER_VERIFIED" && "bg-paper",
            status === "REVOKED" && "bg-paper",
            status === "DOCUMENT_UPLOADED" && "bg-ink",
            status === "ISSUER_REFERENCED" && "bg-ink",
            status === "SELF_REPORTED" && "bg-ink/70",
            status === "EXPIRED" && "bg-ink/40"
          )}
          aria-hidden="true"
        />
        <span>{label}</span>
      </span>

      {showCopy && (
        <p className="font-body text-xs text-ink/80 leading-normal max-w-sm">
          {copy}
        </p>
      )}
    </div>
  );
}
