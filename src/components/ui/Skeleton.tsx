import React from "react";
import { clsx } from "clsx";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading content..."
      className={clsx(
        "bg-warm-gray animate-pulse rounded-sm",
        className
      )}
      {...props}
    />
  );
}
