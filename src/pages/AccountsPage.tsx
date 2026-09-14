import { Copyright } from "@/components/Copyright";
import { RankBadge, useAccountRank } from "@/components/RankBadge";
import { rankFromRole, type AccountRank } from "@/data/testers";
import { useAppStore } from "@/store/useAppStore";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AccountCard = {
  id?: string;
  name: string;
  avatarUrl: string;
  lastLogin?: string;
  rank?: string;
};

function formatLogin(value?: string) {
  if (!value) return "brak logowania";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountCard[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const setTesters = useAppStore((s) => s.setTesters);
  const myId = useAppStore((s) => s.settings.discordId);
  const myRank = useAccountRank(myId);

  const load = useCallback(async (manual = false) => {
    const list = window.synvity?.accountsList;
    if (!list) {
      setReady(true);
      return;
    }
    if (manual) setRefreshing(true);
    try {
      const [rows, testers] = await Promise.all([list(), window.synvity?.ranksList?.() ?? Promise.resolve(undefined)]);
      setAccounts(rows ?? []);
      if (testers) setTesters(testers);
    } catch {
      if (!manual) setAccounts([]);
    } finally {
      setReady(true);
      setRefreshing(false);
    }
  }, [setTesters]);

  useEffect(() => {
    let cancelled = false;
    const run = async (manual = false) => {
      if (cancelled) return;
      await load(manual);
    };
    void run(false);
    const tick = window.setInterval(() => void run(false), 15000);
    const onFocus = () => void run(false);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const changeRank = async (account: AccountCard, rank: string) => {
    if (!account.id || !window.synvity?.ranksSet) return;
    const testers = await window.synvity.ranksSet({ id: account.id, rank, name: account.name });
    if (testers) setTesters(testers);
    setAccounts((rows) => rows.map((row) => (row.id === account.id ? { ...row, rank } : row)));
  };

  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">ARIES PANEL</div>
        <h1>Konta</h1>
        <button
          type="button"
          className="accounts-refresh"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Odśwież
        </button>
        <div className="credits-rule" />
      </div>
      <div className="studio-body accounts-body">
        {!ready ? (
          <div className="accounts-empty">Ładowanie…</div>
        ) : accounts.length === 0 ? (
          <div className="accounts-empty">Nikt jeszcze nie połączył Discorda.</div>
        ) : (
          <div className="accounts-grid">
            {accounts.map((account, index) => {
              const letter = account.name.trim().slice(0, 1).toUpperCase() || "A";
              const rank = rankFromRole(account.rank || "") as AccountRank | null;
              return (
                <div key={`${account.id || account.name}-${index}`} className="accounts-card">
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" className="accounts-avatar" draggable={false} />
                  ) : (
                    <div className="accounts-avatar accounts-avatar-fallback">{letter}</div>
                  )}
                  <div className="accounts-name">{account.name}</div>
                  <RankBadge rank={rank} size="xs" />
                  {myRank === "developer" && account.id ? (
                    <select
                      className="accounts-rank-select"
                      value={rank || ""}
                      onChange={(e) => void changeRank(account, e.target.value)}
                    >
                      <option value="">brak rangi</option>
                      <option value="developer">Developer</option>
                      <option value="beta">Beta tester</option>
                    </select>
                  ) : null}
                  <div className="accounts-meta">{formatLogin(account.lastLogin)}</div>
                </div>
              );
            })}
          </div>
        )}
        <Copyright className="settings-copyright" />
      </div>
    </div>
  );
}
