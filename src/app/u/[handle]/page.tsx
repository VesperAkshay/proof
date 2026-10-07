import React from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile } from "@/services/profile";
import { extractSafeHttpsLinks, EXTERNAL_LINK_PROPS } from "@/lib/urls";
import { Avatar, EmptyState, IndexList, IndexItem, SectionNumber } from "@/components/ui";

interface ProfilePageProps {
  params: Promise<{ handle: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://proof.so";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const result = await getPublicProfile(handle);

  if (!result || result.isRedirect) {
    return {
      title: "Profile Not Found — Proof",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { user } = result;
  const canonicalUrl = `${BASE_URL}/@${user.username}`;
  const title = `${user.displayName || user.username} (@${user.username}) — Proof`;
  const description =
    user.bio ||
    `${user.displayName || user.username}'s credentials, certificates, and evidence index on Proof.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Proof",
      type: "profile",
      username: user.username,
      ...(user.avatarUrl ? { images: [{ url: user.avatarUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(user.avatarUrl ? { images: [user.avatarUrl] } : {}),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

function formatMetaDate(date: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
}

function getDomainDisplay(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const result = await getPublicProfile(handle);

  if (!result) {
    notFound();
    return null;
  }

  if (result.isRedirect) {
    permanentRedirect(`/@${result.redirectTo}`);
    return null;
  }

  const { user, proofs } = result;
  const safeLinks = extractSafeHttpsLinks(user.bio);
  const canonicalUrl = `${BASE_URL}/@${user.username}`;

  // JSON-LD structured data per Schema.org Person specification
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: user.displayName || user.username,
    alternateName: `@${user.username}`,
    url: canonicalUrl,
    ...(user.bio ? { description: user.bio } : {}),
    ...(safeLinks.length > 0 ? { sameAs: safeLinks } : {}),
    ...(user.avatarUrl ? { image: user.avatarUrl } : {}),
  };

  return (
    <main className="min-h-screen bg-paper text-ink max-w-grid mx-auto px-4 sm:px-8 md:px-12 py-6 sm:py-10 flex flex-col justify-between selection:bg-cobalt selection:text-paper">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Header Bar */}
      <header className="flex justify-between items-center border-b border-rule pb-4 mb-8 sm:mb-12">
        <Link
          href="/"
          className="font-display font-black text-xl tracking-tight text-ink hover:text-cobalt transition-colors focus-visible:outline-2 focus-visible:outline-focus"
        >
          PROOF
        </Link>
        <span className="font-mono text-xs uppercase tracking-mono text-ink/60">
          INDEX / @{user.username}
        </span>
      </header>

      {/* Profile Dossier Hero */}
      <section className="mb-12 sm:mb-16">
        <div className="flex flex-col md:flex-row items-start gap-6 sm:gap-8">
          <Avatar
            name={user.displayName || user.username}
            src={user.avatarUrl}
            size="xl"
            className="ring-1 ring-rule/10"
          />

          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-1 mb-3">
              <span className="font-mono text-xs uppercase tracking-mono text-cobalt font-semibold">
                @{user.username}
              </span>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-ink leading-tight">
                {user.displayName || user.username}
              </h1>
            </div>

            {user.bio && (
              <p className="font-body text-base sm:text-lg text-ink/85 max-w-2xl leading-relaxed whitespace-pre-line mb-4">
                {user.bio}
              </p>
            )}

            {/* Verified External Links (HTTPS only, rel="noopener noreferrer nofollow ugc") */}
            {safeLinks.length > 0 && (
              <nav aria-label="External social links" className="flex flex-wrap items-center gap-2 pt-2">
                {safeLinks.map((link) => (
                  <a
                    key={link}
                    href={link}
                    {...EXTERNAL_LINK_PROPS}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs uppercase tracking-mono text-ink/80 hover:text-cobalt border border-rule-soft hover:border-rule rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <span>{getDomainDisplay(link)}</span>
                    <span className="text-[10px] text-ink/50" aria-hidden="true">&nearr;</span>
                  </a>
                ))}
              </nav>
            )}
          </div>
        </div>
      </section>

      {/* Section 01: Evidence Index */}
      <section className="flex-1 mb-16">
        <div className="flex justify-between items-end mb-4">
          <SectionNumber number={1} label="PUBLISHED EVIDENCE INDEX" />
          <span className="font-mono text-xs uppercase tracking-mono text-ink/50">
            {proofs.length} {proofs.length === 1 ? "RECORD" : "RECORDS"}
          </span>
        </div>

        {proofs.length === 0 ? (
          <EmptyState
            indicator="00 / EMPTY"
            title="No Proofs Published"
            description="This profile owner has not published any public proof records yet."
          />
        ) : (
          <IndexList>
            {proofs.map((proof, idx) => (
              <IndexItem
                key={proof.id}
                index={idx + 1}
                title={proof.title}
                proofType={proof.proofType}
                issuerName={proof.issuerDisplayName}
                issuedDate={formatMetaDate(proof.issuedAt)}
                status={proof.effectiveStatus}
                href={`/@${user.username}/${proof.slug}`}
              />
            ))}
          </IndexList>
        )}
      </section>

      {/* Editorial Page Footer */}
      <footer className="border-t border-rule pt-6 mt-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 font-mono text-xs uppercase tracking-mono text-ink/60">
        <div>
          <span>PROOF PERMANENT ARCHIVE</span> &bull; <span>@{user.username}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-ink/40">WCAG 2.2 AA VERIFIED</span>
          <Link
            href="/"
            className="text-ink hover:text-cobalt transition-colors focus-visible:outline-2 focus-visible:outline-focus"
          >
            CREATE YOUR INDEX &rarr;
          </Link>
        </div>
      </footer>
    </main>
  );
}
