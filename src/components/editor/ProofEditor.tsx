"use client";

import React, { useState, useRef, useTransition } from "react";
import { clsx } from "clsx";
import type { ProofResponseDTO } from "@/services/proof";
import type { UpdateProofInput } from "@/lib/validations/proof";
import { PROOF_TYPES, VISIBILITY_OPTIONS } from "@/lib/validations/proof";
import { Button, Input, Rule, SectionNumber, StatusBadge } from "@/components/ui";
import { ProofLivePreview, type AccentColor } from "./ProofLivePreview";

export interface ProofEditorProps {
  proof: ProofResponseDTO;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  onSave?: (
    id: string,
    updates: UpdateProofInput & { accent?: AccentColor }
  ) => Promise<ProofResponseDTO | void>;
  onPublish?: (id: string) => Promise<ProofResponseDTO | void>;
  onUnpublish?: (id: string) => Promise<ProofResponseDTO | void>;
  onArchive?: (id: string) => Promise<ProofResponseDTO | void>;
  onRestore?: (id: string) => Promise<ProofResponseDTO | void>;
  previewAsset?: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    previewUrl?: string | null;
    downloadUrl?: string | null;
  } | null;
  className?: string;
}

const ACCENT_OPTIONS: { id: AccentColor; label: string; bgClass: string; borderClass: string }[] = [
  { id: "cobalt", label: "Cobalt", bgClass: "bg-cobalt", borderClass: "border-cobalt" },
  { id: "vermilion", label: "Vermilion", bgClass: "bg-vermilion", borderClass: "border-vermilion" },
  { id: "marigold", label: "Marigold", bgClass: "bg-marigold", borderClass: "border-marigold" },
  { id: "forest", label: "Forest", bgClass: "bg-forest", borderClass: "border-forest" },
];

function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0] || "";
}

