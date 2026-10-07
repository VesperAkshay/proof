"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { ProofResponseDTO } from "@/services/proof";
import type { UpdateProofInput } from "@/lib/validations/proof";
import { PROOF_TYPES } from "@/lib/validations/proof";
import {
  Avatar,
  Button,
  EmptyState,
  Input,
  SectionNumber,
} from "@/components/ui";
import { ProofReorderList, ProofEditor } from "@/components/editor";
import type { DashboardAnalyticsResult } from "@/services/analytics";
import { UserButton } from "@clerk/nextjs";

interface DashboardUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export interface DashboardClientProps {
  user: DashboardUser;
  initialProofs: ProofResponseDTO[];
}

export function DashboardClient({ user, initialProofs }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"editor" | "analytics">("editor");
  const [proofs, setProofs] = useState<ProofResponseDTO[]>(initialProofs);
  const [selectedProofId, setSelectedProofId] = useState<string | null>(
    initialProofs[0]?.id || null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createType, setCreateType] = useState<string>("certificate");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingSubmitting, setIsCreatingSubmitting] = useState(false);

  // Analytics State
  const [analyticsData, setAnalyticsData] =
    useState<DashboardAnalyticsResult | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState<number>(30);

  useEffect(() => {
    if (activeTab === "analytics") {
      setIsAnalyticsLoading(true);
      fetch(`/api/me/analytics?days=${analyticsDays}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.analytics) {
            setAnalyticsData(json.analytics);
          }
        })
        .catch((err) => console.error("Failed to load analytics:", err))
        .finally(() => setIsAnalyticsLoading(false));
    }
  }, [activeTab, analyticsDays]);

  const selectedProof = proofs.find((p) => p.id === selectedProofId) || null;

  // Handlers for updating order
  const handleReorderSubmit = async (proofIds: string[]) => {
    const res = await fetch("/api/profile/proofs/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proofIds }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || "Failed to update proof order");
    }

    // Reorder local proofs array
    const idMap = new Map(proofs.map((p) => [p.id, p]));
    const reordered: ProofResponseDTO[] = [];
    proofIds.forEach((id, idx) => {
      const item = idMap.get(id);
      if (item) {
        reordered.push({ ...item, sortOrder: idx });
      }
    });
    setProofs(reordered);
  };

  // Handler for saving proof updates
  const handleSaveProof = async (id: string, updates: UpdateProofInput) => {
    const res = await fetch(`/api/proofs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || "Failed to update proof");
    }

    const json = await res.json();
    const updatedProof: ProofResponseDTO = json.proof || json.data?.proof;

    setProofs((prev) =>
      prev.map((p) => (p.id === id ? updatedProof : p))
    );
    return updatedProof;
  };

  // Lifecycle transition handlers
  const handleLifecycleTransition = async (
    id: string,
    endpoint: "publish" | "unpublish" | "archive" | "restore"
  ) => {
    const res = await fetch(`/api/proofs/${id}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.error?.message || `Failed to transition proof to ${endpoint}`
      );
    }

    const json = await res.json();
    const updatedProof: ProofResponseDTO = json.proof || json.data?.proof;

    setProofs((prev) =>
      prev.map((p) => (p.id === id ? updatedProof : p))
    );
    return updatedProof;
  };

  // Create new proof handler
  const handleCreateProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;

    setIsCreatingSubmitting(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          proofType: createType,
          visibility: "private",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Failed to create proof");
      }

      const json = await res.json();
      const newProof: ProofResponseDTO = json.proof || json.data?.proof;

      setProofs((prev) => [newProof, ...prev]);
      setSelectedProofId(newProof.id);
      setIsCreating(false);
      setCreateTitle("");
      setCreateType("certificate");
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create proof"
      );
    } finally {
      setIsCreatingSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-between selection:bg-cobalt selection:text-paper">
      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1">
        {/* Editorial Desk Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-rule gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              src={user.avatarUrl}
              name={user.displayName || user.username}
              size="md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg leading-tight">
                  {user.displayName || user.username}
                </span>
                <span className="font-mono text-xs text-ink/70">
                  @{user.username}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs uppercase tracking-mono text-cobalt font-semibold">
                  PUBLISHING DESK
                </span>
                <span className="text-ink/30 text-xs">&bull;</span>
                <Link
                  href="/?manifest=1"
                  className="font-mono text-[11px] uppercase tracking-mono text-ink/60 hover:text-ink underline"
                >
                  System Manifest
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Main Section Switcher */}
            <div className="inline-flex border border-rule rounded-[2px] overflow-hidden bg-paper">
              <button
                type="button"
                onClick={() => setActiveTab("editor")}
                aria-pressed={activeTab === "editor"}
                className={clsx(
                  "px-3.5 py-1.5 font-mono text-xs uppercase tracking-mono transition-colors",
                  activeTab === "editor"
                    ? "bg-ink text-paper"
                    : "text-ink hover:bg-warm-gray/40"
                )}
              >
                PUBLISHING
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                aria-pressed={activeTab === "analytics"}
                className={clsx(
                  "px-3.5 py-1.5 font-mono text-xs uppercase tracking-mono transition-colors border-l border-rule",
                  activeTab === "analytics"
                    ? "bg-ink text-paper"
                    : "text-ink hover:bg-warm-gray/40"
                )}
              >
                ANALYTICS
              </button>
            </div>

            <Link
              href={`/@${user.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-mono font-semibold px-3 py-2 border border-rule hover:bg-warm-gray/30 transition-colors rounded-[2px]"
            >
              <span>VIEW PUBLIC PROFILE</span>
              <span aria-hidden="true">↗</span>
            </Link>

            {activeTab === "editor" && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsCreating(!isCreating)}
              >
                {isCreating ? "CANCEL" : "NEW PROOF +"}
              </Button>
            )}

            <div className="pl-2 border-l border-rule flex items-center">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        {/* View 1: Publishing Desk Editor */}
        {activeTab === "editor" && (
          <>
            {/* Quick New Proof Creation Panel */}
            {isCreating && (
              <form
                onSubmit={handleCreateProof}
                className="my-6 p-6 border-2 border-cobalt bg-paper rounded-[2px] space-y-4"
              >
                <div className="flex items-center justify-between border-b border-rule pb-2">
                  <SectionNumber number="NEW" label="CREATE PROOF RECORD" />
                  <span className="font-mono text-xs uppercase tracking-mono text-ink/70">
                    START AS DRAFT
                  </span>
                </div>

                {createError && (
                  <p
                    role="alert"
                    className="font-mono text-xs text-vermilion uppercase tracking-mono"
                  >
                    {createError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <Input
                      id="create-title"
                      label="PROOF TITLE *"
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      placeholder="e.g. Master of Computer Science"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="create-type"
                      className="font-mono text-xs uppercase tracking-wider text-ink font-medium select-none"
                    >
                      TYPE *
                    </label>
                    <select
                      id="create-type"
                      value={createType}
                      onChange={(e) => setCreateType(e.target.value)}
                      className="w-full bg-paper text-ink font-body text-sm px-3 py-2.5 rounded-sm min-h-[44px] border border-rule focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      {PROOF_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ").toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsCreating(false)}
                  >
                    DISCARD
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    type="submit"
                    disabled={isCreatingSubmitting || !createTitle.trim()}
                  >
                    {isCreatingSubmitting ? "CREATING..." : "CREATE DRAFT"}
                  </Button>
                </div>
              </form>
            )}

            {/* Main Publishing Work Area */}
            {proofs.length === 0 && !isCreating ? (
              <div className="mt-12">
                <EmptyState
                  indicator="00 / MANIFEST"
                  title="No proofs published yet"
                  description="Your evidence layer is currently empty. Create your first proof or certificate to organize and share your achievements."
                  action={
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setIsCreating(true)}
                    >
                      Create Your First Proof
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Organizer & Order List (4 cols) */}
                <section
                  aria-labelledby="organizer-heading"
                  className="lg:col-span-4 space-y-4"
                >
                  <h2 id="organizer-heading" className="sr-only">
                    Proof Organizer
                  </h2>
                  <ProofReorderList
                    initialProofs={proofs}
                    selectedProofId={selectedProofId}
                    onSelectProof={(p) => setSelectedProofId(p.id)}
                    onReorderSubmit={handleReorderSubmit}
                  />
                </section>

                {/* Right Column: Editor & Live Preview (8 cols) */}
                <section
                  aria-labelledby="editor-heading"
                  className="lg:col-span-8"
                >
                  <h2 id="editor-heading" className="sr-only">
                    Proof Details and Live Preview
                  </h2>
                  {selectedProof ? (
                    <ProofEditor
                      key={selectedProof.id}
                      proof={selectedProof}
                      username={user.username}
                      displayName={user.displayName}
                      avatarUrl={user.avatarUrl}
                      onSave={handleSaveProof}
                      onPublish={(id) =>
                        handleLifecycleTransition(id, "publish")
                      }
                      onUnpublish={(id) =>
                        handleLifecycleTransition(id, "unpublish")
                      }
                      onArchive={(id) =>
                        handleLifecycleTransition(id, "archive")
                      }
                      onRestore={(id) =>
                        handleLifecycleTransition(id, "restore")
                      }
                    />
                  ) : (
                    <div className="p-8 border border-dashed border-rule text-center font-mono text-sm uppercase text-ink/70">
                      Select a proof from the organizer to edit.
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}

        {/* View 2: Analytics & Aggregate Metrics */}
        {activeTab === "analytics" && (
          <section className="mt-8 space-y-8" aria-labelledby="analytics-heading">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-rule gap-4">
              <div>
                <SectionNumber number="03" label="ANALYTICS (AGGREGATED)" />
                <h1
                  id="analytics-heading"
                  className="font-display text-2xl font-bold uppercase tracking-tight text-ink mt-1"
                >
                  Evidence & Profile Performance
                </h1>
              </div>

              {/* Window Switcher */}
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-mono">
                <span>WINDOW:</span>
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setAnalyticsDays(days)}
                    className={clsx(
                      "px-2.5 py-1 border rounded-[2px] transition-colors",
                      analyticsDays === days
                        ? "border-ink bg-ink text-paper font-bold"
                        : "border-rule-soft hover:border-rule text-ink/70"
                    )}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy Posture Notice */}
            <div className="p-3.5 border border-rule-soft bg-warm-gray/20 rounded-[2px] font-mono text-[11px] uppercase tracking-mono text-ink/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                PRIVACY POSTURE: COARSE GEO &bull; 24H ROTATING SALTED VISITOR HASH &bull; ZERO RAW IP RETENTION
              </span>
              <span className="font-bold text-forest">DAILY AGGREGATES ONLY</span>
            </div>

            {isAnalyticsLoading ? (
              <div className="p-12 text-center font-mono text-xs uppercase tracking-mono text-ink/60">
                LOADING AGGREGATE METRICS...
              </div>
            ) : analyticsData ? (
              <div className="space-y-8">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-5 border border-rule bg-paper rounded-[2px]">
                    <span className="font-mono text-xs uppercase tracking-mono text-ink/60 block mb-1">
                      TOTAL VIEWS
                    </span>
                    <span className="font-display text-3xl font-bold text-ink">
                      {analyticsData.summary.totalViews}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-ink/50 block mt-1">
                      {analyticsData.summary.profileViews} profile / {analyticsData.summary.proofViews} proofs
                    </span>
                  </div>

                  <div className="p-5 border border-rule bg-paper rounded-[2px]">
                    <span className="font-mono text-xs uppercase tracking-mono text-ink/60 block mb-1">
                      UNIQUE VISITORS
                    </span>
                    <span className="font-display text-3xl font-bold text-cobalt">
                      {analyticsData.summary.uniqueVisitors}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-ink/50 block mt-1">
                      DAILY SALTED VISITOR COUNT
                    </span>
                  </div>

                  <div className="p-5 border border-rule bg-paper rounded-[2px]">
                    <span className="font-mono text-xs uppercase tracking-mono text-ink/60 block mb-1">
                      DOWNLOADS
                    </span>
                    <span className="font-display text-3xl font-bold text-ink">
                      {analyticsData.summary.downloads}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-ink/50 block mt-1">
                      ORIGINAL EVIDENCE FILES
                    </span>
                  </div>

                  <div className="p-5 border border-rule bg-paper rounded-[2px]">
                    <span className="font-mono text-xs uppercase tracking-mono text-ink/60 block mb-1">
                      QR CODE SCANS
                    </span>
                    <span className="font-display text-3xl font-bold text-forest">
                      {analyticsData.summary.qrScans}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-ink/50 block mt-1">
                      VERIFICATION CODES
                    </span>
                  </div>
                </div>

                {/* Proof Performance Breakdown */}
                <div className="border border-rule bg-paper rounded-[2px] p-6 space-y-4">
                  <h2 className="font-mono text-xs uppercase tracking-mono font-bold text-ink pb-2 border-b border-rule">
                    PROOF EVIDENCE ENGAGEMENT
                  </h2>

                  {analyticsData.proofBreakdown.length === 0 ? (
                    <p className="font-mono text-xs text-ink/60 uppercase">
                      No proof interaction recorded in this time window.
                    </p>
                  ) : (
                    <ul className="divide-y divide-rule-soft font-mono text-xs uppercase tracking-mono">
                      {analyticsData.proofBreakdown.map((item) => (
                        <li
                          key={item.proofId}
                          className="py-3 flex items-center justify-between"
                        >
                          <span className="font-display font-semibold text-sm truncate max-w-md">
                            {item.title}
                          </span>
                          <div className="flex items-center gap-6 text-ink/80">
                            <span>{item.views} VIEWS</span>
                            <span>{item.downloads} DOWNLOADS</span>
                            <span>{item.qrScans} QR SCANS</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center font-mono text-xs uppercase tracking-mono text-ink/60">
                NO AGGREGATE DATA AVAILABLE
              </div>
            )}
          </section>
        )}
      </main>

      {/* Desk Colophon */}
      <footer className="mt-16 border-t border-rule py-6 font-mono text-xs uppercase tracking-mono text-ink/60">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <span>PROOF.SO &bull; EDITORIAL PUBLISHING UTILITY</span>
          <span>AUTONOMOUS EVIDENCE LAYER</span>
        </div>
      </footer>
    </div>
  );
}
