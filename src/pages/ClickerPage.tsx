import { Toggle } from "@/components/ui/Toggle";
import { MIN_CLICK_MS } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { MousePointerClick } from "lucide-react";
import { useEffect, useState } from "react";

export function ClickerPage() {
  const clicker = useAppStore((s) => s.clicker);
  const patchClicker = useAppStore((s) => s.patchClicker);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState(String(clicker.intervalMs));

  const apply = async (enabled: boolean, intervalMs: number) => {
    const interval = Math.max(MIN_CLICK_MS, Math.floor(intervalMs) || MIN_CLICK_MS);
    patchClicker({ enabled, intervalMs: interval });
    const result = (await window.synvity?.clickerSet?.({ enabled, intervalMs: interval })) as
      | { ok?: boolean; platform?: string }
      | undefined;
    if (enabled && result?.platform && result.platform !== "win32") {
      setNote("Przełącznik działa. Same kliknięcia lecą tylko w systemie Windows.");
      return;
    }
    setNote(enabled ? "Auto clicker jest włączony." : "");
  };

  useEffect(() => {
    if (!clicker.enabled) return;
    void apply(true, clicker.intervalMs);
    // Sync a saved "on" state once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitInterval = () => {
    const intervalMs = Math.max(MIN_CLICK_MS, Math.floor(Number(draft) || MIN_CLICK_MS));
    setDraft(String(intervalMs));
    void apply(clicker.enabled, intervalMs);
  };

  return (
    <div className="ink-page overflow-auto p-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Auto clicker</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Lewy przycisk myszy klika w kółko, dopóki jest włączony.</p>
      </div>

      <div className="mt-6 flex max-w-xl flex-col gap-4">
        <div className="ink-card flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-white">
              <MousePointerClick size={16} />
            </span>
            <div>
              <div className="text-[14px] font-medium text-white">{clicker.enabled ? "Włączony" : "Wyłączony"}</div>
              <div className="text-[12px] text-zinc-500">On albo off</div>
            </div>
          </div>
          <Toggle
            checked={clicker.enabled}
            onChange={(enabled) => {
              const intervalMs = Math.max(MIN_CLICK_MS, Math.floor(Number(draft) || clicker.intervalMs));
              setDraft(String(intervalMs));
              void apply(enabled, intervalMs);
            }}
          />
        </div>

        <div className="ink-card p-5">
          <label className="block text-[13px] font-medium text-white">
            Odstęp między kliknięciami (ms)
            <input
              type="number"
              min={MIN_CLICK_MS}
              step={10}
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              onBlur={commitInterval}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="mt-2 h-10 w-40 rounded-md border px-3 text-[13px]"
            />
          </label>
          <p className="mt-2 text-[12px] text-zinc-500">Minimum {MIN_CLICK_MS} ms.</p>
          {note ? <div className="mt-3 text-[12px] text-zinc-400">{note}</div> : null}
        </div>
      </div>
    </div>
  );
}
