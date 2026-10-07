"use client";

import React, { useState } from "react";
import Link from "next/link";
import { HandleInput } from "@/components/ui/HandleInput";
import { Button } from "@/components/ui/Button";

export interface HomeClaimBoxProps {
  currentUsername?: string | null;
}

export function HomeClaimBox({ currentUsername }: HomeClaimBoxProps) {
  const [handle, setHandle] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);

  const cleanHandle = handle.trim().replace(/^@/, "");

  if (currentUsername) {
    return (
      <div className="w-full max-w-xl bg-paper border border-rule-soft p-6 rounded-sm shadow-none">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-xs uppercase tracking-wider text-ink/70">
              Authenticated Session
            </span>
          </div>
          <span className="font-mono text-sm font-bold text-cobalt">
            @{currentUsername}
          </span>
        </div>

        <p className="font-body text-sm text-ink mb-4 leading-relaxed">
          Your publishing desk and canonical profile are active. Manage drafts, attach evidence, or publish records to your archival URL.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-rule-soft">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="primary" size="md" className="w-full sm:w-auto">
              Open Publishing Desk &rarr;
            </Button>
          </Link>

          <Link href={`/@${currentUsername}`} className="w-full sm:w-auto">
            <Button variant="secondary" size="md" className="w-full sm:w-auto">
              View Your Profile &rarr;
            </Button>
          </Link>

          <a href="#trust-posture" className="w-full sm:w-auto">
            <Button variant="ghost" size="md" className="w-full sm:w-auto text-ink/70">
              Trust Model
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl bg-paper border border-rule-soft p-6 rounded-sm shadow-none">
      <div className="mb-4">
        <HandleInput
          value={handle}
          onChange={setHandle}
          onAvailabilityChange={setIsAvailable}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-rule-soft">
        {cleanHandle && isAvailable ? (
          <Link href={`/dashboard?claim=${encodeURIComponent(cleanHandle)}`} className="w-full sm:w-auto">
            <Button variant="primary" size="md" className="w-full sm:w-auto">
              Claim @{cleanHandle} &rarr;
            </Button>
          </Link>
        ) : (
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="primary" size="md" className="w-full sm:w-auto">
              Open Publishing Desk &rarr;
            </Button>
          </Link>
        )}

        <a href="#trust-posture" className="w-full sm:w-auto">
          <Button variant="secondary" size="md" className="w-full sm:w-auto">
            Trust Model
          </Button>
        </a>

        <Link href="/u/elena" className="w-full sm:w-auto">
          <Button variant="ghost" size="md" className="w-full sm:w-auto text-cobalt">
            View Sample Profile &rarr;
          </Button>
        </Link>
      </div>
    </div>
  );
}
