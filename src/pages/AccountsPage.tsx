import { Copyright } from "@/components/Copyright";
import { useEffect, useState } from "react";

type AccountCard = { name: string; avatarUrl: string; ip?: string; lastLogin?: string };

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

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const list = window.synvity?.accountsList;
      if (!list) {
        setReady(true);
        return;
      }
      void list()
        .then((rows) => {
          if (cancelled) return;
          setAccounts(rows ?? []);
        })
        .catch(() => {
          if (!cancelled) setAccounts([]);
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
    };
    load();
    const tick = window.setInterval(load, 15000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div className="studio-page">
      <div className="studio-header">
        <div className="credits-kicker">ARIES PANEL</div>
        <h1>Konta</h1>
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
              return (
                <div key={`${account.name}-${account.ip}-${index}`} className="accounts-card">
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" className="accounts-avatar" draggable={false} />
                  ) : (
                    <div className="accounts-avatar accounts-avatar-fallback">{letter}</div>
                  )}
                  <div className="accounts-name">{account.name}</div>
                  <div className="accounts-meta">{account.ip || "brak IP"}</div>
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
