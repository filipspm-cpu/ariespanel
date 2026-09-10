import type { UpdateStatus } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { useEffect, useState } from "react";

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const setRoute = useAppStore((s) => s.setRoute);

  useEffect(() => {
    void window.synvity?.updateStatus().then((s) => setStatus(s));
    const off = window.synvity?.onUpdateStatus((s) => setStatus(s));
    return () => off?.();
  }, []);

  if (!status || status.status !== "available") return null;

  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-violet-500/20 bg-violet-500/10 px-4 text-[12px] text-violet-100">
      <span>Dostępna aktualizacja {status.version}. Wejdź w ustawienia i kliknij Zaktualizuj.</span>
      <button
        onClick={() => setRoute("settings")}
        className="rounded bg-violet-500 px-2 py-1 text-[11px] font-medium text-white"
      >
        Ustawienia
      </button>
    </div>
  );
}
