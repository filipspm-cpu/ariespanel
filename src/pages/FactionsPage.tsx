import { Copyright } from "@/components/Copyright";
import { FACTION_GROUPS, mergeFactions, type FactionRecord, type FactionView } from "@/data/factions";
import { FACTION_LOGOS } from "@/data/factionLogos";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type FactionsResult = {
  ok?: boolean;
  error?: string;
  factions?: FactionRecord[];
};

function StatusBadge({ frozen }: { frozen: boolean }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ${
        frozen ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"
      }`}
    >
      {frozen ? "Zamrożona" : "Aktywna"}
    </span>
  );
}

function FactionRow({ faction }: { faction: FactionView }) {
  return (
    <div
      className={`grid grid-cols-1 items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] ${
        faction.frozen ? "opacity-70" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <img src={FACTION_LOGOS[faction.id]} alt="" className="h-12 w-12 shrink-0 rounded-xl object-contain" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-white">{faction.name}</div>
          <div className="mt-0.5 text-[11px] text-zinc-600">{faction.short}</div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-zinc-600">Lider</div>
        <div className={`truncate text-[13px] ${faction.leader ? "text-zinc-200" : "text-zinc-600"}`}>
          {faction.leader || "Nie ustawiono"}
        </div>
      </div>
      <StatusBadge frozen={faction.frozen} />
    </div>
  );
}

export function FactionsPage() {
  const [factions, setFactions] = useState<FactionView[]>(() => mergeFactions([]));
  const [refreshing, setRefreshing] = useState(false);
  const [dbError, setDbError] = useState("");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const result = (await window.synvity?.factionsList?.()) as FactionsResult | undefined;
      if (result?.factions) setFactions(mergeFactions(result.factions));
      if (result?.ok === false && (result.error === "server" || result.error === "offline")) {
        setDbError(
          result.error === "offline"
            ? "Brak połączenia z bazą. Widać ostatni zapis z serwera."
            : "Baza frakcji nie odpowiada. LH.pl puszcza MySQL tylko z localhost — panel czyta liderów przez PHP na filipekweb.pl.",
        );
      } else {
        setDbError("");
      }
    } catch {
      setFactions(mergeFactions([]));
      setDbError("Baza frakcji nie odpowiada. LH.pl puszcza MySQL tylko z localhost — panel czyta liderów przez PHP na filipekweb.pl.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const tick = window.setInterval(() => void load(false), 20000);
    const onFocus = () => void load(false);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const active = factions.filter((row) => !row.frozen).length;
  const frozen = factions.length - active;

  return (
    <div className="ink-page overflow-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Frakcje</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            {active} aktywnych · {frozen} zamrożonych
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#050505] px-3 text-[12px] text-zinc-400 hover:text-white"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Odśwież
        </button>
      </div>

      {dbError ? (
        <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
          {dbError}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        {FACTION_GROUPS.map((group) => {
          const rows = factions.filter((row) => row.group === group.id);
          return (
            <section key={group.id} className="ink-card overflow-hidden">
              <div className="border-b border-white/[0.06] px-4 py-3 text-[13px] font-medium text-white">{group.label}</div>
              {rows.map((faction) => (
                <FactionRow key={faction.id} faction={faction} />
              ))}
            </section>
          );
        })}
      </div>
      <Copyright className="settings-copyright" />
    </div>
  );
}
