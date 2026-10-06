import React from "react";
import { clsx } from "clsx";

export interface DocumentFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  mimeType?: string | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  filename?: string | null;
  sizeBytes?: number | null;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFormatLabel(mimeType?: string | null): string {
  if (!mimeType) return "DOCUMENT";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/jpeg") return "JPEG";
  if (mimeType === "image/webp") return "WEBP";
  return mimeType.split("/")[1]?.toUpperCase() || "DOCUMENT";
}

export function DocumentFrame({
  title,
  mimeType,
  previewUrl,
  downloadUrl,
  filename,
  sizeBytes,
  className,
  ...props
}: DocumentFrameProps) {
  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const formatLabel = getFormatLabel(mimeType);
  const sizeLabel = formatBytes(sizeBytes);

  return (
    <div
      className={clsx(
        "flex flex-col border border-rule bg-paper overflow-hidden rounded-[2px]",
        className
      )}
      {...props}
    >
      {/* Editorial Frame Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-paper border-b border-rule font-mono text-xs tracking-mono uppercase select-none">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-cobalt inline-block shrink-0" aria-hidden="true" />
          <span className="font-semibold text-ink truncate">
            {filename || "ORIGINAL EVIDENCE"}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-ink/70">
          <span>{formatLabel}</span>
          {sizeLabel && <span>{sizeLabel}</span>}
        </div>
      </div>

      {/* Frame Content Viewer */}
      <div className="relative min-h-[320px] max-h-[720px] flex items-center justify-center bg-paper p-4 overflow-hidden">
        {isImage && previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt={title}
            className="max-h-[640px] w-auto max-w-full object-contain border border-rule-soft shadow-[4px_4px_0_var(--color-ink)]"
            loading="lazy"
          />
        ) : isPdf ? (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md w-full border border-dashed border-rule-soft bg-paper">
            <div className="w-12 h-14 border-2 border-rule flex flex-col justify-between p-1.5 mb-4 shadow-[2px_2px_0_var(--color-ink)]">
              <span className="font-mono text-[9px] font-bold text-ink self-end">PDF</span>
              <div className="w-full h-0.5 bg-ink" />
              <div className="w-3/4 h-0.5 bg-ink" />
              <div className="w-full h-0.5 bg-ink" />
            </div>
            <p className="font-display font-bold text-base text-ink mb-1">
              Document Artifact
            </p>
            <p className="font-body text-xs text-ink/70 mb-4">
              Original verification document attached by profile owner.
            </p>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center justify-center h-11 px-5 border border-rule bg-cobalt text-paper font-mono text-xs uppercase tracking-mono font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-cobalt focus-visible:outline-offset-2 active:translate-y-0 shadow-[2px_2px_0_var(--color-ink)]"
              >
                Download PDF ({sizeLabel || "Original"})
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <span className="font-mono text-xs uppercase tracking-mono text-ink/60 mb-2">
              ARTIFACT ATTACHED
            </span>
            <p className="font-body text-sm text-ink/80 max-w-sm mb-4">
              {filename || title}
            </p>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center justify-center h-11 px-5 border border-rule bg-paper text-ink font-mono text-xs uppercase tracking-mono font-semibold hover:bg-warm-gray transition-colors focus-visible:outline-2 focus-visible:outline-cobalt focus-visible:outline-offset-2"
              >
                Download Document
              </a>
            )}
          </div>
        )}
      </div>

      {/* Frame Footer with Download Action */}
      {downloadUrl && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-paper border-t border-rule font-mono text-xs">
          <span className="text-ink/60 uppercase tracking-mono text-[11px] truncate">
            EVIDENCE ARTIFACT
          </span>
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center gap-1.5 text-cobalt hover:underline font-semibold uppercase tracking-mono py-1 px-2 focus-visible:outline-2 focus-visible:outline-cobalt"
          >
            <span>DOWNLOAD</span>
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      )}
    </div>
  );
}
