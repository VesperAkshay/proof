import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProofPage, { generateMetadata } from "../page";
import * as proofService from "@/services/proof";
import * as navigation from "next/navigation";
import { VERIFICATION_COPY, type VerificationState } from "@/components/ui/StatusBadge";

vi.mock("@/services/proof", () => ({
  getPublicProof: vi.fn(),
}));

vi.mock("@/services/analytics", () => ({
  recordAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
}));

describe("Public Proof Page Route (M7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseUser: proofService.PublicProofUserDTO = {
    id: "user-1",
    username: "akshay",
    displayName: "Akshay Patel",
    bio: "Cloud Architect",
    avatarUrl: null,
  };

  const baseProof: proofService.PublicProofDetailDTO = {
    id: "proof-1",
    slug: "aws-solutions-architect",
    title: "AWS Certified Solutions Architect",
    description: "Architecting resilient distributed systems on AWS.",
    proofType: "certificate",
    issuerDisplayName: "Amazon Web Services",
    issuedAt: new Date("2024-01-15T00:00:00Z"),
    expiresAt: new Date("2027-01-15T00:00:00Z"),
    credentialId: "AWS-987654",
    credentialUrl: "https://aws.amazon.com/verify/987654",
    lifecycleState: "PUBLISHED",
    visibility: "public",
    verificationStatus: "ISSUER_VERIFIED",
    effectiveStatus: "ISSUER_VERIFIED",
    publishedAt: new Date("2024-01-16T00:00:00Z"),
  };

  const baseAsset: proofService.PublicProofAssetDTO = {
    id: "asset-1",
    role: "evidence",
    originalFilename: "aws-certificate.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1048576,
    previewUrl: null,
    downloadUrl: "/@akshay/aws-solutions-architect/download",
  };

  describe("generateMetadata", () => {
    it("returns noindex metadata when proof is not found or non-public", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue(null);

      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "akshay", slug: "non-existent" }),
      });

      expect(metadata.title).toBe("Proof Not Found — Proof");
      expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it("returns canonical @handle/slug URL, title, and OpenGraph tags for public proof", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: false,
        user: baseUser,
        proof: baseProof,
        primaryAsset: baseAsset,
        assets: [baseAsset],
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "akshay", slug: "aws-solutions-architect" }),
      });

      expect(metadata.title).toBe("AWS Certified Solutions Architect — Akshay Patel on Proof");
      expect(metadata.alternates?.canonical).toBe(
        "https://proof.so/@akshay/aws-solutions-architect"
      );
      expect(metadata.openGraph?.url).toBe(
        "https://proof.so/@akshay/aws-solutions-architect"
      );
      expect((metadata.openGraph as Record<string, unknown>)?.type).toBe("article");
      expect(metadata.robots).toEqual({ index: true, follow: true });
    });

    it("sets robots: noindex for unlisted public proof", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: false,
        user: baseUser,
        proof: { ...baseProof, visibility: "unlisted" },
        primaryAsset: baseAsset,
        assets: [baseAsset],
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "akshay", slug: "aws-solutions-architect" }),
      });

      expect(metadata.robots).toEqual({ index: false, follow: false });
    });
  });

  describe("ProofPage Component Rendering & Hierarchy", () => {
    it("calls notFound() when getPublicProof returns null", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue(null);

      await ProofPage({
        params: Promise.resolve({ handle: "akshay", slug: "missing" }),
      });

      expect(navigation.notFound).toHaveBeenCalled();
    });

    it("calls permanentRedirect() to canonical target when proof was renamed", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: true,
        redirectTo: "/@akshay/new-canonical-slug",
      });

      await ProofPage({
        params: Promise.resolve({ handle: "akshay", slug: "old-slug" }),
      });

      expect(navigation.permanentRedirect).toHaveBeenCalledWith(
        "/@akshay/new-canonical-slug"
      );
    });

    it("renders complete editorial hierarchy and document artifact", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: false,
        user: baseUser,
        proof: baseProof,
        primaryAsset: baseAsset,
        assets: [baseAsset],
      });

      const page = await ProofPage({
        params: Promise.resolve({ handle: "akshay", slug: "aws-solutions-architect" }),
      });

      render(page);

      // 1. Proof label and title
      expect(screen.getAllByText("CERTIFICATE").length).toBeGreaterThan(0);
      expect(
        screen.getByRole("heading", { name: "AWS Certified Solutions Architect", level: 1 })
      ).toBeInTheDocument();

      // 2. Metadata rows
      expect(screen.getByText("Amazon Web Services")).toBeInTheDocument();
      expect(screen.getByText("AWS-987654")).toBeInTheDocument();
      expect(screen.getByText("JAN 2024")).toBeInTheDocument();
      expect(screen.getByText("JAN 2027")).toBeInTheDocument();

      // 3. Document frame
      expect(screen.getByText("Document Artifact")).toBeInTheDocument();
      expect(screen.getByText("aws-certificate.pdf")).toBeInTheDocument();

      // 4. Description section
      expect(
        screen.getByText("Architecting resilient distributed systems on AWS.")
      ).toBeInTheDocument();

      // 5. External link
      const verifyLink = screen.getByRole("link", { name: /VERIFY EXTERNAL/i });
      expect(verifyLink).toHaveAttribute("href", "https://aws.amazon.com/verify/987654");
      expect(verifyLink).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
    });
  });

  describe("Status Copy & Protected Word Invariants", () => {
    const verificationStates: VerificationState[] = [
      "SELF_REPORTED",
      "DOCUMENT_UPLOADED",
      "ISSUER_REFERENCED",
      "ISSUER_VERIFIED",
      "REVOKED",
      "EXPIRED",
    ];

    it.each(verificationStates)(
      "displays exact product-spec copy for %s status",
      async (status) => {
        vi.mocked(proofService.getPublicProof).mockResolvedValue({
          isRedirect: false,
          user: baseUser,
          proof: {
            ...baseProof,
            verificationStatus: status,
            effectiveStatus: status,
          },
          primaryAsset: baseAsset,
          assets: [baseAsset],
        });

        const page = await ProofPage({
          params: Promise.resolve({ handle: "akshay", slug: "aws-solutions-architect" }),
        });

        const { container } = render(page);
        const expectedCopy = VERIFICATION_COPY[status];
        expect(container.textContent).toContain(expectedCopy);
      }
    );

    it("strictly protects the word 'Verified': never applied to unverified states", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: false,
        user: baseUser,
        proof: {
          ...baseProof,
          verificationStatus: "SELF_REPORTED",
          effectiveStatus: "SELF_REPORTED",
        },
        primaryAsset: baseAsset,
        assets: [baseAsset],
      });

      const page = await ProofPage({
        params: Promise.resolve({ handle: "akshay", slug: "aws-solutions-architect" }),
      });

      render(page);
      // Status badge should not say Issuer Verified
      expect(screen.queryByText("Issuer Verified")).not.toBeInTheDocument();
      expect(screen.getByText("Self Reported")).toBeInTheDocument();
    });
  });

  describe("XSS Prevention on User Surfaces", () => {
    it("safely escapes HTML tags in title, description, and credentialId", async () => {
      const maliciousProof: proofService.PublicProofDetailDTO = {
        ...baseProof,
        title: "<script>alert('pwned-title')</script>",
        description: "<img src=x onerror=alert('pwned-desc') />",
        credentialId: "<b>AWS-INJECT</b>",
        credentialUrl: "javascript:alert('pwned-link')", // must not be rendered as link
      };

      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: false,
        user: {
          ...baseUser,
          displayName: "<svg onload=alert('pwned-user')>",
        },
        proof: maliciousProof,
        primaryAsset: baseAsset,
        assets: [baseAsset],
      });

      const page = await ProofPage({
        params: Promise.resolve({ handle: "akshay", slug: "xss-proof" }),
      });

      const { container } = render(page);

      // Verify that no raw script, img, or svg execution tags are injected into DOM
      expect(container.querySelector("script:not([type='application/ld+json'])")).toBeNull();
      expect(container.querySelector("img[src='x']")).toBeNull();
      expect(container.querySelector("svg[onload]")).toBeNull();

      // Verify that javascript: link was rejected
      expect(container.querySelector("a[href^='javascript:']")).toBeNull();

      // Verify safe text rendering
      expect(screen.getByText("<script>alert('pwned-title')</script>")).toBeInTheDocument();
      expect(screen.getByText("<b>AWS-INJECT</b>")).toBeInTheDocument();
    });
  });

  describe("QR Code & Sharing Integration (M9)", () => {
    it("renders QR Code links in header, print banner, and footer", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: false,
        user: baseUser,
        proof: baseProof,
        primaryAsset: baseAsset,
        assets: [baseAsset],
      });

      const page = await ProofPage({
        params: Promise.resolve({ handle: "akshay", slug: "aws-solutions-architect" }),
      });

      const { container } = render(page);

      const qrHeaderLink = screen.getByRole("link", { name: /QR CODE/i });
      expect(qrHeaderLink).toHaveAttribute(
        "href",
        "/@akshay/aws-solutions-architect/qr.svg"
      );

      const printImg = container.querySelector("img[alt='Verification QR code']");
      expect(printImg).not.toBeNull();
      expect(printImg).toHaveAttribute(
        "src",
        "/@akshay/aws-solutions-architect/qr.svg"
      );

      expect(screen.getByRole("link", { name: "QR (SVG)" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "QR (PNG)" })).toBeInTheDocument();
    });

    it("triggers qr_scan analytics event when visited with ?ref=qr", async () => {
      const analyticsModule = await import("@/services/analytics");
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: false,
        user: baseUser,
        proof: baseProof,
        primaryAsset: baseAsset,
        assets: [baseAsset],
      });

      await ProofPage({
        params: Promise.resolve({ handle: "akshay", slug: "aws-solutions-architect" }),
        searchParams: Promise.resolve({ ref: "qr" }),
      });

      expect(analyticsModule.recordAnalyticsEvent).toHaveBeenCalledWith({
        eventType: "qr_scan",
        profileUserId: "user-1",
        proofId: "proof-1",
      });
    });
  });
});

