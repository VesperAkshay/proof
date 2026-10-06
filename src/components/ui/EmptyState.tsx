import React from "react";
import { clsx } from "clsx";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  indicator?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  indicator = "00 / EMPTY",
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center p-8 md:p-12 text-center border border-rule-soft bg-paper rounded-sm",
        className
      )}
      {...props}
    >
      <span className="font-mono text-xs uppercase tracking-widest text-cobalt mb-3">
        {indicator}
      </span>
      <h3 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-tight text-ink mb-2">
        {title}
      </h3>
      <p className="font-body text-sm text-ink/75 max-w-md mb-6 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
