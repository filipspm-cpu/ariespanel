import type { UpdateStatus } from "@/types";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    void window.synvity?.updateStatus().then((s) => setStatus(s));
    const off = window.synvity?.onUpdateStatus((s) => setStatus(s));
    return () => off?.();
  }, []);

  if (!status || (status.status !== "downloaded" && status.status !== "downloading" && status.status !== "available")) {
    return null;
  }

  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-violet-500/20 bg-violet-500/10 px-4 text-[12px] text-violet-100">
      <span>
        {status.status === "downloading"
          ? `Pobieranie aktualizacji ${Math.round(status.percent ?? 0)}%`
          : status.status === "available"
            ? `Dostępna wersja ${status.version}`
            : `Wersja ${status.version} pobrana — zainstaluj, żeby zaktualizować.`}
      </span>
      {status.status === "downloaded" ? (
        <button
          onClick={() => void window.synvity?.updateInstall()}
          className="inline-flex items-center gap-1 rounded bg-violet-500 px-2 py-1 text-[11px] font-medium text-white"
        >
          <Download size={12} />
          Zainstaluj
        </button>
      ) : null}
    </div>
  );
}
