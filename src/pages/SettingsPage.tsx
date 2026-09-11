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

  const statusText =
    update?.status === "checking"
      ? "Sprawdzanie…"
      : update?.status === "not-available"
        ? "Masz najnowszą wersję."
        : update?.status === "error"
          ? update.message || "Nie udało się sprawdzić aktualizacji."
          : available
            ? `Dostępna v${update?.version}`
            : "Nie sprawdzono jeszcze aktualizacji.";

  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">ARIES PANEL</div>
        <h1>Ustawienia systemu</h1>
        <div className="credits-rule" />
      </div>

      <div className="studio-body settings-body">
        <div className="studio-card settings-profile">
          <div className="settings-avatar">{letter}</div>
          <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-zinc-500">Konto</div>
          <div className="mt-2 text-center text-[22px] font-semibold text-white">
            {settings.username || "Bez nazwy"}
          </div>
          <input
            value={settings.username}
            onChange={(e) => patchSettings({ username: e.target.value })}
            className="settings-input mt-5"
            placeholder="Twoja nazwa"
          />
        </div>

        <div className="studio-card settings-update">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Aktualizacja</div>
              <div className="mt-2 text-[22px] font-semibold text-white">v{version}</div>
              <div className="mt-1 text-[12px] text-zinc-500">Zainstalowana wersja</div>
            </div>
            <span className={`settings-pill ${available ? "on" : ""} ${update?.status === "error" ? "warn" : ""}`}>
              {available ? "Nowa" : update?.status === "error" ? "Błąd" : "OK"}
            </span>
          </div>

          <div className={`settings-status ${update?.status === "error" ? "warn" : available ? "on" : ""}`}>
            {statusText}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button onClick={() => void check()} disabled={busy} className="settings-btn">
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
              Sprawdź aktualizacje
            </button>
            {available ? (
              <button onClick={() => void window.synvity?.updateInstall()} className="settings-btn primary">
                <Download size={14} />
                Zaktualizuj
              </button>
            ) : null}
          </div>
        </div>

        <div className="studio-card settings-macros">
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Import makr</div>
          <div className="mt-2 text-[18px] font-medium text-white">Szybkie makra z pliku</div>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-zinc-500">
            Wrzuć plik <span className="text-zinc-300">.txt</span> albo{" "}
            <span className="text-zinc-300">.ariesmacros</span>. Jedna linia to jeden trigger:
          </p>
          <pre className="settings-code">{`.w = Witam | Hejka | Cześć
.p = Poczekaj chwilę.`}</pre>
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
          <button onClick={() => fileRef.current?.click()} className="settings-btn mt-4">
            <FileUp size={14} />
            Wczytaj plik makr
          </button>
          {packMsg ? <div className="mt-3 text-[12px] text-zinc-300">{packMsg}</div> : null}
        </div>
      </div>
    </div>
  );
}
