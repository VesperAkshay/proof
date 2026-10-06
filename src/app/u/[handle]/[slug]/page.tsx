import React from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProof } from "@/services/proof";
import { sanitizeHttpsUrl, EXTERNAL_LINK_PROPS } from "@/lib/urls";
import {
  Avatar,
  DocumentFrame,
  MetaRow,
  Rule,
  SectionNumber,
  StatusBadge,
} from "@/components/ui";
import { recordAnalyticsEvent } from "@/services/analytics";

interface ProofPageProps {
  params: Promise<{
    handle: string;
    slug: string;
  }>;
  searchParams?: Promise<{
    ref?: string;
  }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://proof.so";

export async function generateMetadata({
  params,
}: ProofPageProps): Promise<Metadata> {
  const { handle, slug } = await params;
  const result = await getPublicProof(handle, slug);

  if (!result || result.isRedirect) {
    return {
      title: "Proof Not Found — Proof",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { proof, user } = result;
  const canonicalUrl = `${BASE_URL}/@${user.username}/${proof.slug}`;
  const title = `${proof.title} — ${user.displayName || user.username} on Proof`;
  const description =
    proof.description ||
    `${proof.title} credential and evidence artifact published by @${user.username} on Proof.`;

  const isUnlisted = proof.visibility === "unlisted";

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
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: !isUnlisted,
      follow: !isUnlisted,
    },
  };
}

function formatMetaDate(date: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
}

export default async function ProofPage({ params, searchParams }: ProofPageProps) {
  const { handle, slug } = await params;
  const result = await getPublicProof(handle, slug);

  if (!result) {
    notFound();
    return null;
  }

  if (result.isRedirect) {
    permanentRedirect(result.redirectTo);
    return null;
  }

  const { proof, user, primaryAsset } = result;

  // Track QR scan event if ?ref=qr is present
  if (searchParams) {
    const sp = await searchParams;
    if (sp.ref === "qr") {
      recordAnalyticsEvent({
        eventType: "qr_scan",
        profileUserId: user.id,
        proofId: proof.id,
      }).catch(() => {});
    }
  }

  const canonicalUrl = `${BASE_URL}/@${user.username}/${proof.slug}`;
  const safeCredentialUrl = sanitizeHttpsUrl(proof.credentialUrl);

  const issuedDateStr = formatMetaDate(proof.issuedAt);
  const expiryDateStr = formatMetaDate(proof.expiresAt);

  // Schema.org JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalCredential",
    name: proof.title,
    description: proof.description || undefined,
    credentialCategory: proof.proofType,
    recognizedBy: proof.issuerDisplayName
      ? {
          "@type": "Organization",
          name: proof.issuerDisplayName,
        }
      : undefined,
    validFrom: proof.issuedAt ? proof.issuedAt.toISOString() : undefined,
    validUntil: proof.expiresAt ? proof.expiresAt.toISOString() : undefined,
    identifier: proof.credentialId || undefined,
    url: canonicalUrl,
    author: {
      "@type": "Person",
      name: user.displayName || user.username,
      url: `${BASE_URL}/@${user.username}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #111111 !important;
          }
          .print-hidden {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-no-border {
            border: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-paper text-ink flex flex-col justify-between selection:bg-cobalt selection:text-paper">
        <main className="max-w-[1100px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1">
          {/* Top Bar Navigation (Hidden in print) */}
          <header className="print-hidden flex items-center justify-between pb-6 border-b border-rule">
            <Link
              href={`/@${user.username}`}
              className="inline-flex items-center gap-3 text-ink hover:text-cobalt group transition-colors focus-visible:outline-2 focus-visible:outline-cobalt focus-visible:outline-offset-2"
            >
              <Avatar
                src={user.avatarUrl}
                name={user.displayName || user.username}
                size="sm"
              />
              <div className="flex flex-col">
                <span className="font-display font-semibold text-sm leading-tight group-hover:underline">
                  {user.displayName || user.username}
                </span>
                <span className="font-mono text-xs text-ink/70">
                  @{user.username}
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <a
                href={`/@${user.username}/${proof.slug}/qr.svg`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-mono font-semibold px-2.5 py-1 border border-rule hover:bg-ink hover:text-paper transition-colors"
                title="View QR Code"
              >
                <span>QR CODE</span>
                <span aria-hidden="true">☵</span>
              </a>
              <Link
                href="/"
                className="font-mono text-xs uppercase tracking-mono font-bold text-ink hover:text-cobalt transition-colors"
              >
                PROOF.SO
              </Link>
            </div>
          </header>

          {/* Print-only Header Banner */}
          <div className="hidden print-only mb-6 pb-4 border-b-2 border-ink">
            <div className="flex justify-between items-center font-mono text-xs uppercase">
              <div className="space-y-1">
                <p className="font-bold">PROOF PERMANENT ARCHIVE</p>
                <p>{canonicalUrl}</p>
                <p className="text-[10px] text-ink/70">VERIFICATION STATUS: {proof.effectiveStatus}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/@${user.username}/${proof.slug}/qr.svg`}
                alt="Verification QR code"
                className="w-16 h-16 border border-ink"
              />
            </div>
          </div>

          <article className="mt-8 sm:mt-12 space-y-8">
            {/* Proof Type Section Number & Title */}
            <div>
              <SectionNumber
                number="PROOF"
                label={proof.proofType.replace(/_/g, " ").toUpperCase()}
                className="mb-4"
              />
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink leading-tight">
                {proof.title}
              </h1>
            </div>

            <Rule />

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              <section aria-labelledby="metadata-heading">
                <h2 id="metadata-heading" className="sr-only">
                  Credential Metadata
                </h2>
                <dl className="space-y-1">
                  <MetaRow
                    label="CREDENTIAL TYPE"
                    value={proof.proofType.replace(/_/g, " ").toUpperCase()}
                  />

                  {proof.issuerDisplayName && (
                    <MetaRow
                      label="ISSUER"
                      value={proof.issuerDisplayName}
                    />
                  )}

                  {issuedDateStr && (
                    <MetaRow
                      label="ISSUED"
                      value={issuedDateStr}
                    />
                  )}

                  <MetaRow
                    label="EXPIRES"
                    value={expiryDateStr || "DOES NOT EXPIRE"}
                  />

                  {proof.credentialId && (
                    <MetaRow
                      label="IDENTIFIER"
                      value={proof.credentialId}
                    />
                  )}

                  {safeCredentialUrl && (
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between py-2 border-b border-rule-soft gap-1 font-mono text-xs uppercase tracking-mono">
                      <dt className="text-ink/70 font-medium">ORIGINAL LINK</dt>
                      <dd className="text-ink font-semibold text-right truncate max-w-xs">
                        <a
                          href={safeCredentialUrl}
                          {...EXTERNAL_LINK_PROPS}
                          className="text-cobalt hover:underline flex items-center gap-1 justify-end"
                        >
                          <span>VERIFY EXTERNAL</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Status Section */}
              <section
                aria-labelledby="status-heading"
                className="flex flex-col justify-between p-5 border border-rule bg-paper rounded-[2px]"
              >
                <div>
                  <h2
                    id="status-heading"
                    className="font-mono text-xs uppercase tracking-mono text-ink/70 font-semibold mb-3"
                  >
                    STATUS & VERIFICATION
                  </h2>
                  <StatusBadge status={proof.effectiveStatus} showCopy={true} />
                </div>

                <div className="mt-6 pt-4 border-t border-rule-soft font-mono text-[11px] text-ink/60 uppercase tracking-mono">
                  {proof.publishedAt && (
                    <p>PUBLISHED {formatMetaDate(proof.publishedAt)}</p>
                  )}
                </div>
              </section>
            </div>

            {/* Document Viewer Frame */}
            {primaryAsset && (
              <section aria-labelledby="evidence-heading" className="pt-4">
                <h2 id="evidence-heading" className="sr-only">
                  Evidence Document Viewer
                </h2>
                <DocumentFrame
                  title={proof.title}
                  mimeType={primaryAsset.mimeType}
                  previewUrl={primaryAsset.previewUrl}
                  downloadUrl={primaryAsset.downloadUrl}
                  filename={primaryAsset.originalFilename}
                  sizeBytes={primaryAsset.sizeBytes}
                />
              </section>
            )}

            {/* About / Description Section */}
            {proof.description && (
              <section aria-labelledby="about-heading" className="pt-4">
                <SectionNumber number="02" label="ABOUT" className="mb-3" />
                <div className="prose prose-neutral max-w-none">
                  <p className="font-body text-base sm:text-lg text-ink leading-relaxed whitespace-pre-line">
                    {proof.description}
                  </p>
                </div>
              </section>
            )}
          </article>
        </main>

        {/* Editorial Footer / Colophon */}
        <footer className="max-w-[1100px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-rule font-mono text-xs uppercase tracking-mono flex flex-col sm:flex-row items-center justify-between gap-4 text-ink/70">
          <div>
            <span>SHARED VIA </span>
            <Link href="/" className="font-bold text-ink hover:text-cobalt">
              PROOF.SO
            </Link>
          </div>
          <div className="flex items-center gap-3 text-center sm:text-right">
            <a
              href={`/@${user.username}/${proof.slug}/qr.svg`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-cobalt"
            >
              QR (SVG)
            </a>
            <span>/</span>
            <a
              href={`/@${user.username}/${proof.slug}/qr.png`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-cobalt"
            >
              QR (PNG)
            </a>
            <span>•</span>
            <span>PERMANENT EVIDENCE LAYER</span>
          </div>
        </footer>
      </div>
    </>
  );
}
