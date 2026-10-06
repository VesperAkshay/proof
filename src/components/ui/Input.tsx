import React from "react";
import { clsx } from "clsx";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label?: string;
  helperText?: string;
  error?: string;
}

export function Input({
  id,
  label,
  helperText,
  error,
  className,
  disabled = false,
  ...props
}: InputProps) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={id}
          className="font-mono text-xs uppercase tracking-wider text-ink font-medium select-none"
        >
          {label}
        </label>
      )}

      <input
        id={id}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={clsx(
          "w-full bg-paper text-ink font-body text-sm px-3 py-2.5 rounded-sm min-h-[44px] border transition-colors",
          "border-rule focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2",
          error && "border-danger focus-visible:outline-danger",
          disabled && "opacity-50 cursor-not-allowed bg-warm-gray/30",
          className
        )}
        {...props}
      />

      {error ? (
        <p id={errorId} role="alert" className="font-mono text-xs text-danger tracking-tight">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="font-body text-xs text-ink/70">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
