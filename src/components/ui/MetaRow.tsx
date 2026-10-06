import React from "react";
import { clsx } from "clsx";

export interface MetaRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  helper?: string;
}

export function MetaRow({ label, value, helper, className, ...props }: MetaRowProps) {
  return (
    <div
      className={clsx(
        "flex flex-col sm:flex-row sm:items-baseline justify-between py-2 border-b border-rule-soft gap-1 font-mono text-xs uppercase tracking-mono",
        className
      )}
      {...props}
    >
      <dt className="text-ink/70 font-medium">{label}</dt>
      <dd className="text-ink font-semibold text-right flex items-center justify-end gap-2">
        <span>{value}</span>
        {helper && <span className="text-ink/50 text-[10px]">({helper})</span>}
      </dd>
    </div>
  );
}
