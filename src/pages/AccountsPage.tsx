import { Copyright } from "@/components/Copyright";
import { RankBadges, useAccountRanks } from "@/components/RankBadge";
import { formatCash } from "@/data/achievements";
import { RANK_ORDER, encodeRanks, hasDeveloperAccess, ranksFromRole, type AccountRank } from "@/data/testers";
import { useAppStore } from "@/store/useAppStore";
import type { AccountRewards } from "@/types/rewards";
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

function AccountAvatar({ name, url }: { name: string; url?: string }) {
  const letter = name.trim().slice(0, 1).toUpperCase() || "A";
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);
  if (!url || failed) {
    return <div className="accounts-avatar accounts-avatar-fallback">{letter}</div>;
  }
  return <img src={url} alt="" className="accounts-avatar" draggable={false} onError={() => setFailed(true)} />;
}

const RANK_LABELS: Record<AccountRank, string> = {
  developer: "Developer",
  vip: "VIP",
  beta: "Beta tester",
};

export function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountCard[]>([]);
  const [rewards, setRewards] = useState<AccountRewards[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const setTesters = useAppStore((s) => s.setTesters);
  const myId = useAppStore((s) => s.settings.discordId);
  const myRanks = useAccountRanks(myId);
  const canEdit = hasDeveloperAccess(myRanks);

  const load = useCallback(async (manual = false) => {
    const list = window.synvity?.accountsList;
    if (!list) {
      setReady(true);
      return;
    }
    if (manual) setRefreshing(true);
    try {
      const [rows, testers, rewardRows] = await Promise.all([
        list(),
        window.synvity?.ranksList?.() ?? Promise.resolve(undefined),
        window.synvity?.rewardsAccounts?.() ?? Promise.resolve([]),
      ]);
      setAccounts(rows ?? []);
      setRewards(rewardRows ?? []);
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
    const run = async () => {
      if (cancelled) return;
      await load(false);
    };
    void run();
    const tick = window.setInterval(() => void run(), 15000);
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const markPaid = async (id?: string) => {
    if (!id || !window.synvity?.rewardsPaid) return;
    const next = await window.synvity.rewardsPaid(id);
    if (next) setRewards(next);
  };

  const changeRanks = async (account: AccountCard, next: AccountRank[]) => {
    if (!account.id || !window.synvity?.ranksSet) return;
    const encoded = encodeRanks(next);
    const testers = await window.synvity.ranksSet({ id: account.id, rank: encoded, name: account.name });
    if (testers) setTesters(testers);
    setAccounts((rows) => rows.map((row) => (row.id === account.id ? { ...row, rank: encoded } : row)));
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
              const ranks = ranksFromRole(account.rank || "");
              const reward = rewards.find((row) => row.id === account.id);
              return (
                <div key={`${account.id || account.name}-${index}`} className="accounts-card">
                  <AccountAvatar name={account.name} url={account.avatarUrl} />
                  <div className="accounts-name">{account.name}</div>
                  <RankBadges ranks={ranks} size="xs" />
                  {canEdit && account.id ? (
                    <div className="accounts-rank-list">
                      {RANK_ORDER.map((rank) => {
                        const checked = ranks.includes(rank);
                        return (
                          <label key={rank} className="accounts-rank-option">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked ? ranks.filter((item) => item !== rank) : [...ranks, rank];
                                void changeRanks(account, next);
                              }}
                            />
                            {RANK_LABELS[rank]}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="accounts-meta">{formatLogin(account.lastLogin)}</div>
                  <div className="accounts-promo">
                    <div>Użycia kodu: {reward?.referrals ?? 0}</div>
                    <div>Wpisany kod: {reward?.redeemed ? "tak" : "nie"}</div>
                    {reward && reward.pendingCash > 0 ? <div>Do wypłaty: {formatCash(reward.pendingCash)}</div> : null}
                    {reward && reward.paidCash > 0 ? <div>Wypłacone: {formatCash(reward.paidCash)}</div> : null}
                    {reward?.code ? <div className="accounts-code">{reward.code}</div> : null}
                  </div>
                  {canEdit && account.id && reward && reward.pendingCash > 0 ? (
                    <button type="button" className="accounts-pay" onClick={() => void markPaid(account.id)}>
                      Wypłacono w grze
                    </button>
                  ) : null}
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