export function ProofEditor({
  proof: initialProof,
  username,
  displayName,
  avatarUrl,
  onSave,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  previewAsset,
  className,
}: ProofEditorProps) {
  // Local state for editorial form
  const [currentProof, setCurrentProof] = useState<ProofResponseDTO>(initialProof);
  const [accent, setAccent] = useState<AccentColor>("cobalt");
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");

  // Form input states
  const [title, setTitle] = useState(initialProof.title);
  const [proofType, setProofType] = useState(initialProof.proofType);
  const [issuerNameText, setIssuerNameText] = useState(initialProof.issuerNameText || "");
  const [credentialId, setCredentialId] = useState(initialProof.credentialId || "");
  const [credentialUrl, setCredentialUrl] = useState(initialProof.credentialUrl || "");
  const [issuedAt, setIssuedAt] = useState(formatDateForInput(initialProof.issuedAt));
  const [expiresAt, setExpiresAt] = useState(formatDateForInput(initialProof.expiresAt));
  const [description, setDescription] = useState(initialProof.description || "");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">(
    (initialProof.visibility as "private" | "unlisted" | "public") || "private"
  );

  // Status alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Snapshot ref of last committed/successful state for rollback on API failure
  const committedSnapshotRef = useRef<{
    proof: ProofResponseDTO;
    form: {
      title: string;
      proofType: string;
      issuerNameText: string;
      credentialId: string;
      credentialUrl: string;
      issuedAt: string;
      expiresAt: string;
      description: string;
      visibility: "private" | "unlisted" | "public";
      accent: AccentColor;
    };
  }>({
    proof: initialProof,
    form: {
      title: initialProof.title,
      proofType: initialProof.proofType,
      issuerNameText: initialProof.issuerNameText || "",
      credentialId: initialProof.credentialId || "",
      credentialUrl: initialProof.credentialUrl || "",
      issuedAt: formatDateForInput(initialProof.issuedAt),
      expiresAt: formatDateForInput(initialProof.expiresAt),
      description: initialProof.description || "",
      visibility: (initialProof.visibility as "private" | "unlisted" | "public") || "private",
      accent: "cobalt",
    },
  });

  const commitCurrentState = (updatedProof?: ProofResponseDTO) => {
    committedSnapshotRef.current = {
      proof: updatedProof || { ...currentProof },
      form: {
        title,
        proofType,
        issuerNameText,
        credentialId,
        credentialUrl,
        issuedAt,
        expiresAt,
        description,
        visibility,
        accent,
      },
    };
  };

  const rollback = (errorNotice: string) => {
    const snap = committedSnapshotRef.current;
    setCurrentProof(snap.proof);
    setTitle(snap.form.title);
    setProofType(snap.form.proofType);
    setIssuerNameText(snap.form.issuerNameText);
    setCredentialId(snap.form.credentialId);
    setCredentialUrl(snap.form.credentialUrl);
    setIssuedAt(snap.form.issuedAt);
    setExpiresAt(snap.form.expiresAt);
    setDescription(snap.form.description);
    setVisibility(snap.form.visibility);
    setAccent(snap.form.accent);
    setErrorMessage(errorNotice);
    setSuccessMessage(null);
  };

  // Synchronized preview state
  const previewProofData: Partial<ProofResponseDTO> = {
    ...currentProof,
    title,
    proofType,
    issuerNameText: issuerNameText || null,
    credentialId: credentialId || null,
    credentialUrl: credentialUrl || null,
    issuedAt: issuedAt ? new Date(issuedAt) : null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    description: description || null,
    visibility,
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Build update payload
    const updates: UpdateProofInput & { accent?: AccentColor } = {
      title: title.trim(),
      proofType: proofType as (typeof PROOF_TYPES)[number],
      description: description.trim() || null,
      issuerNameText: issuerNameText.trim() || null,
      credentialId: credentialId.trim() || null,
      credentialUrl: credentialUrl.trim() || null,
      issuedAt: issuedAt ? new Date(issuedAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      visibility,
      accent,
    };

    // Optimistically update current proof state
    const optimisticProof: ProofResponseDTO = {
      ...currentProof,
      title: updates.title || currentProof.title,
      proofType: updates.proofType || currentProof.proofType,
      description: updates.description ?? currentProof.description,
      issuerNameText: updates.issuerNameText ?? currentProof.issuerNameText,
      credentialId: updates.credentialId ?? currentProof.credentialId,
      credentialUrl: updates.credentialUrl ?? currentProof.credentialUrl,
      issuedAt: updates.issuedAt ? new Date(updates.issuedAt) : null,
      expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : null,
      visibility: updates.visibility || currentProof.visibility,
    };
    setCurrentProof(optimisticProof);

    if (onSave) {
      startTransition(async () => {
        try {
          const result = await onSave(currentProof.id, updates);
          const finalProof = result || optimisticProof;
          setCurrentProof(finalProof);
          commitCurrentState(finalProof);
          setSuccessMessage("Changes saved successfully.");
        } catch {
          rollback("Failed to save changes. Reverted to previous state.");
        }
      });
    } else {
      commitCurrentState(optimisticProof);
      setSuccessMessage("Changes saved locally.");
    }
  };

  const handleLifecycleAction = (
    action: "publish" | "unpublish" | "archive" | "restore"
  ) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetLifecycleState =
      action === "publish"
        ? "PUBLISHED"
        : action === "unpublish"
        ? "DRAFT"
        : action === "archive"
        ? "ARCHIVED"
        : "DRAFT";

    // Optimistically apply state
    const optimisticProof: ProofResponseDTO = {
      ...currentProof,
      lifecycleState: targetLifecycleState,
      publishedAt: action === "publish" ? new Date() : currentProof.publishedAt,
    };
    setCurrentProof(optimisticProof);

    startTransition(async () => {
      try {
        let result: ProofResponseDTO | void = undefined;
        if (action === "publish" && onPublish) {
          result = await onPublish(currentProof.id);
        } else if (action === "unpublish" && onUnpublish) {
          result = await onUnpublish(currentProof.id);
        } else if (action === "archive" && onArchive) {
          result = await onArchive(currentProof.id);
        } else if (action === "restore" && onRestore) {
          result = await onRestore(currentProof.id);
        }

        const finalProof = result || optimisticProof;
        setCurrentProof(finalProof);
        commitCurrentState(finalProof);
        setSuccessMessage(
          `Proof successfully ${
            action === "publish"
              ? "published"
              : action === "unpublish"
              ? "unpublished"
              : action === "archive"
              ? "archived"
              : "restored"
          }.`
        );
      } catch {
        rollback(`Failed to ${action} proof. Reverted to previous state.`);
      }
    });
  };

  return (
    <div className={clsx("flex flex-col space-y-6 w-full", className)}>
      {/* Top Bar: Publishing Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-rule gap-4">
        <div className="flex items-center gap-3">
          <SectionNumber number="EDIT" label={currentProof.lifecycleState} />
          <span className="font-mono text-xs uppercase tracking-mono text-ink/60">
            SLUG: /{currentProof.slug}
          </span>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Segmented Switch */}
          <div className="inline-flex border border-rule rounded-[2px] overflow-hidden bg-paper">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              aria-pressed={viewMode === "edit"}
              className={clsx(
                "px-3 py-1.5 font-mono text-xs uppercase tracking-mono transition-colors",
                viewMode === "edit"
                  ? "bg-ink text-paper"
                  : "text-ink hover:bg-warm-gray/40"
              )}
            >
              EDITOR
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              aria-pressed={viewMode === "split"}
              className={clsx(
                "hidden lg:inline-block px-3 py-1.5 font-mono text-xs uppercase tracking-mono transition-colors border-l border-r border-rule",
                viewMode === "split"
                  ? "bg-ink text-paper"
                  : "text-ink hover:bg-warm-gray/40"
              )}
            >
              SPLIT VIEW
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              aria-pressed={viewMode === "preview"}
              className={clsx(
                "px-3 py-1.5 font-mono text-xs uppercase tracking-mono transition-colors",
                viewMode === "preview"
                  ? "bg-ink text-paper"
                  : "text-ink hover:bg-warm-gray/40"
              )}
            >
              LIVE PREVIEW
            </button>
          </div>

          {/* Lifecycle State Buttons */}
          {currentProof.lifecycleState === "DRAFT" && (
            <Button
              size="sm"
              variant="primary"
              disabled={isPending}
              onClick={() => handleLifecycleAction("publish")}
            >
              PUBLISH
            </Button>
          )}

          {currentProof.lifecycleState === "PUBLISHED" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => handleLifecycleAction("unpublish")}
            >
              UNPUBLISH
            </Button>
          )}

          {currentProof.lifecycleState === "ARCHIVED" ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => handleLifecycleAction("restore")}
            >
              RESTORE
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => handleLifecycleAction("archive")}
            >
              ARCHIVE
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={handleSave}
          >
            {isPending ? "SAVING..." : "SAVE"}
          </Button>
        </div>
      </div>

      {/* Editorial Alerts */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 border border-vermilion bg-paper text-vermilion font-mono text-xs uppercase tracking-mono flex items-center justify-between"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-ink hover:underline ml-4"
          >
            DISMISS
          </button>
        </div>
      )}

      {successMessage && (
        <div
          className="editorial-feedback p-3.5 border border-forest bg-paper text-forest font-mono text-xs uppercase tracking-mono flex items-center justify-between"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-ink hover:underline ml-4"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Main Grid: Form and Live Preview */}
      <div
        className={clsx("grid gap-8 items-start", {
          "grid-cols-1": viewMode !== "split",
          "grid-cols-1 lg:grid-cols-12": viewMode === "split",
        })}
      >
        {/* Editor Form Column */}
        {(viewMode === "edit" || viewMode === "split") && (
          <form
            onSubmit={handleSave}
            className={clsx(
              "space-y-6 bg-paper p-6 border border-rule rounded-[2px]",
              viewMode === "split" ? "lg:col-span-6" : "w-full"
            )}
          >
            {/* Section 01: Core Content */}
            <div>
              <h2 className="font-mono text-xs uppercase tracking-mono font-bold text-ink mb-4 pb-2 border-b border-rule">
                01. CREDENTIAL METADATA
              </h2>

              <div className="space-y-4">
                <Input
                  id="proof-title"
                  label="TITLE *"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AWS Certified Solutions Architect"
                  required
                />

                {/* Proof Type Selector */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label
                    htmlFor="proof-type"
                    className="font-mono text-xs uppercase tracking-wider text-ink font-medium select-none"
                  >
                    PROOF TYPE *
                  </label>
                  <select
                    id="proof-type"
                    value={proofType}
                    onChange={(e) => setProofType(e.target.value)}
                    className="w-full bg-paper text-ink font-body text-sm px-3 py-2.5 rounded-sm min-h-[44px] border border-rule focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    {PROOF_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, " ").toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  id="issuer-name"
                  label="ISSUER NAME"
                  value={issuerNameText}
                  onChange={(e) => setIssuerNameText(e.target.value)}
                  placeholder="e.g. Amazon Web Services"
                  helperText="User-entered issuer name. Only verified issuer-signed records display issuer badges."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="issued-at"
                    type="date"
                    label="ISSUED DATE"
                    value={issuedAt}
                    onChange={(e) => setIssuedAt(e.target.value)}
                  />

                  <Input
                    id="expires-at"
                    type="date"
                    label="EXPIRATION DATE"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    helperText="Leave empty if this credential does not expire."
                  />
                </div>

                <Input
                  id="credential-id"
                  label="CREDENTIAL ID / LICENSE NUMBER"
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  placeholder="e.g. AWS-PSA-982314"
                />

                <Input
                  id="credential-url"
                  type="url"
                  label="VERIFICATION URL"
                  value={credentialUrl}
                  onChange={(e) => setCredentialUrl(e.target.value)}
                  placeholder="https://..."
                  helperText="External link where evidence can be validated."
                />

                {/* Description Textarea */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label
                    htmlFor="proof-description"
                    className="font-mono text-xs uppercase tracking-wider text-ink font-medium select-none"
                  >
                    ABOUT / CONTEXT
                  </label>
                  <textarea
                    id="proof-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Brief editorial background on the evidence..."
                    className="w-full bg-paper text-ink font-body text-sm p-3 rounded-sm border border-rule focus-visible:outline-2 focus-visible:outline-focus"
                  />
                </div>
              </div>
            </div>

            <Rule />

            {/* Section 02: Publishing & Presentation */}
            <div>
              <h2 className="font-mono text-xs uppercase tracking-mono font-bold text-ink mb-4 pb-2 border-b border-rule">
                02. PUBLISHING & PRESENTATION
              </h2>

              <div className="space-y-6">
                {/* Visibility Controls */}
                <fieldset className="space-y-2">
                  <legend className="font-mono text-xs uppercase tracking-wider text-ink font-medium">
                    VISIBILITY
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {VISIBILITY_OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        className={clsx(
                          "flex flex-col items-center justify-center p-3 border rounded-sm cursor-pointer font-mono text-xs uppercase tracking-mono text-center transition-colors min-h-[44px]",
                          visibility === opt
                            ? "border-ink bg-warm-gray/40 font-bold"
                            : "border-rule-soft hover:bg-warm-gray/20 text-ink/70"
                        )}
                      >
                        <input
                          type="radio"
                          name="visibility"
                          value={opt}
                          checked={visibility === opt}
                          onChange={() => setVisibility(opt)}
                          className="sr-only"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  <p className="font-mono text-[11px] text-ink/60 uppercase tracking-mono pt-1">
                    {visibility === "private" && "Private: Visible only to you when logged in."}
                    {visibility === "unlisted" && "Unlisted: Accessible via direct link, excluded from profile index and search engines."}
                    {visibility === "public" && "Public: Indexed on your public profile and shareable permanently."}
                  </p>
                </fieldset>

                {/* Accent Selection Swatch */}
                <fieldset className="space-y-2">
                  <legend className="font-mono text-xs uppercase tracking-wider text-ink font-medium">
                    FRAME ACCENT COLOR
                  </legend>
                  <div className="grid grid-cols-4 gap-2">
                    {ACCENT_OPTIONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAccent(item.id)}
                        className={clsx(
                          "flex flex-col items-center gap-1.5 p-2.5 border rounded-sm transition-transform focus-visible:outline-2 focus-visible:outline-focus min-h-[44px]",
                          accent === item.id
                            ? "border-ink shadow-[2px_2px_0_var(--color-ink)] -translate-y-0.5"
                            : "border-rule-soft hover:border-rule text-ink/70"
                        )}
                      >
                        <span
                          className={clsx(
                            "w-5 h-5 rounded-full border border-rule",
                            item.bgClass
                          )}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-[11px] uppercase tracking-mono">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Verification Status Readout */}
                <div className="p-3.5 border border-rule-soft bg-warm-gray/10 rounded-sm">
                  <span className="font-mono text-[11px] uppercase tracking-mono text-ink/70 block mb-2">
                    CURRENT SYSTEM VERIFICATION STATE
                  </span>
                  <StatusBadge status={currentProof.effectiveStatus} showCopy={true} />
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Live Preview Column */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div
            className={clsx(
              "sticky top-6",
              viewMode === "split" ? "lg:col-span-6" : "w-full"
            )}
          >
            <ProofLivePreview
              proof={previewProofData}
              username={username}
              displayName={displayName}
              avatarUrl={avatarUrl}
              accent={accent}
              previewAsset={previewAsset}
            />
          </div>
        )}
      </div>
    </div>
  );
}
