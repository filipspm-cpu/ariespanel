import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { useAppStore } from "@/store/useAppStore";
import type { UpdateStatus } from "@/types";
import { Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

function statusLabel(s: UpdateStatus | null) {
  if (!s) return "—";
  switch (s.status) {
    case "checking":
      return "Sprawdzanie GitHuba…";
    case "available":
      return `Jest nowa wersja ${s.version}`;
    case "downloading":
      return `Pobieranie ${Math.round(s.percent ?? 0)}%`;
    case "downloaded":
      return `Wersja ${s.version} gotowa do instalacji`;
    case "not-available":
      return "Masz najnowszą wersję";
    case "error":
      return s.message || "Błąd aktualizacji";
    default:
      return "Gotowe do sprawdzenia";
  }
}

export function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const cmd = useAppStore((s) => s.cmd);
  const [version, setVersion] = useState("—");
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="text-[26px] font-semibold tracking-tight text-white">Ustawienia systemu</h1>
      <p className="mt-1 text-[13px] text-zinc-500">Preferencje lokalne zapisywane na tym komputerze · v{version}</p>

      <div className="mt-6 max-w-xl space-y-3">
        <Card className="p-4">
          <div className="text-[12px] text-zinc-500">Nazwa użytkownika</div>
          <input
            value={settings.username}
            onChange={(e) => patchSettings({ username: e.target.value })}
            className="mt-2 h-9 w-full rounded-md border border-syn-border bg-[#0c0c0e] px-3 text-[13px] outline-none"
          />
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-white">Aktualizacje z GitHuba</div>
              <div className="mt-1 text-[12px] text-zinc-500">
                Przy każdym otwarciu aplikacji sprawdzane jest repo{" "}
                <span className="text-zinc-300">filipspm-cpu/ariespanel</span>. Nowa wersja to tag na GitHubie
                (np. v1.1.1) — Actions buduje installer, a panel go pobiera. Repo jest prywatne, więc potrzebny jest
                token (Settings → Developer settings → Personal access tokens, uprawnienie repo).
              </div>
            </div>
            <span className="rounded bg-white/5 px-2 py-1 text-[11px] text-zinc-400">v{version}</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-[12px] text-zinc-500">
              Właściciel (owner)
              <input
                className="mt-1 h-9 w-full rounded-md border border-syn-border bg-[#0c0c0e] px-3 text-[13px] text-white outline-none"
                placeholder="twoj-login"
                value={settings.githubOwner}
                onChange={(e) => patchSettings({ githubOwner: e.target.value })}
              />
            </label>
            <label className="text-[12px] text-zinc-500">
              Repozytorium
              <input
                className="mt-1 h-9 w-full rounded-md border border-syn-border bg-[#0c0c0e] px-3 text-[13px] text-white outline-none"
                placeholder="aries"
                value={settings.githubRepo}
                onChange={(e) => patchSettings({ githubRepo: e.target.value })}
              />
            </label>
          </div>
          <label className="mt-3 block text-[12px] text-zinc-500">
            Token (tylko prywatne repo)
            <input
              type="password"
              className="mt-1 h-9 w-full rounded-md border border-syn-border bg-[#0c0c0e] px-3 text-[13px] text-white outline-none"
              placeholder="ghp_… opcjonalnie"
              value={settings.githubToken}
              onChange={(e) => patchSettings({ githubToken: e.target.value })}
            />
          </label>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[13px] text-zinc-300">Sprawdzaj przy starcie</span>
            <Toggle checked={settings.autoUpdate} onChange={(v) => patchSettings({ autoUpdate: v })} />
          </div>
          <div className="mt-3 rounded-md border border-syn-border bg-[#0c0c0e] px-3 py-2 text-[12px] text-zinc-400">
            {statusLabel(update)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void check()}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-syn-border px-3 text-[12px] text-zinc-200 hover:bg-white/5 disabled:opacity-40"
            >
              <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
              Sprawdź aktualizacje
            </button>
            <button
              onClick={() => void window.synvity?.updateInstall()}
              disabled={update?.status !== "downloaded"}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-violet-500 px-3 text-[12px] text-white disabled:opacity-40"
            >
              <Download size={13} />
              Zainstaluj i uruchom ponownie
            </button>
          </div>
        </Card>

        <Card className="p-4 text-[13px] text-zinc-400">
          <div className="text-white">Wykonawca CMD</div>
          <div className="mt-2">Odstęp: {cmd.intervalMs} ms</div>
          <div>Enter po komendzie: {cmd.pressEnter ? "tak" : "nie"}</div>
          <div>Klawisz T: {cmd.pressT ? "tak" : "nie"}</div>
        </Card>
        <Card className="p-4 text-[13px] text-zinc-500">
          Dane makr, folderów, liczników i nakładki są przechowywane w pliku lokalnym użytkownika Windows. Po restarcie
          aplikacji pozostają bez zmian.
        </Card>
      </div>
    </div>
  );
}
