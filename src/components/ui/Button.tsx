import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "./clsx";

export function Button({
  children,
  onClick,
  variant = "ghost",
  className,
  disabled,
  icon: Icon,
  type = "button",
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "solid" | "white" | "bar";
  className?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-40";
  const styles = {
    ghost: "border border-syn-border bg-syn-elevated text-syn-text hover:bg-white/5 h-8 px-3",
    solid: "bg-syn-elevated border border-syn-border text-syn-text h-8 px-3 hover:bg-white/5",
    white: "bg-white text-black h-10 px-4 hover:bg-zinc-200",
    bar: "w-full h-11 bg-[#1a1a1d] text-syn-sub hover:bg-[#202024] border-t border-syn-border",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={clsx(base, styles[variant], className)}>
      {Icon ? <Icon size={15} strokeWidth={1.75} /> : null}
      {children}
    </button>
  );
}
