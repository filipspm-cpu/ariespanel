import type { ReactNode } from "react";
import { clsx } from "./clsx";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("rounded-lg border border-syn-border bg-syn-card", className)}>
      {children}
    </div>
  );
}
