/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import robots from "../robots";
import sitemap from "../sitemap";
import { generateMetadata as generateProfileMetadata } from "../u/[handle]/page";
import { generateMetadata as generateProofMetadata } from "../u/[handle]/[slug]/page";
import * as profileService from "@/services/profile";
import * as proofService from "@/services/proof";
import { db } from "@/db/client";

vi.mock("@/services/profile", () => ({
  getPublicProfile: vi.fn(),
  extractSafeHttpsLinks: vi.fn().mockReturnValue([]),
}));

vi.mock("@/services/proof", () => ({
  getPublicProof: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("Milestone M12 — SEO, Discovery & Structured Data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Robots Configuration (robots.ts)", () => {
    it("generates correct robots rules disallowing private routes and pointing to sitemap", () => {
      const robotsResult = robots();

      expect(robotsResult.sitemap).toBe("https://proof.so/sitemap.xml");
      const rules = Array.isArray(robotsResult.rules)
        ? robotsResult.rules[0]
        : robotsResult.rules;

      expect(rules).toBeDefined();
      expect(rules?.allow).toContain("/");
      expect(rules?.allow).toContain("/@*");
      expect(rules?.disallow).toContain("/api/");
      expect(rules?.disallow).toContain("/dashboard/");
      expect(rules?.disallow).toContain("/u/");
    });
  });

  describe("Sitemap Generation (sitemap.ts)", () => {
    it("generates sitemap including root, active users, and published public proofs only", async () => {
      const mockActiveUsers = [
        { username: "alice", updatedAt: new Date("2026-10-01T00:00:00Z") },
        { username: "bob", updatedAt: new Date("2026-10-02T00:00:00Z") },
      ];

      const mockPublishedProofs = [
        {
          slug: "aws-cert",
          username: "alice",
          updatedAt: new Date("2026-10-03T00:00:00Z"),
        },
      ];

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockActiveUsers),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockPublishedProofs),
            }),
          }),
        });

      const sitemapEntries = await sitemap();

      // 1. Root route
      expect(sitemapEntries.some((e) => e.url === "https://proof.so")).toBe(true);

      // 2. Active user profiles with canonical @ form
      expect(sitemapEntries.some((e) => e.url === "https://proof.so/@alice")).toBe(true);
      expect(sitemapEntries.some((e) => e.url === "https://proof.so/@bob")).toBe(true);

      // 3. Published public proof with canonical @ form
      expect(
        sitemapEntries.some((e) => e.url === "https://proof.so/@alice/aws-cert")
      ).toBe(true);

      // 4. Ensure no internal /u/ routes are exposed in sitemap
      sitemapEntries.forEach((entry) => {
        expect(entry.url).not.toContain("/u/");
      });
    });
  });

  describe("Exit Gate: Structured-Data Validation", () => {
    it("validates Schema.org Person schema for profile page", () => {
      const user = {
        username: "sarah",
        displayName: "Sarah Connor",
        bio: "Cybernetics and systems researcher https://example.com",
        avatarUrl: "https://proof.so/avatar.png",
      };

      const canonicalUrl = `https://proof.so/@${user.username}`;
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Person",
        name: user.displayName || user.username,
        alternateName: `@${user.username}`,
        url: canonicalUrl,
        description: user.bio,
        sameAs: ["https://example.com"],
        image: user.avatarUrl,
      };

      // Ensure valid JSON serialization
      const serialized = JSON.stringify(jsonLd);
      const parsed = JSON.parse(serialized);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("Person");
      expect(parsed.name).toBe("Sarah Connor");
      expect(parsed.alternateName).toBe("@sarah");
      expect(parsed.url).toBe("https://proof.so/@sarah");
      expect(parsed.sameAs).toEqual(["https://example.com"]);
      expect(parsed.image).toBe("https://proof.so/avatar.png");
    });

    it("validates Schema.org EducationalOccupationalCredential schema for proof page", () => {
      const proof = {
        title: "AWS Certified Solutions Architect",
        description: "Professional AWS architectural credential",
        proofType: "certificate",
        issuerDisplayName: "Amazon Web Services",
        issuedAt: new Date("2023-01-15T00:00:00Z"),
        expiresAt: new Date("2026-01-15T00:00:00Z"),
        credentialId: "AWS-PSA-9912",
        slug: "aws-architect",
      };

      const user = {
        username: "sarah",
        displayName: "Sarah Connor",
      };

      const canonicalUrl = `https://proof.so/@${user.username}/${proof.slug}`;

      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "EducationalOccupationalCredential",
        name: proof.title,
        description: proof.description,
        credentialCategory: proof.proofType,
        recognizedBy: {
          "@type": "Organization",
          name: proof.issuerDisplayName,
        },
        validFrom: proof.issuedAt.toISOString(),
        validUntil: proof.expiresAt.toISOString(),
        identifier: proof.credentialId,
        url: canonicalUrl,
        author: {
          "@type": "Person",
          name: user.displayName,
          url: `https://proof.so/@${user.username}`,
        },
      };

      const serialized = JSON.stringify(jsonLd);
      const parsed = JSON.parse(serialized);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("EducationalOccupationalCredential");
      expect(parsed.name).toBe("AWS Certified Solutions Architect");
      expect(parsed.credentialCategory).toBe("certificate");
      expect(parsed.recognizedBy["@type"]).toBe("Organization");
      expect(parsed.recognizedBy.name).toBe("Amazon Web Services");
      expect(parsed.author["@type"]).toBe("Person");
      expect(parsed.author.url).toBe("https://proof.so/@sarah");
      expect(parsed.url).toBe("https://proof.so/@sarah/aws-architect");
    });
  });

  describe("Exit Gate: Canonical Correctness & Old Handle/Slug Redirects", () => {
    it("generates canonical URL with @ prefix for public profile", async () => {
      vi.mocked(profileService.getPublicProfile).mockResolvedValue({
        isRedirect: false,
        user: {
          id: "u-1",
          username: "akshay",
          usernameNormalized: "akshay",
          displayName: "Akshay Patel",
          bio: "Software Engineer",
          avatarUrl: "https://proof.so/avatar.png",
          createdAt: new Date(),
        },
        proofs: [],
      });

      const meta = await generateProfileMetadata({
        params: Promise.resolve({ handle: "akshay" }),
      });

      expect(meta.alternates?.canonical).toBe("https://proof.so/@akshay");
      expect(meta.openGraph?.url).toBe("https://proof.so/@akshay");
      expect(meta.robots).toEqual({ index: true, follow: true });
    });

    it("generates canonical URL with @ prefix for public proof", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: false,
        proof: {
          id: "p-1",
          userId: "u-1",
          slug: "aws-cert",
          title: "AWS Certification",
          description: "Certified Solutions Architect",
          proofType: "certificate",
          issuerDisplayName: "Amazon Web Services",
          visibility: "public",
          lifecycleState: "PUBLISHED",
        } as any,
        user: {
          id: "u-1",
          username: "akshay",
          displayName: "Akshay Patel",
        } as any,
        primaryAsset: null,
        assets: [],
      });

      const meta = await generateProofMetadata({
        params: Promise.resolve({ handle: "akshay", slug: "aws-cert" }),
      });

      expect(meta.alternates?.canonical).toBe("https://proof.so/@akshay/aws-cert");
      expect(meta.openGraph?.url).toBe("https://proof.so/@akshay/aws-cert");
      expect(meta.robots).toEqual({ index: true, follow: true });
    });

    it("applies noindex when profile is not found or handles a redirect", async () => {
      vi.mocked(profileService.getPublicProfile).mockResolvedValue({
        isRedirect: true,
        redirectTo: "newhandle",
      });

      const meta = await generateProfileMetadata({
        params: Promise.resolve({ handle: "oldhandle" }),
      });

      expect(meta.robots).toEqual({ index: false, follow: false });
    });

    it("applies noindex when proof is unlisted", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: false,
        proof: {
          id: "p-1",
          userId: "u-1",
          slug: "secret-doc",
          title: "Unlisted Proof",
          visibility: "unlisted",
          lifecycleState: "PUBLISHED",
        } as any,
        user: {
          id: "u-1",
          username: "akshay",
        } as any,
        primaryAsset: null,
        assets: [],
      });

      const meta = await generateProofMetadata({
        params: Promise.resolve({ handle: "akshay", slug: "secret-doc" }),
      });

      expect(meta.robots).toEqual({ index: false, follow: false });
    });

    it("applies noindex when proof is redirected from old slug", async () => {
      vi.mocked(proofService.getPublicProof).mockResolvedValue({
        isRedirect: true,
        redirectTo: "/@akshay/new-slug",
      });

      const meta = await generateProofMetadata({
        params: Promise.resolve({ handle: "akshay", slug: "old-slug" }),
      });

      expect(meta.robots).toEqual({ index: false, follow: false });
    });
  });
});
