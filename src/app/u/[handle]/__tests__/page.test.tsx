import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfilePage, { generateMetadata } from "../page";
import * as profileService from "@/services/profile";
import * as navigation from "next/navigation";

vi.mock("@/services/profile", () => ({
  getPublicProfile: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
}));

describe("Public Profile Page Route (M3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateMetadata", () => {
    it("returns noindex metadata when profile is not found", async () => {
      vi.mocked(profileService.getPublicProfile).mockResolvedValue(null);

      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "unknown" }),
      });

      expect(metadata.title).toBe("Profile Not Found — Proof");
      expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it("returns canonical @handle URL and OpenGraph data for active profile", async () => {
      vi.mocked(profileService.getPublicProfile).mockResolvedValue({
        isRedirect: false,
        user: {
          id: "1",
          username: "saturn",
          usernameNormalized: "saturn",
          displayName: "Saturn V",
          bio: "Rocket propulsion engineer.",
          avatarUrl: null,
          createdAt: new Date(),
        },
        proofs: [],
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "saturn" }),
      });

      expect(metadata.title).toBe("Saturn V (@saturn) — Proof");
      expect(metadata.alternates?.canonical).toBe("https://proof.so/@saturn");
      expect(metadata.openGraph?.url).toBe("https://proof.so/@saturn");
      expect((metadata.openGraph as Record<string, unknown>)?.type).toBe("profile");
      expect(metadata.robots).toEqual({ index: true, follow: true });
    });
  });

  describe("ProfilePage Component", () => {
    it("calls notFound() when getPublicProfile returns null", async () => {
      vi.mocked(profileService.getPublicProfile).mockResolvedValue(null);

      await ProfilePage({
        params: Promise.resolve({ handle: "ghost" }),
      });

      expect(navigation.notFound).toHaveBeenCalled();
    });

    it("calls permanentRedirect() to canonical handle when handle was changed", async () => {
      vi.mocked(profileService.getPublicProfile).mockResolvedValue({
        isRedirect: true,
        redirectTo: "akshay",
      });

      await ProfilePage({
        params: Promise.resolve({ handle: "oldakshay" }),
      });

      expect(navigation.permanentRedirect).toHaveBeenCalledWith("/@akshay");
    });

    it("renders empty state when profile has zero published proofs", async () => {
      vi.mocked(profileService.getPublicProfile).mockResolvedValue({
        isRedirect: false,
        user: {
          id: "1",
          username: "emptyuser",
          usernameNormalized: "emptyuser",
          displayName: "Empty User",
          bio: "Nothing here yet.",
          avatarUrl: null,
          createdAt: new Date(),
        },
        proofs: [],
      });

      const jsx = await ProfilePage({
        params: Promise.resolve({ handle: "emptyuser" }),
      });

      render(jsx);

      expect(screen.getByText("Empty User")).toBeInTheDocument();
      expect(screen.getAllByText(/@emptyuser/).length).toBeGreaterThan(0);
      expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
      expect(screen.getByText("No Proofs Published")).toBeInTheDocument();
    });

    it("renders published proofs index and secure social links", async () => {
      vi.mocked(profileService.getPublicProfile).mockResolvedValue({
        isRedirect: false,
        user: {
          id: "1",
          username: "alice",
          usernameNormalized: "alice",
          displayName: "Alice Smith",
          bio: "Software Architect. Find me at https://github.com/alice or http://insecure.org",
          avatarUrl: null,
          createdAt: new Date(),
        },
        proofs: [
          {
            id: "p1",
            slug: "arch-cert",
            title: "Architecture Master Certified",
            description: "High scale distributed systems",
            proofType: "certificate",
            issuerDisplayName: "Software Institute",
            issuedAt: new Date("2026-04-10"),
            expiresAt: null,
            effectiveStatus: "ISSUER_VERIFIED",
            sortOrder: 1,
            publishedAt: new Date("2026-04-10"),
          },
        ],
      });

      const jsx = await ProfilePage({
        params: Promise.resolve({ handle: "alice" }),
      });

      render(jsx);

      // Verify profile header
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getAllByText(/@alice/).length).toBeGreaterThan(0);

      // Verify social links: only https://github.com/alice rendered with secure attributes
      const link = screen.getByRole("link", { name: /github\.com/i });
      expect(link).toHaveAttribute("href", "https://github.com/alice");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");

      // Verify proof item in editorial index
      expect(screen.getByText("Architecture Master Certified")).toBeInTheDocument();
      expect(screen.getByText("Software Institute")).toBeInTheDocument();
      expect(screen.getByText("Issuer Verified")).toBeInTheDocument();

      // Verify proof link points to canonical @alice/arch-cert
      const proofLink = screen.getByRole("link", { name: /Architecture Master Certified/i });
      expect(proofLink).toHaveAttribute("href", "/@alice/arch-cert");
    });
  });
});
