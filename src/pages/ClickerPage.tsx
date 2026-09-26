import { Toggle } from "@/components/ui/Toggle";
import { MIN_CLICK_MS } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { Keyboard, MousePointerClick } from "lucide-react";
import { useEffect, useState } from "react";

type Phase = "off" | "armed" | "clicking";

const MOUSE_BINDS = [
  { id: "mouse-left", label: "Lewy" },
  { id: "mouse-right", label: "Prawy" },
  { id: "mouse-middle", label: "Środkowy" },
];

const SPEED_MIN = MIN_CLICK_MS;
const SPEED_MAX = 400;

function buttonLabel(button: string) {
  if (button === "mouse-left") return "LPM";
  if (button === "mouse-right") return "PPM";
  if (button === "mouse-middle") return "ŚPM";
  if (button === "space") return "Spacja";
  return button.toUpperCase();
}

function bindFromKey(event: KeyboardEvent) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return "";
  if (event.key === " ") return "space";
  if (/^F([1-9]|1\d|2[0-4])$/i.test(event.key)) return event.key.toLowerCase();
  if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) return event.key.toLowerCase();
  return "";
}

export function ClickerPage() {
  const clicker = useAppStore((s) => s.clicker);
  const patchClicker = useAppStore((s) => s.patchClicker);
  const [phase, setPhase] = useState<Phase>(clicker.enabled ? "armed" : "off");
  const [listening, setListening] = useState(false);
  const [intervalMs, setIntervalMs] = useState(clicker.intervalMs);

  const push = async (patch: { enabled?: boolean; intervalMs?: number; button?: string }) => {
    const enabled = patch.enabled ?? clicker.enabled;
    const nextInterval = Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.floor(patch.intervalMs ?? intervalMs)));
    const button = (patch.button ?? clicker.button ?? "mouse-left").trim() || "mouse-left";
    setIntervalMs(nextInterval);
    patchClicker({ enabled, intervalMs: nextInterval, button });
    const result = await window.synvity?.clickerSet?.({ enabled, intervalMs: nextInterval, button });
    setPhase(result?.phase ?? (enabled ? "armed" : "off"));
  };

  useEffect(() => {
    const off = window.synvity?.onClickerStatus?.((payload) => {
      if (payload?.phase) setPhase(payload.phase);
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    if (!clicker.enabled) return;
    void push({ enabled: true, intervalMs: clicker.intervalMs, button: clicker.button });
    // Arm a saved toggle once. Clicking starts only from the chosen button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setListening(false);
        return;
      }
      const name = bindFromKey(event);
      if (!name) return;
      setListening(false);
      void push({ button: name });
    };
    const onMouse = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-clicker-listen]")) return;
      event.preventDefault();
      event.stopPropagation();
      const button = event.button === 2 ? "mouse-right" : event.button === 1 ? "mouse-middle" : "mouse-left";
      setListening(false);
      void push({ button });
    };
    const blockMenu = (event: Event) => event.preventDefault();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    window.addEventListener("contextmenu", blockMenu, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("contextmenu", blockMenu, true);
    };
  }, [listening, clicker.enabled, clicker.button, intervalMs]);

  const status =
    phase === "clicking" ? "Klika" : phase === "armed" || clicker.enabled ? "Uzbrojony" : "Wyłączony";
  const hint =
    phase === "clicking"
      ? `Jeszcze raz ${buttonLabel(clicker.button || "mouse-left")} poza panelem zatrzymuje serię.`
      : clicker.enabled
        ? `Naciśnij ${buttonLabel(clicker.button || "mouse-left")} w grze, żeby zacząć. Suwak sam nie klika.`
        : "Suwak tylko uzbraja kliker. Start jest na wybranym przycisku.";

  return (
    <div className="ink-page overflow-auto p-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Auto clicker</h1>
        <p className="mt-1 max-w-xl text-[13px] text-zinc-500">
          Wybierz przycisk, uzbrój suwakiem i włącz klikanie dopiero tym przyciskiem.
        </p>
      </div>

      <div className="clicker-shell">
        <div className="ink-card clicker-status">
          <div className="flex items-center gap-4">
            <span className={`clicker-orb ${phase === "clicking" ? "clicking" : clicker.enabled ? "armed" : ""}`} />
            <div>
              <div className="text-[18px] font-semibold tracking-tight text-white">{status}</div>
              <div className="mt-1 max-w-sm text-[12px] leading-5 text-zinc-500">{hint}</div>
            </div>
          </div>
          <Toggle
            checked={clicker.enabled}
            onChange={(enabled) => {
              void push({ enabled });
            }}
          />
        </div>

        <div className="ink-card clicker-card">
          <div className="flex items-center gap-2 text-[13px] font-medium text-white">
            <MousePointerClick size={15} />
            Przycisk
          </div>
          <p className="mt-1 text-[12px] text-zinc-500">Ten przycisk włącza i wyłącza serię, kiedy kliker jest uzbrojony.</p>
          <div className="clicker-row">
            <button
              type="button"
              data-clicker-listen
              className={`clicker-key ${listening ? "listening" : ""}`}
              onClick={() => setListening((value) => !value)}
            >
              {listening ? "…" : buttonLabel(clicker.button || "mouse-left")}
            </button>
            <div className="min-w-0 flex-1">
              <div className="clicker-binds">
                {MOUSE_BINDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-clicker-listen
                    className={`clicker-chip ${clicker.button === item.id ? "on" : ""}`}
                    onClick={() => void push({ button: item.id })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button type="button" className="clicker-listen" data-clicker-listen onClick={() => setListening(true)}>
                <Keyboard size={13} />
                {listening ? "Naciśnij klawisz albo przycisk myszy. Esc anuluje." : "Ustaw inny klawisz"}
              </button>
            </div>
          </div>
        </div>

        <div className="ink-card clicker-card">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-white">Tempo</div>
              <div className="mt-1 text-[12px] text-zinc-500">Odstęp między kliknięciami.</div>
            </div>
            <div className="text-[22px] font-semibold tabular-nums text-white">
              {intervalMs}
              <span className="ml-1 text-[12px] font-medium text-zinc-500">ms</span>
            </div>
          </div>
          <input
            className="hud-slider mt-4"
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={10}
            value={Math.min(SPEED_MAX, Math.max(SPEED_MIN, intervalMs))}
            onChange={(event) => setIntervalMs(Number(event.target.value))}
            onPointerUp={(event) => void push({ intervalMs: Number(event.currentTarget.value) })}
            onKeyUp={(event) => void push({ intervalMs: Number(event.currentTarget.value) })}
          />
          <div className="mt-2 flex justify-between text-[11px] text-zinc-600">
            <span>Szybciej</span>
            <span>Wolniej</span>
          </div>
        </div>
      </div>
    </div>
  );
}
