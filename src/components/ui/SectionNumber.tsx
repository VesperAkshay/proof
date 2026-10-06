import React from "react";
import { clsx } from "clsx";

export interface SectionNumberProps extends React.HTMLAttributes<HTMLDivElement> {
  number: string | number;
  label: string;
}

export function SectionNumber({ number, label, className, ...props }: SectionNumberProps) {
  const formattedNumber =
    typeof number === "number" ? String(number).padStart(2, "0") : number;

  return (
    <div
      className={clsx(
        "flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-cobalt",
        className
      )}
      {...props}
    >
      <span aria-hidden="true">{formattedNumber} /</span>
      <span>{label}</span>
    </div>
  );
}
