import { Toggle } from "@/components/ui/Toggle";
import { MIN_CLICK_MS, type MouseButton } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { MousePointerClick, Mouse } from "lucide-react";
import { useEffect, useState } from "react";

export function ClickerPage() {
  const clicker = useAppStore((s) => s.clicker);
  const patchClicker = useAppStore((s) => s.patchClicker);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState(String(clicker.intervalMs));

  const apply = async (enabled: boolean, intervalMs: number, button?: MouseButton) => {
    const interval = Math.max(MIN_CLICK_MS, Math.floor(intervalMs) || MIN_CLICK_MS);
    const finalButton = button || clicker.button;
    patchClicker({ enabled, intervalMs: interval, button: finalButton });
    const result = (await window.synvity?.clickerSet?.({ enabled, intervalMs: interval, button: finalButton })) as
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
    void apply(true, clicker.intervalMs, clicker.button);
    // Sync a saved "on" state once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitInterval = () => {
    const intervalMs = Math.max(MIN_CLICK_MS, Math.floor(Number(draft) || MIN_CLICK_MS));
    setDraft(String(intervalMs));
    void apply(clicker.enabled, intervalMs);
  };

  const buttonLabels: Record<MouseButton, string> = {
    left: "Lewy",
    right: "Prawy",
    middle: "Środkowy",
  };

  return (
    <div className="ink-page overflow-auto p-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Auto clicker</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Automatycznie klika wybranym przyciskiem myszy w kółko, dopóki jest włączony.
        </p>
      </div>

      <div className="mt-6 flex max-w-2xl flex-col gap-4">
        {/* Status Card */}
        <div className="ink-card flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-white">
              <MousePointerClick size={18} />
            </span>
            <div>
              <div className="text-[15px] font-semibold text-white">
                {clicker.enabled ? "Włączony" : "Wyłączony"}
              </div>
              <div className="text-[12px] text-zinc-500">
                {clicker.enabled ? "Klika automatycznie" : "Kliknij przełącznik aby włączyć"}
              </div>
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

        {/* Button Selection Card */}
        <div className="ink-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Mouse size={16} className="text-zinc-400" />
            <label className="text-[14px] font-semibold text-white">Przycisk myszy</label>
          </div>
          <div className="flex gap-2">
            {(["left", "right", "middle"] as MouseButton[]).map((btn) => (
              <button
                key={btn}
                onClick={() => {
                  patchClicker({ button: btn });
                  if (clicker.enabled) {
                    void apply(true, clicker.intervalMs, btn);
                  }
                }}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-[13px] font-medium transition-all ${
                  clicker.button === btn
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {buttonLabels[btn]}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-zinc-500">
            Wybierz, który przycisk myszy ma być automatycznie klikany
          </p>
        </div>

        {/* Interval Card */}
        <div className="ink-card p-5">
          <label className="block text-[14px] font-semibold text-white">
            Odstęp między kliknięciami
            <div className="mt-3 flex items-center gap-3">
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
                className="h-11 w-32 rounded-lg border-2 border-white/10 bg-white/[0.03] px-4 text-[14px] text-white transition-colors focus:border-blue-500 focus:outline-none"
              />
              <span className="text-[13px] text-zinc-400">milisekund (ms)</span>
            </div>
          </label>
          <p className="mt-3 text-[12px] text-zinc-500">
            Minimum {MIN_CLICK_MS} ms. Mniejsze wartości = szybsze klikanie.
          </p>
          {note ? (
            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-[12px] text-blue-300">
              {note}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
