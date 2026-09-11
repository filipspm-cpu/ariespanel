import type { UpdateStatus } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { Download } from "lucide-react";
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
    <div className="update-banner">
      <div className="update-banner-copy">
        <span className="update-banner-dot" />
        <Download size={13} strokeWidth={1.8} />
        <span>
          Dostępna aktualizacja <em>v{status.version}</em>
        </span>
        <span className="update-banner-hint">Wejdź w ustawienia i kliknij Zaktualizuj.</span>
      </div>
      <button type="button" onClick={() => setRoute("settings")}>
        Ustawienia
      </button>
    </div>
  );
}
