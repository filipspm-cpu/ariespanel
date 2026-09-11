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

  if (!status || (status.status !== "available" && status.status !== "downloaded")) return null;

  return (
    <div className="update-banner">
      <div className="update-banner-mark">
        <Download size={13} strokeWidth={2.2} />
      </div>
      <div className="update-banner-copy">
        <span className="update-banner-kicker">Aktualizacja</span>
        <span className="update-banner-text">
          v{status.version} jest gotowa. Zainstaluj ją w ustawieniach.
        </span>
      </div>
      <button type="button" className="update-banner-btn" onClick={() => setRoute("settings")}>
        Ustawienia
      </button>
    </div>
  );
}
