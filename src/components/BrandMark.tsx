import logo from "@/assets/aries-logo.png";
import { clsx } from "./ui/clsx";

export function BrandMark({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <img
        src={logo}
        alt="ARIES"
        className={compact ? "h-7 w-7 object-contain" : "h-9 w-9 object-contain"}
        draggable={false}
      />
      <div className="leading-none">
        <div
          className={clsx(
            "font-ethnocentric uppercase text-white",
            compact ? "text-[13px] tracking-[0.28em]" : "text-[17px] tracking-[0.32em]",
          )}
        >
          ARIES
        </div>
        {compact ? null : (
          <div className="font-mokoto mt-1 text-[9px] uppercase tracking-[0.38em] text-zinc-500">panel</div>
        )}
      </div>
    </div>
  );
}
