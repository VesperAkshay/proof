"use client";

import React from "react";
import { clsx } from "clsx";
import type { ProofResponseDTO } from "@/services/proof";
import {
  Avatar,
  DocumentFrame,
  MetaRow,
  Rule,
  SectionNumber,
  StatusBadge,
} from "@/components/ui";

export type AccentColor = "cobalt" | "vermilion" | "marigold" | "forest";

export interface ProofLivePreviewProps {
  proof: Partial<ProofResponseDTO>;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  accent?: AccentColor;
  previewAsset?: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    previewUrl?: string | null;
    downloadUrl?: string | null;
  } | null;
  className?: string;
}

function formatMetaDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
}

export function ProofLivePreview({
  proof,
  username,
  displayName,
  avatarUrl,
  accent = "cobalt",
  previewAsset,
  className,
}: ProofLivePreviewProps) {
  const title = proof.title || "Untitled Proof";
  const proofType = (proof.proofType || "certificate").replace(/_/g, " ").toUpperCase();
  const issuer = proof.issuerDisplayName || proof.issuerNameText;
  const issuedDateStr = formatMetaDate(proof.issuedAt);
  const expiryDateStr = formatMetaDate(proof.expiresAt);
  const canonicalUrl = `https://proof.so/@${username}/${proof.slug || "slug"}`;

  const accentBorderClass = {
    cobalt: "border-cobalt",
    vermilion: "border-vermilion",
    marigold: "border-marigold",
    forest: "border-forest",
  }[accent];

  const accentTextClass = {
    cobalt: "text-cobalt",
    vermilion: "text-vermilion",
    marigold: "text-marigold",
    forest: "text-forest",
  }[accent];

  return (
    <div
      className={clsx(
        "bg-paper text-ink p-6 sm:p-8 border-2 shadow-[4px_4px_0_var(--color-ink)] rounded-[2px] overflow-hidden",
        accentBorderClass,
        className
      )}
    >
      {/* Live Preview Label Banner */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-rule font-mono text-[11px] uppercase tracking-mono text-ink/70">
        <div className="flex items-center gap-2">
          <span className={clsx("w-2 h-2 rounded-full inline-block", {
            "bg-cobalt": accent === "cobalt",
            "bg-vermilion": accent === "vermilion",
            "bg-marigold": accent === "marigold",
            "bg-forest": accent === "forest",
          })} />
          <span>LIVE PUBLIC PREVIEW</span>
        </div>
        <span className="truncate">{canonicalUrl}</span>
      </div>

      {/* Header Profile Identity */}
      <header className="flex items-center justify-between pb-6 border-b border-rule">
        <div className="inline-flex items-center gap-3">
          <Avatar src={avatarUrl} name={displayName || username} size="sm" />
          <div className="flex flex-col">
            <span className="font-display font-semibold text-sm leading-tight">
              {displayName || username}
            </span>
            <span className="font-mono text-xs text-ink/70">@{username}</span>
          </div>
        </div>

        <span className="font-mono text-xs uppercase tracking-mono font-bold text-ink">
          PROOF.SO
        </span>
      </header>

      <article className="mt-8 space-y-8">
        {/* Title & Section Label */}
        <div>
          <SectionNumber
            number="PROOF"
            label={proofType}
            className={clsx("mb-4", accentTextClass)}
          />
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink leading-tight">
            {title}
          </h1>
        </div>

        <Rule />

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section aria-labelledby="preview-metadata-heading">
            <h2 id="preview-metadata-heading" className="sr-only">
              Credential Metadata
            </h2>
            <dl className="space-y-1">
              <MetaRow label="CREDENTIAL TYPE" value={proofType} />

              {issuer && <MetaRow label="ISSUER" value={issuer} />}

              {issuedDateStr && <MetaRow label="ISSUED" value={issuedDateStr} />}

              <MetaRow
                label="EXPIRES"
                value={expiryDateStr || "DOES NOT EXPIRE"}
              />

              {proof.credentialId && (
                <MetaRow label="IDENTIFIER" value={proof.credentialId} />
              )}

              {proof.credentialUrl && (
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between py-2 border-b border-rule-soft gap-1 font-mono text-xs uppercase tracking-mono">
                  <dt className="text-ink/70 font-medium">ORIGINAL LINK</dt>
                  <dd className="text-ink font-semibold text-right truncate max-w-xs">
                    <span className="text-cobalt flex items-center gap-1 justify-end">
                      <span>VERIFY EXTERNAL</span>
                      <span aria-hidden="true">↗</span>
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Status Badge Box */}
          <section
            aria-labelledby="preview-status-heading"
            className="flex flex-col justify-between p-5 border border-rule bg-paper rounded-[2px]"
          >
            <div>
              <h2
                id="preview-status-heading"
                className="font-mono text-xs uppercase tracking-mono text-ink/70 font-semibold mb-3"
              >
                STATUS & VERIFICATION
              </h2>
              <StatusBadge
                status={proof.effectiveStatus || "SELF_REPORTED"}
                showCopy={true}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-rule-soft font-mono text-[11px] text-ink/60 uppercase tracking-mono">
              <p>VISIBILITY: {proof.visibility || "private"}</p>
            </div>
          </section>
        </div>

        {/* Document Viewer Frame */}
        {previewAsset && (
          <section aria-labelledby="preview-evidence-heading" className="pt-2">
            <h2 id="preview-evidence-heading" className="sr-only">
              Evidence Document Viewer
            </h2>
            <DocumentFrame
              title={title}
              mimeType={previewAsset.mimeType}
              previewUrl={previewAsset.previewUrl}
              downloadUrl={previewAsset.downloadUrl}
              filename={previewAsset.filename}
              sizeBytes={previewAsset.sizeBytes}
            />
          </section>
        )}

        {/* About / Description */}
        {proof.description && (
          <section aria-labelledby="preview-about-heading" className="pt-2">
            <SectionNumber number="02" label="ABOUT" className="mb-3" />
            <p className="font-body text-base text-ink leading-relaxed whitespace-pre-line">
              {proof.description}
            </p>
          </section>
        )}
      </article>

      {/* Editorial Footer Colophon */}
      <footer className="mt-12 pt-6 border-t border-rule font-mono text-xs uppercase tracking-mono flex items-center justify-between text-ink/70">
        <span>SHARED VIA PROOF.SO</span>
        <span>PERMANENT EVIDENCE LAYER</span>
      </footer>
    </div>
  );
}
