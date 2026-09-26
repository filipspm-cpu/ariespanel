import { Copyright } from "@/components/Copyright";
import { RankBadges, useAccountRanks } from "@/components/RankBadge";
import { formatCash } from "@/data/achievements";
import {
  EDITABLE_RANKS,
  RANK_ORDER,
  encodeRanks,
  hasDeveloperAccess,
  hasMainDeveloperAccess,
  ranksFromRole,
  type AccountRank,
} from "@/data/testers";
import { useAppStore } from "@/store/useAppStore";
import type { AccountRewards } from "@/types/rewards";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type AccountCard = {
  id?: string;
  name: string;
  avatarUrl: string;
  lastLogin?: string;
  rank?: string;
  banned?: boolean;
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

function isDiscordId(id?: string) {
  return /^\d{5,}$/.test(String(id || ""));
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

function AccountMenu({
  open,
  onToggle,
  onClose,
  canDelete,
  canBan,
  banned,
  onDelete,
  onBan,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  canDelete: boolean;
  canBan: boolean;
  banned?: boolean;
  onDelete: () => void;
  onBan: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);
  if (!canDelete && !canBan) return null;
  return (
    <div className="accounts-menu" ref={ref}>
      <button type="button" className="accounts-menu-btn" aria-label="Opcje konta" onClick={onToggle}>
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div className="accounts-menu-pop">
          {canDelete ? (
            <button
              type="button"
              className="accounts-menu-item danger"
              onClick={() => {
                onClose();
                onDelete();
              }}
            >
              Usuń
            </button>
          ) : null}
          {canBan ? (
            <button
              type="button"
              className="accounts-menu-item"
              onClick={() => {
                onClose();
                onBan();
              }}
            >
              {banned ? "Odbanuj" : "Banuj"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const RANK_LABELS: Record<AccountRank, string> = {
  "main-developer": "MAIN DEVELOPER",
  developer: "Developer",
  vip: "VIP",
  beta: "Beta tester",
};

export function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountCard[]>([]);
  const [rewards, setRewards] = useState<AccountRewards[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const setTesters = useAppStore((s) => s.setTesters);
  const myId = useAppStore((s) => s.settings.discordId);
  const myRanks = useAccountRanks(myId);
  const canEdit = hasDeveloperAccess(myRanks);
  const canBan = hasMainDeveloperAccess(myRanks);

  const load = useCallback(
    async (manual = false) => {
      const list = window.synvity?.accountsList;
      if (!list) {
        setReady(true);
        return;
      }
      if (manual) setRefreshing(true);
      try {
        const [rowsResult, testersResult, rewardsResult] = await Promise.allSettled([
          list(),
          window.synvity?.ranksList?.() ?? Promise.resolve(undefined),
          window.synvity?.rewardsAccounts?.() ?? Promise.resolve([]),
        ]);
        if (rowsResult.status === "fulfilled") {
          setAccounts((rowsResult.value ?? []).filter((row) => isDiscordId(row.id)));
        }
        if (testersResult.status === "fulfilled" && testersResult.value) {
          setTesters(testersResult.value);
        }
        if (rewardsResult.status === "fulfilled") {
          setRewards(rewardsResult.value ?? []);
        }
      } catch {
        // Keep the last successful list — a ranks/rewards failure must not wipe Konta.
      } finally {
        setReady(true);
        setRefreshing(false);
      }
    },
    [setTesters],
  );

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

  const setBanned = async (account: AccountCard, banned: boolean) => {
    if (!account.id || !window.synvity?.accountsSetBan) return;
    if (banned && !window.confirm(`Zbanować konto ${account.name}? Nie będzie mogło korzystać z ARIES.`)) return;
    const rows = await window.synvity.accountsSetBan({ id: account.id, banned, name: account.name });
    if (rows) setAccounts(rows.filter((row) => isDiscordId(row.id)));
  };

  const removeAccount = async (account: AccountCard) => {
    if (!account.id || !window.synvity?.accountsDelete) return;
    if (!window.confirm(`Usunąć ${account.name} z listy kont?`)) return;
    const rows = await window.synvity.accountsDelete({ id: account.id });
    if (rows) setAccounts(rows.filter((row) => isDiscordId(row.id)));
    else setAccounts((prev) => prev.filter((row) => row.id !== account.id));
  };

  const changeRanks = async (account: AccountCard, next: AccountRank[]) => {
    if (!account.id || !window.synvity?.ranksSet) return;
    const encoded = encodeRanks(next.filter((rank) => rank !== "main-developer"));
    const testers = await window.synvity.ranksSet({ id: account.id, rank: encoded, name: account.name });
    if (testers) setTesters(testers);
    const saved = testers?.find((item) => item.id === account.id)?.role;
    setAccounts((rows) =>
      rows.map((row) => (row.id === account.id ? { ...row, rank: saved || encodeRanks(next) || row.rank } : row)),
    );
  };

  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">ARIES PANEL</div>
        <h1>Konta</h1>
        <button type="button" className="accounts-refresh" onClick={() => void load(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Odśwież
        </button>
        <div className="credits-rule" />
      </div>
      <div className="studio-body accounts-body">
        <div className="accounts-privacy">
          <strong>ARIES nie pobiera żadnych innych informacji z Discorda.</strong>
          <span>Zapisujemy wyłącznie ID konta Discord, nazwę z Discorda oraz avatar.</span>
        </div>
        {!ready ? (
          <div className="accounts-empty">Ładowanie…</div>
        ) : accounts.length === 0 ? (
          <div className="accounts-empty">Brak zalogowanych kont Discord.</div>
        ) : (
          <div className="accounts-grid">
            {accounts.map((account, index) => {
              const ranks = ranksFromRole(account.rank || "");
              const reward = rewards.find((row) => String(row.id || "").replace(/\D/g, "") === String(account.id));
              const key = String(account.id || account.name);
              const canDelete = Boolean(canEdit && account.id && account.id !== myId && !ranks.includes("main-developer"));
              const canBanThis = Boolean(canBan && account.id && account.id !== myId && !ranks.includes("main-developer"));
              return (
                <div
                  key={`${key}-${index}`}
                  className={`accounts-card${account.banned ? " is-banned" : ""}`}
                >
                  <AccountMenu
                    open={menuId === key}
                    onToggle={() => setMenuId((cur) => (cur === key ? null : key))}
                    onClose={() => setMenuId(null)}
                    canDelete={canDelete}
                    canBan={canBanThis}
                    banned={account.banned}
                    onDelete={() => void removeAccount(account)}
                    onBan={() => void setBanned(account, !account.banned)}
                  />
                  <AccountAvatar name={account.name} url={account.avatarUrl} />
                  <div className="accounts-name">{account.name}</div>
                  <RankBadges ranks={ranks} size="xs" />
                  {account.banned ? <div className="accounts-banned">Zbanowane</div> : null}
                  {canEdit ? (
                    <div className="accounts-rank-list">
                      {RANK_ORDER.map((rank) => {
                        const checked = ranks.includes(rank);
                        const locked = !EDITABLE_RANKS.includes(rank);
                        return (
                          <label
                            key={rank}
                            className={`accounts-rank-option${locked ? " is-locked" : ""}`}
                            title={locked ? "MAIN DEVELOPER można nadać i zdjąć tylko w bazie danych" : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (locked) return;
                                const keepMain = ranks.filter((item) => item === "main-developer");
                                const editable = ranks.filter((item) => item !== "main-developer");
                                const nextEditable = checked
                                  ? editable.filter((item) => item !== rank)
                                  : [...editable, rank];
                                void changeRanks(account, [...keepMain, ...nextEditable]);
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
