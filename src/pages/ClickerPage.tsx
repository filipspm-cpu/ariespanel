import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import type { ClickerStatus } from "@/types";
import { MousePointerClick, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";

const HOTKEYS = ["F6", "F7", "F8", "F9", "F10", "Insert", "Pause"];

const EMPTY: ClickerStatus = {
  intervalMs: 100,
  button: "left",
  hotkey: "F6",
  repeat: 0,
  gameOnly: false,
  allowed: true,
  running: false,
  arming: false,
  clicks: 0,
};

function rateLabel(intervalMs: number) {
  const perSec = 1000 / Math.max(1, intervalMs);
  if (perSec >= 10) return `${Math.round(perSec)} / s`;
  return `${perSec.toFixed(1)} / s`;
}

export function ClickerPage() {
  const [status, setStatus] = useState<ClickerStatus>(EMPTY);
  const [intervalDraft, setIntervalDraft] = useState("100");
  const [repeatDraft, setRepeatDraft] = useState("0");
  const active = status.running || status.arming;

  useEffect(() => {
    void window.synvity?.clickerStatus?.().then((next) => {
      if (next) setStatus(next);
    });
    const off = window.synvity?.onClickerStatus?.((next) => setStatus(next));
    return () => off?.();
  }, []);

  useEffect(() => {
    setIntervalDraft(String(status.intervalMs));
    setRepeatDraft(String(status.repeat));
  }, [status.intervalMs, status.repeat]);

  const configure = async (
    patch: Partial<Pick<ClickerStatus, "intervalMs" | "button" | "hotkey" | "repeat" | "gameOnly">>,
  ) => {
    const next = await window.synvity?.clickerConfigure?.(patch);
    if (next) setStatus(next);
  };

  const toggle = async () => {
    const next = await window.synvity?.clickerToggle?.();
    if (next) setStatus(next);
  };

  const reset = async () => {
    const next = await window.synvity?.clickerReset?.();
    if (next) setStatus(next);
  };

  return (
    <div className="cmd-page">
      <div className="cmd-main">
        <div className="cmd-kicker">BETA · ARIES PANEL</div>
        <h1>Auto kliker</h1>
        <p className="cmd-lead">
          Klika w miejscu kursora. Włącz go skrótem w grze albo przełącz się na grę po starcie — dopóki panel jest na
          wierzchu, kliker czeka i nie klika własnego okna.
        </p>

        <section className="cmd-editor">
          <div className="cmd-editor-head">
            <strong>{active ? (status.arming ? "Ustaw kursor" : "Kliker pracuje") : "Gotowy"}</strong>
            <p>
              {status.arming
                ? "Przesuń kursor na grę. Pierwsze kliknięcie poleci za moment."
                : status.gameOnly
                  ? "Kliknięcia idą tylko wtedy, gdy okno gry jest na wierzchu."
                  : "Kliknięcia idą tam, gdzie stoi kursor."}
            </p>
          </div>
          <div className="cmd-editor-body">
            <div className="clicker-meter">
              <MousePointerClick size={18} />
              <div>
                <span>Kliknięcia</span>
                <strong>{status.clicks}</strong>
              </div>
              <em>{active && !status.arming ? rateLabel(status.intervalMs) : status.hotkey}</em>
            </div>
            {status.message ? <div className="cmd-progress">{status.message}</div> : null}
            {!status.allowed ? <div className="cmd-status">Auto kliker jest tylko dla beta testerów.</div> : null}
          </div>
          <div className="cmd-actions">
            <button type="button" onClick={() => void toggle()} disabled={!status.allowed}>
              {active ? <Square size={14} /> : <Play size={14} />}
              {active ? "Zatrzymaj" : "Włącz"}
            </button>
            <button type="button" onClick={() => void reset()} disabled={active}>
              Wyzeruj
            </button>
          </div>
        </section>
      </div>

      <aside className="cmd-side">
        <div className="cmd-side-top">
          <strong>Ustawienia</strong>
        </div>

        <div className="cmd-field">
          <strong>Przycisk</strong>
          <div className="mt-2">
            <Select
              value={status.button}
              onChange={(value) => void configure({ button: value === "right" ? "right" : "left" })}
              options={[
                { value: "left", label: "Lewy" },
                { value: "right", label: "Prawy" },
              ]}
            />
          </div>
        </div>

        <div className="cmd-field">
          <strong>Odstęp między kliknięciami (ms)</strong>
          <input
            type="number"
            min={50}
            max={2000}
            value={intervalDraft}
            onChange={(e) => setIntervalDraft(e.target.value)}
            onBlur={() => void configure({ intervalMs: Number(intervalDraft) || status.intervalMs })}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <p>Od 50 do 2000 ms · teraz {rateLabel(status.intervalMs)}</p>
        </div>

        <div className="cmd-field">
          <strong>Limit kliknięć</strong>
          <input
            type="number"
            min={0}
            max={100000}
            value={repeatDraft}
            onChange={(e) => setRepeatDraft(e.target.value)}
            onBlur={() => void configure({ repeat: Number(repeatDraft) || 0 })}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <p>0 oznacza pracę aż do zatrzymania</p>
        </div>

        <div className="cmd-field">
          <strong>Skrót start / stop</strong>
          <div className="mt-2">
            <Select
              value={status.hotkey}
              onChange={(value) => void configure({ hotkey: value })}
              options={HOTKEYS.map((key) => ({ value: key, label: key }))}
            />
          </div>
          <p>Działa globalnie, także w grze</p>
        </div>

        <div className="cmd-option">
          <div>
            <strong>Tylko okno gry</strong>
            <p>Pomija kliknięcia, dopóki gra nie jest na wierzchu.</p>
          </div>
          <Toggle checked={status.gameOnly} onChange={(value) => void configure({ gameOnly: value })} />
        </div>
      </aside>
    </div>
  );
}
