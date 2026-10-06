"use client";

import React, { useState, useEffect, useId } from "react";
import { clsx } from "clsx";
import { validateHandle } from "@/lib/handle";

export interface HandleInputProps {
  value: string;
  onChange: (value: string) => void;
  onAvailabilityChange?: (isAvailable: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export type AvailabilityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; message: string }
  | { status: "unavailable"; reason: string; suggestions: string[] }
  | { status: "invalid"; message: string };

export function HandleInput({
  value,
  onChange,
  onAvailabilityChange,
  disabled = false,
  className,
}: HandleInputProps) {
  const inputId = useId();
  const liveRegionId = useId();
  const [state, setState] = useState<AvailabilityState>({ status: "idle" });

  useEffect(() => {
    const trimmed = value.trim().replace(/^@/, "");

    if (!trimmed) {
      setState({ status: "idle" });
      onAvailabilityChange?.(false);
      return;
    }

    const validation = validateHandle(trimmed);
    if (!validation.isValid) {
      setState({ status: "invalid", message: validation.message || "Invalid format." });
      onAvailabilityChange?.(false);
      return;
    }

    setState({ status: "checking" });

    // 300 ms debounce per M2.5 specification
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/usernames/availability?username=${encodeURIComponent(validation.normalized)}`
        );
        const data = await res.json();

        if (data.available) {
          setState({
            status: "available",
            message: `@${validation.normalized} is available.`,
          });
          onAvailabilityChange?.(true);
        } else {
          setState({
            status: "unavailable",
            reason:
              data.reason === "RESERVED"
                ? `@${validation.normalized} is reserved by the system.`
                : `@${validation.normalized} is already taken.`,
            suggestions: data.suggestions || [],
          });
          onAvailabilityChange?.(false);
        }
      } catch {
        setState({
          status: "unavailable",
          reason: "Unable to verify availability right now.",
          suggestions: [],
        });
        onAvailabilityChange?.(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, onAvailabilityChange]);

  return (
    <div className={clsx("flex flex-col gap-2 w-full", className)}>
      <label
        htmlFor={inputId}
        className="font-mono text-xs uppercase tracking-wider text-ink font-semibold select-none flex items-center justify-between"
      >
        <span>Claim Handle</span>
        <span className="text-ink/60 font-normal">3–30 chars &bull; a-z 0-9 _ -</span>
      </label>

      <div className="relative flex items-center">
        <span
          className="absolute left-3 font-mono text-base text-ink/50 select-none pointer-events-none"
          aria-hidden="true"
        >
          @
        </span>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="yourname"
          aria-describedby={liveRegionId}
          aria-invalid={state.status === "invalid" || state.status === "unavailable"}
          className={clsx(
            "w-full bg-paper text-ink font-mono text-sm pl-8 pr-4 py-2.5 rounded-sm min-h-[44px] border transition-colors",
            "border-rule focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2",
            state.status === "available" && "border-forest focus-visible:outline-forest",
            (state.status === "unavailable" || state.status === "invalid") &&
              "border-danger focus-visible:outline-danger",
            disabled && "opacity-50 cursor-not-allowed bg-warm-gray/30"
          )}
        />
      </div>

      {/* A11y Live Region */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        className="min-h-[20px] font-mono text-xs"
      >
        {state.status === "checking" && (
          <span className="text-cobalt flex items-center gap-1.5 animate-pulse">
            <span>&bull;</span> Checking availability...
          </span>
        )}

        {state.status === "available" && (
          <span className="text-forest flex items-center gap-1.5 font-medium">
            <span>✓</span> {state.message}
          </span>
        )}

        {state.status === "invalid" && (
          <span className="text-danger flex items-center gap-1.5">
            <span>✕</span> {state.message}
          </span>
        )}

        {state.status === "unavailable" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-danger flex items-center gap-1.5">
              <span>✕</span> {state.reason}
            </span>
            {state.suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono mt-1">
                <span className="text-ink/60">Suggestions:</span>
                {state.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onChange(suggestion)}
                    className="px-2 py-0.5 border border-rule-soft bg-paper hover:bg-warm-gray/30 rounded-sm text-cobalt hover:border-cobalt transition-colors"
                  >
                    @{suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
