import { Toggle } from "@/components/ui/Toggle";
import { mergeFactions, type FactionRecord, type FactionView } from "@/data/factions";
import { useCallback, useEffect, useRef, useState } from "react";

type FactionsResult = {
  ok?: boolean;
  factions?: FactionRecord[];
  error?: string;
};

export function FactionLeadersEditor() {
  const [factions, setFactions] = useState<FactionView[]>(() => mergeFactions([]));
  const [leaders, setLeaders] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const editing = useRef<Record<string, boolean>>({});
  const saveTail = useRef<Record<string, Promise<void>>>({});

  const apply = useCallback((rows: FactionRecord[] | undefined) => {
    const merged = mergeFactions(rows);
    setFactions(merged);
    setLeaders((prev) => {
      const next = { ...prev };
      for (const row of merged) {
        if (!editing.current[row.id]) next[row.id] = row.leader;
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const result = (await window.synvity?.factionsList?.()) as FactionsResult | undefined;
    if (result?.factions) apply(result.factions);
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (faction: FactionView, leader: string, frozen: boolean) => {
    if (!window.synvity?.factionsSave) return;
    const run = async () => {
      setMessage("");
      setFactions((prev) => prev.map((row) => (row.id === faction.id ? { ...row, frozen } : row)));
      try {
        const result = (await window.synvity?.factionsSave?.({
          id: faction.id,
          leader: leader.trim(),
          frozen,
        })) as FactionsResult | undefined;
        if (!result?.ok) {
          if (result?.error === "login") setMessage("Zaloguj się przez Discord.");
          else if (result?.error === "forbidden") setMessage("Tylko main developer może zmieniać liderów.");
          else setMessage("Nie udało się zapisać frakcji.");
          await load();
          return;
        }
        if (!editing.current[faction.id]) apply(result.factions);
        else {
          setFactions(mergeFactions(result.factions));
        }
        setMessage(`${faction.short} zapisane.`);
      } catch {
        setMessage("Nie udało się zapisać frakcji.");
        await load();
      }
    };
    const next = (saveTail.current[faction.id] || Promise.resolve()).then(run, run);
    saveTail.current[faction.id] = next;
    await next;
  };

  return (
    <div className="ink-card p-5">
      <div className="text-[14px] font-medium text-white">Liderzy frakcji</div>
      <p className="mt-1 text-[12px] text-zinc-500">
        Ustaw lidera i zamrożenie. Zakładka Frakcje pokazuje to wszystkim.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {factions.map((faction) => {
          const value = leaders[faction.id] ?? faction.leader;
          return (
            <div
              key={faction.id}
              className="grid items-center gap-3 rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2.5 md:grid-cols-[minmax(0,1.3fr)_minmax(180px,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: faction.color }} />
                  <span className="truncate text-[13px] text-white">{faction.name}</span>
                </div>
                <div className="mt-0.5 pl-4 text-[11px] text-zinc-600">
                  {faction.frozen ? "Zamrożona" : "Aktywna"}
                </div>
              </div>
              <label className="block text-[11px] text-zinc-500">
                Lider
                <input
                  value={value}
                  maxLength={64}
                  placeholder="Nick lidera"
                  onFocus={() => {
                    editing.current[faction.id] = true;
                  }}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLeaders((prev) => ({ ...prev, [faction.id]: next }));
                  }}
                  onBlur={(e) => {
                    editing.current[faction.id] = false;
                    const next = e.relatedTarget as HTMLElement | null;
                    if (next?.closest("[data-faction-freeze]")) return;
                    if (value.trim() !== faction.leader) void save(faction, value, faction.frozen);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  className="mt-1 h-9 w-full rounded-md border px-3 text-[13px]"
                />
              </label>
              <label data-faction-freeze="" className="flex items-center gap-2 text-[12px] text-zinc-400">
                <Toggle
                  checked={faction.frozen}
                  onChange={(next) => void save(faction, value, next)}
                />
                Zamrożona
              </label>
            </div>
          );
        })}
      </div>
      {message ? <div className="mt-3 text-[12px] text-zinc-400">{message}</div> : null}
    </div>
  );
}
