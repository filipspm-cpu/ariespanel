import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useAppStore } from "@/store/useAppStore";
import { Check, Play, RefreshCw, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ProcessRow = { pid: number; title: string; name: string };

const GAME_HINT = /gta|majestic|fivem|rage|altv|roleplay|playgta|grand theft/i;

function looksLikeGame(proc: ProcessRow) {
  return GAME_HINT.test(`${proc.title} ${proc.name}`);
}

function processLabelOf(proc: ProcessRow | null, fallback = "Nie wykryto procesu gry") {
  if (!proc) return fallback;
  if (proc.title && proc.name && proc.title !== proc.name) return `${proc.title} · ${proc.name}`;
  return proc.title || proc.name || fallback;
}

export function CmdPage() {
  const cmd = useAppStore((s) => s.cmd);
  const patchCmd = useAppStore((s) => s.patchCmd);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ index: number; total: number } | null>(null);
  const [windows, setWindows] = useState<ProcessRow[]>([]);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userPicked = useRef(false);

  const commands = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [text],
  );
  const chars = text.length;
  const dupes = commands.length - new Set(commands).size;
  const selected = windows.find((w) => w.pid === selectedPid) ?? null;
  const detected = selected && looksLikeGame(selected);

  const refreshProcess = async (force = true) => {
    try {
      const [list, proc] = await Promise.all([
        window.synvity?.listWindows(force),
        window.synvity?.findProcess(force),
      ]);
      const next = (list ?? []).filter((row): row is ProcessRow => Boolean(row?.pid));
      setWindows(next);
      setSelectedPid((current) => {
        if (userPicked.current && current && next.some((w) => w.pid === current)) return current;
        if (proc?.pid && next.some((w) => w.pid === proc.pid)) return proc.pid;
        if (current && next.some((w) => w.pid === current)) return current;
        const guess = next.find(looksLikeGame);
        return guess?.pid ?? proc?.pid ?? null;
      });
      if (proc || next.some(looksLikeGame)) setError(null);
    } catch {
      setWindows([]);
      if (!userPicked.current) setSelectedPid(null);
    }
  };

  useEffect(() => {
    void refreshProcess(true);
    const t = setInterval(() => void refreshProcess(false), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const off1 = window.synvity?.onCmdProgress((d) => {
      setLastCommand(d.command);
      if (d.index && d.total) setProgress({ index: d.index, total: d.total });
    });
    const off2 = window.synvity?.onCmdDone(() => {
      setRunning(false);
      setProgress(null);
    });
    return () => {
      off1?.();
      off2?.();
    };
  }, []);

  const run = async () => {
    if (!commands.length || running) return;
    (document.activeElement as HTMLElement | null)?.blur();
    if (!selectedPid) {
      setError("Nie wykryto gry. Uruchom GTA / Majestic albo wybierz okno z listy.");
      await refreshProcess(true);
      return;
    }
    setError(null);
    setRunning(true);
    setProgress({ index: 0, total: commands.length });
    try {
      const result = (await window.synvity?.cmdRun({
        commands,
        intervalMs: cmd.intervalMs,
        pressT: cmd.pressT,
        reverse: cmd.reverse,
        pressEnter: cmd.pressEnter,
        pid: selectedPid,
        title: selected?.title ?? null,
      })) as { ok?: boolean; error?: string } | undefined;
      if (result && result.ok === false) {
        if (result.error === "no-game") {
          setError("Nie wykryto gry. Uruchom GTA / Majestic albo wybierz okno z listy.");
        } else if (result.error === "already-running") {
          setError("Wysyłanie już trwa.");
        } else {
          setError("Wysyłanie przerwane. Spróbuj ponownie.");
        }
      }
    } catch {
      setError("Nie udało się wysłać komend.");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const stop = async () => {
    await window.synvity?.cmdStop();
    setRunning(false);
    setProgress(null);
  };

  const pickerOptions = useMemo(() => {
    const preferred = windows.filter((w) => looksLikeGame(w) || w.pid === selectedPid);
    const source = preferred.length ? preferred : windows.filter((w) => w.title);
    const seen = new Set<number>();
    const options = source
      .filter((w) => {
        if (seen.has(w.pid)) return false;
        seen.add(w.pid);
        return true;
      })
      .map((w) => ({
        value: String(w.pid),
        label: processLabelOf(w, w.name),
      }));
    if (!options.length) {
      options.push({ value: "", label: "Nie wykryto procesu gry" });
    } else if (!selectedPid) {
      options.unshift({ value: "", label: "Wybierz okno gry" });
    }
    return options;
  }, [windows, selectedPid]);

  return (
    <div className="cmd-page">
      <div className="cmd-main">
        <div className="cmd-kicker">ARIES PANEL</div>
        <h1>Wykonawca CMD</h1>
        <p className="cmd-lead">Wyślij serię komend do wybranego procesu gry.</p>

        <section className="cmd-editor">
          <div className="cmd-editor-head">
            <strong>Wprowadź komendy</strong>
            <p>
              Każda linia to jedna komenda. Okno gry zostanie aktywowane, a potem komendy polecą według ustawień — z
              opcjonalnym „T” przed każdą z nich.
            </p>
          </div>
          <div className="cmd-editor-body">
            <label htmlFor="cmd-text">Komendy</label>
            <textarea
              id="cmd-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"/komenda1\n/komenda2\n/komenda3"}
              spellCheck={false}
            />
            {lastCommand && running ? (
              <div className="cmd-progress">
                Wysyłanie{progress ? ` ${progress.index}/${progress.total}` : ""}: {lastCommand}
              </div>
            ) : null}
            {error ? <div className="cmd-error">{error}</div> : null}
          </div>
          <div className="cmd-actions">
            <button onClick={() => (running ? void stop() : void run())}>
              {running ? <Square size={14} /> : <Play size={14} />}
              {running ? "Zatrzymaj" : "Wyślij komendy"}
            </button>
            <button onClick={() => setText("")}>Wyczyść</button>
          </div>
        </section>
      </div>

      <aside className="cmd-side">
        <div className="cmd-side-top">
          <strong>Ustawienia</strong>
          <button onClick={() => void refreshProcess(true)} title="Odśwież proces">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className={`cmd-process ${detected ? "ok" : ""}`}>
          <span>Proces</span>
          <strong>{processLabelOf(selected)}</strong>
          <em>{selectedPid ? `PID: ${selectedPid}` : "Oczekiwanie na grę"}</em>
          <Select
            className="cmd-process-select"
            value={selectedPid ? String(selectedPid) : ""}
            onChange={(v) => {
              userPicked.current = Boolean(v);
              setSelectedPid(v ? Number(v) : null);
              setError(null);
            }}
            options={pickerOptions}
          />
        </div>

        <div className="cmd-option">
          <div>
            <strong>Naciskaj T przed komendą</strong>
            <p>Wciśnie i zwolni T przed wysłaniem każdej komendy.</p>
          </div>
          <Toggle checked={cmd.pressT} onChange={(v) => patchCmd({ pressT: v })} />
        </div>

        <div className="cmd-option">
          <div>
            <strong>Odwrócona kolejność</strong>
          </div>
          <Toggle checked={cmd.reverse} onChange={(v) => patchCmd({ reverse: v })} />
        </div>

        <div className="cmd-option">
          <div>
            <strong>Naciśnij Enter po komendzie</strong>
          </div>
          <Toggle checked={cmd.pressEnter} onChange={(v) => patchCmd({ pressEnter: v })} />
        </div>

        <div className="cmd-field">
          <strong>Odstęp między komendami (ms)</strong>
          <input
            type="number"
            min={100}
            value={cmd.intervalMs}
            onChange={(e) => patchCmd({ intervalMs: Math.max(100, Number(e.target.value) || 100) })}
          />
          <p>Minimum 100 ms</p>
        </div>

        <button
          className="cmd-reset"
          onClick={() => patchCmd({ pressT: false, reverse: false, pressEnter: true, intervalMs: 500 })}
        >
          Przywróć domyślne
        </button>

        <div className="cmd-review">
          <strong>Przegląd komend</strong>
          <Row label="Liczba komend" value={String(commands.length)} />
          <Row label="Liczba znaków" value={String(chars)} />
          <Row label="Duplikaty" value={dupes ? String(dupes) : "Brak"} ok={!dupes} />
          <Row label="Podwójne kary" value="Brak" ok />
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="cmd-row">
      <span>{label}</span>
      <b className={ok ? "ok" : undefined}>
        {ok ? <Check size={13} /> : null}
        {value}
      </b>
    </div>
  );
}
