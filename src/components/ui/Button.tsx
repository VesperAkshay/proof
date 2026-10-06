import React from "react";
import { clsx } from "clsx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={clsx(
        // Base layout & typography
        "inline-flex items-center justify-center font-mono uppercase tracking-wider text-center transition-transform duration-fast select-none rounded-sm min-h-[44px]",
        // Focus ring (WCAG 2.2 AA compliant, 2px focus color with offset)
        "focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2",
        // Sizes
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        // Variants
        variant === "primary" &&
          "bg-cobalt text-paper border border-cobalt hover:-translate-y-0.5 active:translate-y-0.5 shadow-none hover:bg-[#1337A8] active:bg-[#0F2D87]",
        variant === "secondary" &&
          "bg-transparent text-ink border border-rule hover:-translate-y-0.5 active:translate-y-0.5 hover:bg-warm-gray/30 active:bg-warm-gray/50",
        variant === "danger" &&
          "bg-vermilion text-paper border border-vermilion hover:-translate-y-0.5 active:translate-y-0.5 hover:bg-[#C93B26] active:bg-[#AD301E]",
        variant === "ghost" &&
          "bg-transparent text-ink border border-transparent hover:bg-warm-gray/20 hover:-translate-y-0.5 active:translate-y-0.5",
        // Disabled / Loading state
        isDisabled && "opacity-50 pointer-events-none cursor-not-allowed shadow-none transform-none",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
