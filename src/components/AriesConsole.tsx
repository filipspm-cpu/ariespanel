import { useEffect, useRef, useState } from "react";
import { Terminal, Trash2, X } from "lucide-react";
import type { PanelLogEntry } from "@/types/api";

function formatTime(at: number) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(at));
}

export function AriesConsole() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<PanelLogEntry[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void window.synvity?.consoleHistory?.().then((rows) => {
      if (Array.isArray(rows)) setEntries(rows);
    });
    const offEntry = window.synvity?.onConsoleEntry?.((entry) => {
      const next = entry as PanelLogEntry;
      if (!next?.id || !next.message) return;
      setEntries((prev) => [...prev, next].slice(-250));
      if (next.open) setOpen(true);
    });
    const offToggle = window.synvity?.onToggleConsole?.((force) => {
      setOpen((prev) => (force === undefined ? !prev : Boolean(force)));
    });
    return () => {
      offEntry?.();
      offToggle?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (window.synvity) return;
      const f11 = e.key === "F11";
      if (f11 && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const el = scroller.current;
    if (!open || !el) return;
    el.scrollTop = el.scrollHeight;
  }, [entries, open]);

  if (!open) return null;

  return (
    <section className="aries-console" data-console="true">
      <header className="aries-console-bar">
        <div className="aries-console-brand">
          <Terminal size={14} />
          <span className="aries-console-name">ARIES</span>
          <span className="aries-console-kicker">Konsola</span>
        </div>
        <div className="aries-console-hint">Shift+F11</div>
        <button type="button" className="aries-console-icon" title="Wyczyść" onClick={() => setEntries([])}>
          <Trash2 size={13} />
        </button>
        <button type="button" className="aries-console-icon" title="Zamknij" onClick={() => setOpen(false)}>
          <X size={14} />
        </button>
      </header>
      <div className="aries-console-log" ref={scroller}>
        {entries.length ? (
          entries.map((row) => (
            <article key={row.id} className={`aries-console-row is-${row.level}`}>
              <div className="aries-console-meta">
                <time>{formatTime(row.at)}</time>
                <span className="aries-console-level">{row.level}</span>
                <span className="aries-console-source">{row.source}</span>
              </div>
              <div className="aries-console-msg">{row.message}</div>
              {row.detail
                ? row.detail.split("\n").map((line, i) => (
                    <div key={i} className="aries-console-detail">
                      {line}
                    </div>
                  ))
                : null}
            </article>
          ))
        ) : (
          <div className="aries-console-empty">Brak wpisów. Błędy ustawień i nagród pojawią się tutaj.</div>
        )}
      </div>
    </section>
  );
}
