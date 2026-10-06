import React from "react";
import { clsx } from "clsx";

export interface RuleProps extends React.HTMLAttributes<HTMLHRElement> {
  variant?: "thin" | "thick" | "soft";
}

export function Rule({ variant = "thin", className, ...props }: RuleProps) {
  return (
    <hr
      className={clsx(
        "border-0 m-0",
        variant === "thin" && "border-t border-rule",
        variant === "thick" && "border-t-2 border-rule",
        variant === "soft" && "border-t border-rule-soft",
        className
      )}
      {...props}
    />
  );
}
