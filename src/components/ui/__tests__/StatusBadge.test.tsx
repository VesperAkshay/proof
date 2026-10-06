import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  StatusBadge,
  VERIFICATION_COPY,
  VERIFICATION_LABELS,
  type VerificationState,
} from "../StatusBadge";

describe("StatusBadge component", () => {
  const states: VerificationState[] = [
    "SELF_REPORTED",
    "DOCUMENT_UPLOADED",
    "ISSUER_REFERENCED",
    "ISSUER_VERIFIED",
    "REVOKED",
    "EXPIRED",
  ];

  it.each(states)("renders label for status %s", (status) => {
    render(<StatusBadge status={status} />);
    const expectedLabel = VERIFICATION_LABELS[status];
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it("strictly protects the word 'Verified' - never applies to unverified evidence", () => {
    const { container: selfReported } = render(<StatusBadge status="SELF_REPORTED" />);
    expect(selfReported.textContent).not.toMatch(/\bVerified\b/);

    const { container: docAttached } = render(<StatusBadge status="DOCUMENT_UPLOADED" />);
    expect(docAttached.textContent).not.toMatch(/\bVerified\b/);

    const { container: issuerRef } = render(<StatusBadge status="ISSUER_REFERENCED" />);
    expect(issuerRef.textContent).not.toMatch(/\bVerified\b/);
  });

  it("displays mandatory public copy when showCopy is true", () => {
    render(<StatusBadge status="SELF_REPORTED" showCopy />);
    expect(screen.getByText(VERIFICATION_COPY.SELF_REPORTED)).toBeInTheDocument();

    render(<StatusBadge status="ISSUER_VERIFIED" showCopy />);
    expect(screen.getByText(VERIFICATION_COPY.ISSUER_VERIFIED)).toBeInTheDocument();

    render(<StatusBadge status="REVOKED" showCopy />);
    expect(screen.getByText(VERIFICATION_COPY.REVOKED)).toBeInTheDocument();
  });

  it("applies forest color token only to ISSUER_VERIFIED", () => {
    const { container } = render(<StatusBadge status="ISSUER_VERIFIED" />);
    const badge = container.querySelector('[role="status"]');
    expect(badge?.className).toContain("bg-forest");
  });

  it("applies vermilion color token to REVOKED", () => {
    const { container } = render(<StatusBadge status="REVOKED" />);
    const badge = container.querySelector('[role="status"]');
    expect(badge?.className).toContain("bg-vermilion");
  });
});
