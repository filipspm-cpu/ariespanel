import { Card } from "@/components/ui/Card";
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
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <div className="shrink-0 pb-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">CMD Executor</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">Wyślij serię komend do wybranego procesu gry</p>
        </div>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-syn-border px-5 py-3">
            <div className="text-[14px] font-medium text-white">Wprowadź komendę</div>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              Wprowadź komendę. Okno zostanie aktywowane, a następnie komenda zostanie wysłana w zależności od
              ustawienia, z naciśnięciem wcześniej „T”.
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="mb-1 shrink-0 text-[11px] text-zinc-500">Komenda</div>
            <div className="min-h-0 flex-1">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="h-full w-full resize-none rounded-md border border-syn-border bg-[#0c0c0e] p-3 text-[13px] leading-6 text-zinc-200 outline-none focus:border-zinc-600"
                placeholder={"/komenda1\n/komenda2\n/komenda3"}
                spellCheck={false}
              />
            </div>
            {lastCommand && running ? (
              <div className="mt-2 shrink-0 text-[11px] text-zinc-500">Wysyłanie: {lastCommand}</div>
            ) : null}
          </div>
          <div className="flex shrink-0">
            <button
              onClick={() => (running ? void stop() : void run())}
              className="flex h-11 flex-1 items-center justify-center gap-2 border-t border-syn-border bg-[#1a1a1d] text-[13px] text-zinc-300 hover:bg-[#202024]"
            >
              {running ? <Square size={14} /> : <Play size={14} />}
              {running ? "Zatrzymaj" : "Wyślij komendy"}
            </button>
            <button
              onClick={() => setText("")}
              className="h-11 w-36 border-l border-t border-syn-border bg-[#141416] text-[13px] text-zinc-500 hover:text-zinc-300"
            >
              Wyczyść
            </button>
          </div>
        </Card>
      </div>

      <aside className="flex h-full w-[300px] shrink-0 flex-col overflow-auto border-l border-syn-line p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13px] font-medium text-white">Ustawienia</div>
          <button onClick={() => void refreshProcess()} className="text-zinc-500 hover:text-zinc-300">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="rounded-md border border-syn-border bg-[#0e0e10] p-3">
          <div className="text-[11px] text-zinc-500">Proces</div>
          <div className="mt-1 text-[13px] text-white">{processLabel}</div>
          <div className="text-[11px] text-zinc-600">{pid ? `PID: ${pid}` : "Oczekiwanie na grę"}</div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] text-zinc-200">Naciskaj T przed komendą</div>
            <div className="mt-1 text-[11px] leading-snug text-zinc-600">
              Wciśnie i zwolni T przed wysłaniem każdej komendy.
            </div>
          </div>
          <Toggle checked={cmd.pressT} onChange={(v) => patchCmd({ pressT: v })} />
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] text-zinc-200">Odwrócona kolejność</div>
          </div>
          <Toggle checked={cmd.reverse} onChange={(v) => patchCmd({ reverse: v })} />
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] text-zinc-200">Naciśnij Enter po komendzie</div>
          </div>
          <Toggle checked={cmd.pressEnter} onChange={(v) => patchCmd({ pressEnter: v })} />
        </div>

        <div className="mt-5">
          <div className="text-[13px] text-zinc-200">Odstęp między komendami (ms)</div>
          <input
            type="number"
            min={100}
            value={cmd.intervalMs}
            onChange={(e) => patchCmd({ intervalMs: Math.max(100, Number(e.target.value) || 100) })}
            className="mt-2 h-9 w-full rounded-md border border-syn-border bg-[#0e0e10] px-3 text-[13px] outline-none"
          />
          <div className="mt-1 text-[11px] text-zinc-600">Minimum 100 ms</div>
        </div>

        <button
          className="mt-4 text-[12px] text-zinc-500 hover:text-zinc-300"
          onClick={() => patchCmd({ pressT: false, reverse: false, pressEnter: true, intervalMs: 500 })}
        >
          Przywróć domyślne
        </button>

        <div className="mt-8">
          <div className="mb-3 text-[13px] font-medium text-white">Przegląd komend</div>
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
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className="text-zinc-500">{label}</span>
      <span className={`flex items-center gap-1 ${ok ? "text-syn-green" : "text-white"}`}>
        {ok ? <Check size={13} /> : null}
        {value}
      </span>
    </div>
  );
}
