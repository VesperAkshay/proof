import React from "react";
import { clsx } from "clsx";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) {
    const clean = first.replace(/^@/, "");
    return (clean.charAt(0) || "?").toUpperCase();
  }
  const last = parts[parts.length - 1];
  if (!last) return first.charAt(0).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = "lg",
  className,
  ...props
}: AvatarProps) {
  const initials = getInitials(name);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 sm:w-20 sm:h-20 text-xl sm:text-2xl",
    xl: "w-24 h-24 sm:w-28 sm:h-28 text-3xl sm:text-4xl",
  }[size];

  if (src) {
    return (
      <div
        className={clsx(
          "relative overflow-hidden rounded-sm border border-rule shrink-0 bg-paper",
          sizeClasses,
          className
        )}
        {...props}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${name}'s avatar`}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      aria-label={`${name}'s avatar initials`}
      className={clsx(
        "flex items-center justify-center font-display font-bold uppercase tracking-tight",
        "rounded-sm border-2 border-rule bg-paper text-ink select-none shrink-0 shadow-none",
        sizeClasses,
        className
      )}
      {...props}
    >
      <span>{initials}</span>
    </div>
  );
}
