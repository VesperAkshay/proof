"use client";

import React, { useState } from "react";
import { HandleInput } from "@/components/ui/HandleInput";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Rule, SectionNumber } from "@/components/ui";

interface ClaimHandleFormProps {
  initialUsername?: string;
}

export function ClaimHandleForm({ initialUsername = "" }: ClaimHandleFormProps) {
  const [username, setUsername] = useState(initialUsername.replace(/^@/, ""));
  const [displayName, setDisplayName] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanUsername = username.trim().replace(/^@/, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanUsername) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/me/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          displayName: displayName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to claim handle.");
      }

      // Profile successfully created in database! Refresh to load full dashboard studio.
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg bg-paper border border-rule p-8 rounded-sm shadow-none">
      <div className="mb-6">
        <SectionNumber number={1} label="Identity Setup" />
        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mt-2 text-ink">
          Claim Your Handle
        </h1>
        <p className="font-body text-sm text-ink/70 mt-1 leading-relaxed">
          Your handle is your permanent identity on Proof (<code>proof.so/@{cleanUsername || "username"}</code>).
          Choose carefully; reserved names and already-claimed handles are protected.
        </p>
      </div>

      <Rule variant="thin" className="mb-6" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <HandleInput
          value={username}
          onChange={(val) => {
            setUsername(val);
            setError(null);
          }}
          onAvailabilityChange={setIsAvailable}
          disabled={loading}
        />

        <div>
          <label
            htmlFor="displayName"
            className="font-mono text-xs uppercase tracking-wider text-ink font-semibold select-none flex items-center justify-between mb-2"
          >
            <span>Display Name (Optional)</span>
            <span className="text-ink/60 font-normal">e.g. Akshay Sharma</span>
          </label>
          <Input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
            placeholder="Your full name or pseudonym"
            className="font-body"
          />
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger text-danger font-mono text-xs rounded-sm">
            &times; {error}
          </div>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            disabled={loading || !cleanUsername || !isAvailable}
            isLoading={loading}
          >
            Claim @{cleanUsername || "handle"} &amp; Enter Studio &rarr;
          </Button>
        </div>
      </form>
    </div>
  );
}
