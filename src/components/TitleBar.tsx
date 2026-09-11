import { Bell, Minus, Square, Wifi, X } from "lucide-react";
import { useEffect, useState } from "react";
import { breadcrumbs } from "@/data/navigation";
import { useAppStore } from "@/store/useAppStore";
import type { UpdateStatus } from "@/types";

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] tabular-nums tracking-wide text-zinc-300">
      {now.toLocaleTimeString("pl-PL", { hour12: false })}
    </div>
  );
}

export function TitleBar() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const crumbs = breadcrumbs[route];
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    void window.synvity?.appVersion().then((v) => setVersion(v));
    void window.synvity?.updateStatus().then((s) => setUpdate(s));
    const off = window.synvity?.onUpdateStatus((s) => setUpdate(s));
    return () => off?.();
  }, []);

  const netOk = update?.status !== "error";

  return (
    <div className="drag-region relative flex h-10 shrink-0 items-center border-b border-white/[0.06] bg-black px-3">
      <div className="no-drag z-10 flex items-center gap-1 text-[11px] text-syn-muted">
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <span className="text-zinc-600">›</span> : null}
            <span className={i === crumbs.length - 1 ? "text-zinc-400" : ""}>{c}</span>
          </span>
        ))}
        {version ? <span className="ml-2 text-[10px] text-zinc-600">v{version}</span> : null}
      </div>
      <Clock />
      <div className="no-drag z-10 ml-auto flex items-center gap-1">
        <span className="mr-1 flex h-6 items-center gap-1.5 rounded px-1.5 text-[11px] text-syn-sub">
          <span className="text-[13px] leading-none">🇵🇱</span>
          <span>PL</span>
        </span>
        <button
          type="button"
          title="Powiadomienia"
          className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:bg-white/5 hover:text-white"
          onClick={() => setRoute("overlay")}
        >
          <Bell size={14} />
        </button>
        <button
          type="button"
          title={netOk ? "Połączenie OK" : "Błąd aktualizacji"}
          className={`mr-1 flex h-8 w-8 items-center justify-center hover:bg-white/5 ${
            netOk ? "text-emerald-400" : "text-amber-400"
          }`}
          onClick={() => setRoute("settings")}
        >
          <Wifi size={15} strokeWidth={2.25} />
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center text-syn-sub hover:bg-white/5"
          onClick={() => void window.synvity?.minimize()}
        >
          <Minus size={14} />
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center text-syn-sub hover:bg-white/5"
          onClick={() => void window.synvity?.maximize()}
        >
          <Square size={11} />
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center text-syn-sub hover:bg-red-500 hover:text-white"
          onClick={() => void window.synvity?.close()}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
