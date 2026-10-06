import React from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { StatusBadge, type VerificationState } from "./StatusBadge";

export interface IndexListProps extends React.HTMLAttributes<HTMLOListElement> {
  children: React.ReactNode;
}

export function IndexList({ children, className, ...props }: IndexListProps) {
  return (
    <ol
      className={clsx(
        "divide-y divide-rule border-t border-b border-rule w-full list-none p-0 m-0",
        className
      )}
      role="list"
      {...props}
    >
      {children}
    </ol>
  );
}

export interface IndexItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  index: number | string;
  title: string;
  proofType: string;
  issuerName?: string | null;
  issuedDate?: string | null;
  status: VerificationState;
  href: string;
}

export function IndexItem({
  index,
  title,
  proofType,
  issuerName,
  issuedDate,
  status,
  href,
  className,
  ...props
}: IndexItemProps) {
  const formattedIndex =
    typeof index === "number" ? String(index).padStart(2, "0") : index;

  return (
    <li className={clsx("group w-full", className)} {...props}>
      <Link
        href={href}
        className={clsx(
          "flex flex-col md:flex-row md:items-center justify-between",
          "py-4 md:py-6 px-3 sm:px-4 -mx-3 sm:-mx-4",
          "transition-transform duration-normal ease-out",
          "hover:translate-x-1 hover:bg-ink/[0.02]",
          "motion-reduce:transform-none motion-reduce:transition-none",
          "min-h-[44px] gap-3 md:gap-6",
          "focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        )}
      >
        {/* Left: Index numeral + type + title */}
        <div className="flex items-start md:items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <span
            className="font-mono text-xs sm:text-sm font-semibold text-cobalt select-none pt-0.5 md:pt-0 shrink-0"
            aria-hidden="true"
          >
            {formattedIndex}
          </span>

          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-mono text-ink/60">
              {proofType.replace(/_/g, " ")}
            </span>
            <span className="font-display text-base sm:text-lg md:text-xl font-bold tracking-tight text-ink group-hover:text-cobalt transition-colors truncate">
              {title}
            </span>
          </div>
        </div>

        {/* Right: Issuer, Date, StatusBadge, Arrow */}
        <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-6 shrink-0 pl-7 md:pl-0">
          {/* Metadata: Issuer & Date */}
          <div className="flex flex-col items-start md:items-end font-mono text-[11px] sm:text-xs uppercase tracking-mono text-ink/75">
            {issuerName && <span className="font-medium text-ink truncate max-w-[180px]">{issuerName}</span>}
            {issuedDate && <span className="text-ink/50">{issuedDate}</span>}
          </div>

          <StatusBadge status={status} />

          <span
            className="font-mono text-sm text-cobalt opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline-block select-none"
            aria-hidden="true"
          >
            &rarr;
          </span>
        </div>
      </Link>
    </li>
  );
}
