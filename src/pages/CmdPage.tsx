import { Toggle } from "@/components/ui/Toggle";
import { useAppStore } from "@/store/useAppStore";
import { Check, Play, RefreshCw, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function CmdPage() {
  const cmd = useAppStore((s) => s.cmd);
  const patchCmd = useAppStore((s) => s.patchCmd);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [processLabel, setProcessLabel] = useState("Nie wykryto procesu gry");
  const [pid, setPid] = useState<number | null>(null);

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

  const refreshProcess = async () => {
    const proc = await window.synvity?.findProcess();
    if (proc) {
      setProcessLabel(proc.title);
      setPid(proc.pid);
    } else {
      setProcessLabel("Nie wykryto procesu gry");
      setPid(null);
    }
  };

  useEffect(() => {
    void refreshProcess();
    const t = setInterval(() => void refreshProcess(), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const off1 = window.synvity?.onCmdProgress((d) => setLastCommand(d.command));
    const off2 = window.synvity?.onCmdDone(() => setRunning(false));
    return () => {
      off1?.();
      off2?.();
    };
  }, []);

  const run = async () => {
    if (!commands.length || running) return;
    setRunning(true);
    await window.synvity?.cmdRun({
      commands,
      intervalMs: cmd.intervalMs,
      pressT: cmd.pressT,
      reverse: cmd.reverse,
      pressEnter: cmd.pressEnter,
    });
  };

  const stop = async () => {
    await window.synvity?.cmdStop();
    setRunning(false);
  };

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
            {lastCommand && running ? <div className="cmd-progress">Wysyłanie: {lastCommand}</div> : null}
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
          <button onClick={() => void refreshProcess()} title="Odśwież proces">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="cmd-process">
          <span>Proces</span>
          <strong>{processLabel}</strong>
          <em>{pid ? `PID: ${pid}` : "Oczekiwanie na grę"}</em>
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
