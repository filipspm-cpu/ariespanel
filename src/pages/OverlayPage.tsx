import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { overlayCounterItems } from "@/services/overlayCounters";
import { useAppStore } from "@/store/useAppStore";
import type { DisplayInfo } from "@/types";
import { Info, Monitor, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

export function OverlayPage() {
  const overlay = useAppStore((s) => s.overlay);
  const patchOverlay = useAppStore((s) => s.patchOverlay);
  const counters = useAppStore((s) => s.counters);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void window.synvity?.listDisplays().then((d) => setDisplays(d ?? []));
    void window.synvity?.overlayIsOpen().then((v) => setOpen(Boolean(v)));
  }, []);

  useEffect(() => {
    if (overlay.enabled) setOpen(true);
  }, [overlay.enabled]);

  const pushState = async () => {
    await window.synvity?.overlayPush({
      overlay,
      overlayCounters: overlayCounterItems(counters),
      now: Date.now(),
    });
  };

  const openOverlay = async () => {
    await window.synvity?.overlayOpen({
      displayId: overlay.displayId ?? undefined,
    });
    setOpen(true);
    await pushState();
  };

  const closeOverlay = async () => {
    await window.synvity?.overlayClose();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    void pushState();
    void window.synvity?.overlayEditMode(overlay.editMode);
  }, [overlay, counters, open]);

  return (
    <div className="ink-page overflow-auto p-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Nakładka</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Skonfiguruj nakładkę gry i powiadomienia</p>
      </div>

      <div className="mt-6 grid w-full grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="ink-note xl:col-span-2">
          <Info size={16} className="mt-0.5 shrink-0" />
          Nakładka jest przezroczysta i zawsze przepuszcza kliknięcia do gry. W trybie edycji możesz przesuwać tylko
          elementy HUD — reszta ekranu nadal działa.
        </div>

        <div className="ink-card p-4">
          <div className="text-[13px] font-medium text-white">Aktywuj nakładkę</div>
          <p className="mt-1 text-[12px] text-zinc-500">Aktywuj nakładkę, aby wyświetlać informacje o grze</p>
          <button
            onClick={() => (open ? void closeOverlay() : void openOverlay())}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white text-[13px] font-medium text-black hover:bg-zinc-200"
          >
            <Monitor size={16} />
            {open ? "Zamknij okno nakładki" : "Otwórz okno nakładki"}
          </button>
        </div>

        <div className="ink-card p-4">
          <div className="text-[13px] font-medium text-white">Monitor nakładki</div>
          <p className="mt-1 text-[12px] text-zinc-500">Nakładka w trybie pełnoekranowym na tym monitorze</p>
          <Select
            className="mt-3"
            value={String(overlay.displayId ?? displays.find((d) => d.primary)?.id ?? "")}
            onChange={(v) => patchOverlay({ displayId: Number(v) })}
            options={displays.map((d) => ({
              value: String(d.id),
              label: `${d.label}${d.primary ? " (Główny)" : ""} — ${d.bounds.width} x ${d.bounds.height}`,
            }))}
          />
        </div>

        <div className="grid gap-3 xl:col-span-2 xl:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="ink-card flex items-center justify-between p-4">
              <div>
                <div className="text-[13px] font-medium text-white">Tryb edycji</div>
                <div className="text-[12px] text-zinc-500">
                  Przesuwaj elementy — kliknięcia obok nadal trafiają do gry
                </div>
              </div>
              <Toggle
                checked={overlay.editMode}
                onChange={(v) => {
                  patchOverlay({ editMode: v });
                  void window.synvity?.overlayEditMode(v);
                }}
              />
            </div>

            <div className="ink-card divide-y divide-white/[0.06]">
              <Row
                title="Powiadomienia push"
                checked={overlay.showPush}
                onChange={(v) => patchOverlay({ showPush: v })}
              />
              <Row title="Statystyki" checked={overlay.showReports} onChange={(v) => patchOverlay({ showReports: v })} />
              <Row title="Spotify" checked={overlay.showSpotify} onChange={(v) => patchOverlay({ showSpotify: v })} />
              <Row title="Zegar" checked={overlay.showClock} onChange={(v) => patchOverlay({ showClock: v })} />
            </div>

            <div className="ink-card p-4">
              <div className="text-[13px] font-medium text-white">Statystyki na HUD</div>
              <p className="mt-1 text-[12px] text-zinc-500">Wybierz, które liczniki pokazać na nakładce.</p>
              <div className="mt-3 divide-y divide-white/[0.06]">
                {counters.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0 pr-3">
                      <div className="truncate text-[13px] text-zinc-200">{c.name}</div>
                      <div className="text-[11px] text-zinc-600">{c.value}</div>
                    </div>
                    <Toggle
                      checked={c.showInOverlay}
                      onChange={(v) =>
                        useAppStore.getState().setCounters(
                          useAppStore.getState().counters.map((row) => (row.id === c.id ? { ...row, showInOverlay: v } : row)),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="ink-card p-4">
              <div className="text-[13px] font-medium text-white">Reset układu</div>
              <p className="mt-1 text-[12px] text-zinc-500">
                Przywróć domyślne pozycje i rozmiary albo wróć do poprzedniego układu.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={() => useAppStore.getState().resetOverlayLayout()}
                  className="ink-btn h-10 w-full justify-center text-[13px]"
                >
                  <RotateCcw size={14} />
                  Resetuj do domyślnych
                </button>
                <button
                  disabled={!overlay.previousLayout}
                  onClick={() => useAppStore.getState().restoreOverlayPrevious()}
                  className="ink-btn h-10 w-full justify-center text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Undo2 size={14} />
                  Przywróć poprzedni układ
                </button>
              </div>
            </div>

            <div className="ink-card p-4">
              <div className="text-[13px] font-medium text-white">Rozmiar elementów</div>
              <p className="mt-1 text-[12px] text-zinc-500">
                Suwakiem zmniejszasz lub powiększasz statystyki, Spotify i zegar na nakładce.
              </p>
              <div className="mt-4 grid gap-5">
                <ScaleSlider
                  label="Statystyki"
                  value={overlay.positions.reports.scale}
                  onRemember={() => useAppStore.getState().rememberOverlayLayout()}
                  onChange={(scale) =>
                    patchOverlay({
                      positions: {
                        ...overlay.positions,
                        reports: { ...overlay.positions.reports, scale },
                      },
                    })
                  }
                />
                <ScaleSlider
                  label="Spotify"
                  value={overlay.positions.spotify.scale}
                  onRemember={() => useAppStore.getState().rememberOverlayLayout()}
                  onChange={(scale) =>
                    patchOverlay({
                      positions: {
                        ...overlay.positions,
                        spotify: { ...overlay.positions.spotify, scale },
                      },
                    })
                  }
                />
                <ScaleSlider
                  label="Zegar"
                  value={overlay.positions.clock.scale}
                  onRemember={() => useAppStore.getState().rememberOverlayLayout()}
                  onChange={(scale) =>
                    patchOverlay({
                      positions: {
                        ...overlay.positions,
                        clock: { ...overlay.positions.clock, scale },
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScaleSlider({
  label,
  value,
  onChange,
  onRemember,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onRemember: () => void;
}) {
  const pct = Math.round((value || 1) * 100);
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="text-zinc-300">{label}</span>
        <span className="tabular-nums text-zinc-500">{pct}%</span>
      </div>
      <input
        type="range"
        min={40}
        max={250}
        step={5}
        value={pct}
        onPointerDown={onRemember}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="hud-slider"
      />
      <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
        <span>Mniejsze</span>
        <span>Większe</span>
      </div>
    </label>
  );
}

function Row({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-[13px] text-zinc-200">{title}</div>
        {hint ? <div className="text-[11px] text-zinc-600">{hint}</div> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}
