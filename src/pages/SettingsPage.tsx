import { Card } from "@/components/ui/Card";
import { useAppStore } from "@/store/useAppStore";
import { mergeImportedMacros, parseMacroFile } from "@/services/macroPack";
import type { UpdateStatus } from "@/types";
import { Download, FileUp, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const macros = useAppStore((s) => s.macros);
  const setMacros = useAppStore((s) => s.setMacros);
  const [version, setVersion] = useState("—");
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [packMsg, setPackMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void window.synvity?.appVersion().then((v) => setVersion(v));
    void window.synvity?.updateStatus().then((s) => setUpdate(s));
    const off = window.synvity?.onUpdateStatus((s) => setUpdate(s));
    return () => off?.();
  }, []);

  const check = async () => {
    setBusy(true);
    const s = await window.synvity?.updateCheck();
    if (s) setUpdate(s);
    setBusy(false);
  };

  const available = update?.status === "available" || update?.status === "downloaded";
  const letter = (settings.username || "A").trim().slice(0, 1).toUpperCase();

  const onPickMacros = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseMacroFile(text);
      const { next, added, skipped } = mergeImportedMacros(macros, parsed.macros);
      setMacros(next);
      setPackMsg(
        added
          ? `Dodano ${added} makr${skipped ? `, pominięto ${skipped} (już są)` : ""}.`
          : skipped
            ? "Wszystkie makra z pliku już masz."
            : "W pliku nie znaleziono makr.",
      );
    } catch (err) {
      setPackMsg(err instanceof Error ? err.message : "Nie udało się wczytać pliku.");
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="text-[26px] font-semibold tracking-tight text-white">Ustawienia</h1>
      <p className="mt-1 text-[13px] text-zinc-500">Konto, aktualizacje i szybki import makr</p>

      <div className="mt-6 max-w-lg space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-500/20 text-[16px] font-semibold text-violet-200">
              {letter}
            </div>
            <div>
              <div className="text-[12px] text-zinc-500">Nazwa użytkownika</div>
              <div className="text-[15px] font-medium text-white">{settings.username || "—"}</div>
            </div>
          </div>
          <input
            value={settings.username}
            onChange={(e) => patchSettings({ username: e.target.value })}
            className="mt-4 h-10 w-full rounded-lg border border-syn-border bg-[#0c0c0e] px-3 text-[13px] text-white outline-none focus:border-violet-500/50"
            placeholder="Twoja nazwa"
          />
        </Card>

        <Card className="overflow-hidden p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[15px] font-medium text-white">Aktualizacja</div>
              <div className="mt-1 text-[12px] text-zinc-500">Zainstalowana wersja v{version}</div>
            </div>
            <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-400">v{version}</span>
          </div>

          {available ? (
            <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-3">
              <div className="text-[12px] text-violet-200/80">Dostępna aktualizacja</div>
              <div className="mt-1 text-[20px] font-semibold tracking-tight text-white">v{update?.version}</div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-syn-border bg-[#0c0c0e] px-3 py-3 text-[13px] text-zinc-400">
              {update?.status === "checking"
                ? "Sprawdzanie…"
                : update?.status === "not-available"
                  ? "Masz najnowszą wersję."
                  : update?.status === "error"
                    ? update.message
                    : "Nie sprawdzono jeszcze aktualizacji."}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => void check()}
              disabled={busy}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-syn-border text-[13px] text-zinc-200 hover:bg-white/5 disabled:opacity-40"
            >
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
              Czy są dostępne aktualizacje?
            </button>
            {available ? (
              <button
                onClick={() => void window.synvity?.updateInstall()}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-500 text-[13px] font-medium text-white hover:bg-violet-400"
              >
                <Download size={14} />
                Zaktualizuj
              </button>
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[15px] font-medium text-white">Szybkie makra z pliku</div>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
            Wrzuć plik <span className="text-zinc-300">.txt</span> albo <span className="text-zinc-300">.ariesmacros</span>.
            Wzór jednej linii:
          </p>
          <pre className="mt-3 overflow-auto rounded-lg border border-syn-border bg-[#0c0c0e] px-3 py-2 text-[12px] text-zinc-300">
{`.w = Witam | Hejka | Cześć
.p = Poczekaj chwilę.`}
          </pre>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.macros,.ariesmacros,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void onPickMacros(file);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg border border-syn-border px-3 text-[13px] text-zinc-200 hover:bg-white/5"
          >
            <FileUp size={14} />
            Wczytaj plik makr
          </button>
          {packMsg ? <div className="mt-2 text-[12px] text-emerald-400">{packMsg}</div> : null}
        </Card>
      </div>
    </div>
  );
}
