"use client";

import React, { useState, useRef } from "react";
import { clsx } from "clsx";
import type { ProofResponseDTO } from "@/services/proof";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface ProofReorderListProps {
  initialProofs: ProofResponseDTO[];
  selectedProofId?: string | null;
  onSelectProof: (proof: ProofResponseDTO) => void;
  onReorderSubmit?: (proofIds: string[]) => Promise<void>;
  className?: string;
}

export function ProofReorderList({
  initialProofs,
  selectedProofId,
  onSelectProof,
  onReorderSubmit,
  className,
}: ProofReorderListProps) {
  const [proofs, setProofs] = useState<ProofResponseDTO[]>(initialProofs);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Keep a snapshot ref for rolling back on API failure
  const previousSnapshotRef = useRef<ProofResponseDTO[]>(initialProofs);

  const performReorder = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= proofs.length) return;

    // Save previous snapshot for rollback
    const previousSnapshot = [...proofs];
    previousSnapshotRef.current = previousSnapshot;

    // Optimistically reorder array
    const updated = [...proofs];
    const [movedItem] = updated.splice(fromIndex, 1);
    if (!movedItem) return;
    updated.splice(toIndex, 0, movedItem);

    setProofs(updated);
    setErrorMessage(null);
    setStatusMessage(`Moved "${movedItem.title}" to position ${toIndex + 1} of ${updated.length}.`);

    if (onReorderSubmit) {
      setIsSaving(true);
      try {
        const proofIds = updated.map((p) => p.id);
        await onReorderSubmit(proofIds);
      } catch {
        // Roll back immediately on failure
        setProofs(previousSnapshot);
        setErrorMessage("Failed to save new order. Order has been reverted.");
        setStatusMessage("Order change failed and was reverted.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    await performReorder(draggedIndex, targetIndex);
    setDraggedIndex(null);
  };

  const handleKeyDown = async (
    e: React.KeyboardEvent,
    index: number,
    item: ProofResponseDTO
  ) => {
    if (e.altKey && e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      await performReorder(index, index - 1);
    } else if (e.altKey && e.key === "ArrowDown" && index < proofs.length - 1) {
      e.preventDefault();
      await performReorder(index, index + 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectProof(item);
    }
  };

  return (
    <div className={clsx("flex flex-col space-y-4", className)}>
      {/* Accessible Live Region */}
      <div
        role="status"
        aria-label="Reorder status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      {/* Editorial Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3 border border-vermilion bg-paper text-vermilion font-mono text-xs uppercase tracking-mono flex items-center justify-between"
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

      {/* Header Info */}
      <div className="flex items-center justify-between pb-2 border-b border-rule font-mono text-xs uppercase tracking-mono text-ink/70">
        <span>ORGANIZER ({proofs.length} PROOFS)</span>
        {isSaving && <span className="text-cobalt">SAVING...</span>}
      </div>

      {/* Index List */}
      <ul
        role="list"
        aria-label="Ordered proofs list"
        className="divide-y divide-rule-soft border-t border-b border-rule bg-paper"
      >
        {proofs.map((proof, index) => {
          const isSelected = proof.id === selectedProofId;
          const displayIndex = String(index + 1).padStart(2, "0");

          return (
            <li
              key={proof.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onKeyDown={(e) => handleKeyDown(e, index, proof)}
              tabIndex={0}
              aria-selected={isSelected}
              className={clsx(
                "group flex items-center justify-between p-3.5 transition-colors cursor-pointer select-none",
                isSelected
                  ? "bg-warm-gray/40 border-l-4 border-l-cobalt"
                  : "hover:bg-warm-gray/20 border-l-4 border-l-transparent",
                draggedIndex === index && "opacity-50 border-dashed border-rule"
              )}
              onClick={() => onSelectProof(proof)}
            >
              {/* Left Column: Number, Title, Metadata */}
              <div className="flex items-center gap-4 min-w-0 pr-4">
                <span className="font-mono text-xs font-bold text-ink/60 shrink-0">
                  {displayIndex}
                </span>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm text-ink truncate">
                      {proof.title}
                    </span>
                    <span
                      className={clsx(
                        "font-mono text-[10px] uppercase tracking-mono px-1.5 py-0.5 rounded-sm border shrink-0",
                        proof.lifecycleState === "PUBLISHED"
                          ? "border-forest text-forest bg-forest/10"
                          : proof.lifecycleState === "ARCHIVED"
                          ? "border-ink/40 text-ink/60 bg-transparent"
                          : "border-rule text-ink/70 bg-transparent"
                      )}
                    >
                      {proof.lifecycleState}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 font-mono text-[11px] text-ink/60 uppercase tracking-mono truncate">
                    <span>{proof.proofType.replace(/_/g, " ")}</span>
                    {proof.issuerDisplayName && (
                      <>
                        <span>•</span>
                        <span className="truncate">{proof.issuerDisplayName}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{proof.visibility}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Status & Reorder Controls */}
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={proof.effectiveStatus} className="hidden sm:inline-flex" />

                {/* Keyboard Reorder Controls */}
                <div className="flex items-center border border-rule bg-paper rounded-[2px] overflow-hidden">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      performReorder(index, index - 1);
                    }}
                    aria-label={`Move "${proof.title}" up`}
                    className="p-1.5 hover:bg-warm-gray disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-cobalt"
                  >
                    <span aria-hidden="true" className="font-mono text-xs">↑</span>
                  </button>
                  <div className="w-[1px] h-4 bg-rule" />
                  <button
                    type="button"
                    disabled={index === proofs.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      performReorder(index, index + 1);
                    }}
                    aria-label={`Move "${proof.title}" down`}
                    className="p-1.5 hover:bg-warm-gray disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-cobalt"
                  >
                    <span aria-hidden="true" className="font-mono text-xs">↓</span>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
