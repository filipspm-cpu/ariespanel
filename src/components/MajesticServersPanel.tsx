import { Card } from "@/components/ui/Card";
import { serverAvatarUrl } from "@/data/serverAvatars";
import type { LiveServerStatus } from "@/types";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function playerTone(n: number) {
  if (n >= 500) return "text-emerald-400";
  if (n >= 100) return "text-amber-400";
  return "text-red-400";
}

function playerDot(n: number) {
  if (n >= 500) return "bg-emerald-400";
  if (n >= 100) return "bg-amber-400";
  return "bg-red-400";
}

function iconColor(endpoint: string) {
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) h = (h * 31 + endpoint.charCodeAt(i)) >>> 0;
  const hues = [210, 25, 145, 0, 280, 45, 190, 320];
  return `hsl(${hues[h % hues.length]} 70% 55%)`;
}

type ProjectFilter = "all" | "majestic" | "gta5rp";
type RegionFilter = "all" | "ru" | "eu";

export function MajesticServersPanel() {
  const [servers, setServers] = useState<LiveServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState<ProjectFilter>("all");
  const [region, setRegion] = useState<RegionFilter>("all");
  const [sortDesc, setSortDesc] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await window.synvity?.majesticServers();
      setServers(list ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się pobrać listy serwerów.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    let list = [...servers];
    if (project !== "all") list = list.filter((s) => s.project === project);
    if (region !== "all") list = list.filter((s) => (s.region || "ru") === region);
    list.sort((a, b) => (sortDesc ? b.players - a.players : a.players - b.players));
    return list;
  }, [servers, project, region, sortDesc]);

  const onlineCount = filtered.filter((s) => s.online).length;
  const playersTotal = filtered.reduce((sum, s) => sum + (s.online ? s.players : 0), 0);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-syn-border px-4 py-3">
        <div>
          <div className="text-[16px] font-semibold text-white">
            Online Majestic Serwer {onlineCount} szt.
          </div>
          <div className="mt-0.5 text-[12px] text-zinc-500">Lista wszystkich serwerów Majestic z statusem online</div>
          <div className="mt-1 text-[12px] text-zinc-400">
            Gracze online: {playersTotal.toLocaleString("pl-PL")}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <FilterSelect
              value={region}
              onChange={(v) => setRegion(v as RegionFilter)}
              options={[
                { value: "all", label: "Wszystkie regiony" },
                { value: "ru", label: "RU" },
                { value: "eu", label: "EU" },
              ]}
            />
            <FilterSelect
              value={project}
              onChange={(v) => setProject(v as ProjectFilter)}
              options={[
                { value: "all", label: "Wszystkie projekty" },
                { value: "majestic", label: "Majestic" },
                { value: "gta5rp", label: "GTA5RP" },
              ]}
            />
            <button
              onClick={() => void load()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-syn-border px-2.5 text-[12px] text-zinc-300 hover:bg-white/5"
              title="Odśwież"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Odśwież
            </button>
          </div>
          <div className="flex flex-wrap justify-end gap-3 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> ≥500 graczy
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> 100–499 graczy
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" /> &lt;100 graczy
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-syn-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        <div>Serwer</div>
        <button
          className="inline-flex items-center gap-1 justify-self-end hover:text-zinc-300"
          onClick={() => setSortDesc((v) => !v)}
        >
          Gracze online
          <ChevronDown size={12} className={sortDesc ? "" : "rotate-180"} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {error ? (
          <div className="px-4 py-6 text-[13px] text-amber-200/90">{error}</div>
        ) : loading && servers.length === 0 ? (
          <div className="px-4 py-6 text-[13px] text-zinc-500">Ładowanie serwerów…</div>
        ) : (
          <ul>
            {filtered.map((s) => {
              const avatar = serverAvatarUrl(s.endpoint, s.project);
              return (
              <li
                key={s.endpoint}
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.02]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-md object-cover bg-[#111]"
                      draggable={false}
                    />
                  ) : (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[13px] font-bold text-black/80"
                      style={{ background: iconColor(s.endpoint) }}
                    >
                      {s.name.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-white">{s.name}</div>
                    <div className="mt-0.5 truncate rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                      {s.endpoint}
                    </div>
                  </div>
                </div>
                <div className={`tabular-nums text-[14px] font-semibold ${playerTone(s.players)}`}>
                  <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${playerDot(s.players)}`} />
                  {s.online ? s.players.toLocaleString("pl-PL") : "—"}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-syn-border bg-[#0c0c0e] px-2 text-[12px] text-zinc-300 outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
