import { serverAvatarUrl } from "@/data/serverAvatars";
import type { LiveServerStatus } from "@/types";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function playerTone(n: number) {
  if (n >= 500) return "text-emerald-300";
  if (n >= 100) return "text-amber-200";
  return "text-red-300";
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
  return `hsl(${hues[h % hues.length]} 55% 42%)`;
}

type RegionFilter = "all" | "ru" | "eu";

export function MajesticServersPanel() {
  const [servers, setServers] = useState<LiveServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    if (region !== "all") list = list.filter((s) => (s.region || "ru") === region);
    list.sort((a, b) => (sortDesc ? b.players - a.players : a.players - b.players));
    return list;
  }, [servers, region, sortDesc]);

  const onlineCount = filtered.filter((s) => s.online).length;
  const playersTotal = filtered.reduce((sum, s) => sum + (s.online ? s.players : 0), 0);

  return (
    <section className="home-servers">
      <div className="home-servers-head">
        <div>
          <div className="home-servers-title">Serwery Majestic</div>
          <div className="home-servers-sub">{onlineCount} online</div>
          <div className="home-servers-meta">Gracze: {playersTotal.toLocaleString("pl-PL")}</div>
        </div>
        <div>
          <div className="home-servers-tools">
            <select value={region} onChange={(e) => setRegion(e.target.value as RegionFilter)}>
              <option value="all">Wszystkie regiony</option>
              <option value="ru">RU</option>
              <option value="eu">EU</option>
            </select>
            <button onClick={() => void load()} title="Odśwież">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Odśwież
            </button>
          </div>
          <div className="home-servers-legend">
            <span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ≥500
            </span>
            <span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> 100–499
            </span>
            <span>
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> &lt;100
            </span>
          </div>
        </div>
      </div>

      <div className="home-servers-cols">
        <div>Serwer</div>
        <button onClick={() => setSortDesc((v) => !v)}>
          Gracze
          <ChevronDown size={12} className={sortDesc ? "" : "rotate-180"} />
        </button>
      </div>

      <div className="home-servers-list">
        {error ? (
          <div className="home-servers-empty">{error}</div>
        ) : loading && servers.length === 0 ? (
          <div className="home-servers-empty">Ładowanie serwerów…</div>
        ) : (
          <ul>
            {filtered.map((s) => {
              const avatar = serverAvatarUrl(s.endpoint);
              return (
                <li key={s.endpoint} className="home-servers-row">
                  <div className="flex min-w-0 items-center gap-3">
                    {avatar ? (
                      <img src={avatar} alt="" className="h-7 w-7 shrink-0 object-contain" draggable={false} />
                    ) : (
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white/80"
                        style={{ background: iconColor(s.endpoint) }}
                      >
                        {s.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="home-servers-name truncate">{s.name}</div>
                  </div>
                  <div className={`home-servers-count ${playerTone(s.players)}`}>
                    <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${playerDot(s.players)}`} />
                    {s.online ? s.players.toLocaleString("pl-PL") : "—"}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
