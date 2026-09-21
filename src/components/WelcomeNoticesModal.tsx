import { DEFAULT_NOTICES } from "@/data/defaultNotices";
import { hasMainDeveloperAccess } from "@/data/testers";
import { useAccountRanks } from "@/components/RankBadge";
import { useAppStore } from "@/store/useAppStore";
import type { NoticeKind, PanelNotice } from "@/types/notices";
import { Megaphone, ScrollText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function formatWhen(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function asNotices(rows: unknown): PanelNotice[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const item = row as PanelNotice;
      const title = String(item.title || "").trim();
      const body = String(item.body || "").trim();
      const kind = item.kind === "changelog" ? "changelog" : "announcement";
      if (!title || !body) return null;
      return {
        id: Number(item.id) || 0,
        kind,
        title,
        body,
        authorName: String(item.authorName || "").trim() || "ARIES",
        createdAt: String(item.createdAt || ""),
      };
    })
    .filter((row): row is PanelNotice => Boolean(row));
}

export function WelcomeNoticesModal() {
  const discordId = useAppStore((s) => s.settings.discordId);
  const ranks = useAccountRanks(discordId);
  const canOpenEditor = hasMainDeveloperAccess(ranks);
  const setRoute = useAppStore((s) => s.setRoute);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NoticeKind>("announcement");
  const [notices, setNotices] = useState<PanelNotice[]>([]);

  useEffect(() => {
    let cancelled = false;
    void window.synvity?.noticesList?.()
      .then((result) => {
        if (cancelled) return;
        const rows = asNotices(result?.notices);
        const popup = result?.popup !== false;
        setNotices(rows);
        setOpen(popup && rows.length > 0);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setNotices(DEFAULT_NOTICES);
        setOpen(true);
        setReady(true);
      });
    if (!window.synvity?.noticesList) {
      setNotices(DEFAULT_NOTICES);
      setOpen(true);
      setReady(true);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const announcements = useMemo(() => notices.filter((row) => row.kind === "announcement"), [notices]);
  const changelog = useMemo(() => notices.filter((row) => row.kind === "changelog"), [notices]);
  const rows = tab === "announcement" ? announcements : changelog;

  if (!ready || !open) return null;

  return (
    <div className="welcome-modal-backdrop" onClick={() => setOpen(false)}>
      <div className="welcome-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="welcome-modal-title">
        <button type="button" className="welcome-modal-close" onClick={() => setOpen(false)} aria-label="Zamknij">
          <X size={16} />
        </button>
        <div className="welcome-modal-kicker">ARIES PANEL</div>
        <h2 id="welcome-modal-title">Co nowego</h2>
        <p className="welcome-modal-lead">Changelog i ogłoszenia od main developera.</p>
        <div className="welcome-modal-tabs">
          <button
            type="button"
            className={tab === "announcement" ? "is-active" : ""}
            onClick={() => setTab("announcement")}
          >
            <Megaphone size={13} />
            Ogłoszenia
          </button>
          <button
            type="button"
            className={tab === "changelog" ? "is-active" : ""}
            onClick={() => setTab("changelog")}
          >
            <ScrollText size={13} />
            Changelog
          </button>
        </div>
        <div className="welcome-modal-list">
          {rows.length === 0 ? (
            <div className="welcome-modal-empty">
              {tab === "announcement" ? "Brak ogłoszeń." : "Brak wpisów w changelogu."}
            </div>
          ) : (
            rows.map((item) => (
              <article key={`${item.kind}-${item.id}-${item.title}`} className="welcome-modal-item">
                <div className="welcome-modal-item-head">
                  <strong>{item.title}</strong>
                  {item.createdAt ? <span>{formatWhen(item.createdAt)}</span> : null}
                </div>
                <p>{item.body}</p>
              </article>
            ))
          )}
        </div>
        <div className="welcome-modal-actions">
          {canOpenEditor ? (
            <>
              <button
                type="button"
                className="welcome-modal-ghost"
                onClick={() => {
                  void window.synvity?.noticesSetPopup?.(false);
                  setOpen(false);
                }}
              >
                Nie pokazuj więcej
              </button>
              <button
                type="button"
                className="welcome-modal-ghost"
                onClick={() => {
                  setOpen(false);
                  setRoute("notices");
                }}
              >
                Edytuj
              </button>
            </>
          ) : null}
          <button type="button" className="welcome-modal-primary" onClick={() => setOpen(false)}>
            Rozumiem
          </button>
        </div>
      </div>
    </div>
  );
}
