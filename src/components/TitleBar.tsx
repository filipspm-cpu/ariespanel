import { Bell, Minus, Square, Wifi, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { breadcrumbs } from "@/data/navigation";
import { useAppStore } from "@/store/useAppStore";
import type { UpdateNotice, UpdateStatus } from "@/types";

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] tabular-nums tracking-wide text-zinc-300">
      {now.toLocaleTimeString("pl-PL", { hour12: false })}
    </div>
  );
}

function formatNoticeTime(at: number) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));
}

export function TitleBar() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const crumbs = breadcrumbs[route];
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [notices, setNotices] = useState<UpdateNotice[]>([]);
  const [openNotices, setOpenNotices] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void window.synvity?.appVersion().then((v) => setVersion(v));
    void window.synvity?.updateStatus().then((s) => setUpdate(s));
    void window.synvity?.updateNotices().then((rows) => setNotices(rows ?? []));
    const off = window.synvity?.onUpdateStatus((s) => {
      setUpdate(s);
      void window.synvity?.updateNotices().then((rows) => setNotices(rows ?? []));
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    if (!openNotices) return;
    const onDown = (e: MouseEvent) => {
      if (!noticeRef.current?.contains(e.target as Node)) setOpenNotices(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openNotices]);

  const netOk = update?.status !== "error";
  const unread = notices.filter((n) => !n.read).length;

  const toggleNotices = async () => {
    const next = !openNotices;
    setOpenNotices(next);
    if (next) {
      const rows = (await window.synvity?.updateNotices()) ?? [];
      setNotices(rows);
      const marked = (await window.synvity?.updateNoticesRead()) ?? rows;
      setNotices(marked);
    }
  };

  return (
    <div className="drag-region relative flex h-10 shrink-0 items-center border-b border-white/[0.06] bg-black px-3">
      <div className="no-drag z-10 flex items-center gap-1 text-[11px] text-syn-muted">
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <span className="text-zinc-600">›</span> : null}
            <span className={i === crumbs.length - 1 ? "text-zinc-400" : ""}>{c}</span>
          </span>
        ))}
        {version ? <span className="ml-2 text-[10px] text-zinc-600">v{version}</span> : null}
      </div>
      <Clock />
      <div className="no-drag z-10 ml-auto flex items-center gap-1">
        <span className="mr-1 flex h-6 items-center gap-1.5 rounded px-1.5 text-[11px] text-syn-sub">
          <span className="text-[13px] leading-none">🇵🇱</span>
          <span>PL</span>
        </span>
        <div className="relative" ref={noticeRef}>
          <button
            type="button"
            title="Powiadomienia"
            className="relative flex h-8 w-8 items-center justify-center text-zinc-400 hover:bg-white/5 hover:text-white"
            onClick={() => void toggleNotices()}
          >
            <Bell size={14} />
            {unread ? <span className="notice-dot" /> : null}
          </button>
          {openNotices ? (
            <div className="notice-pop">
              <div className="notice-pop-head">Aktualizacje</div>
              {notices.length === 0 ? (
                <div className="notice-empty">Brak powiadomień o aktualizacjach.</div>
              ) : (
                notices.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="notice-row"
                    onClick={() => {
                      setOpenNotices(false);
                      setRoute("settings");
                    }}
                  >
                    <div className="notice-row-title">
                      {n.kind === "installed" ? `Zainstalowano v${n.version}` : `Dostępna v${n.version}`}
                    </div>
                    <div className="notice-row-time">{formatNoticeTime(n.at)}</div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          title={netOk ? "Połączenie OK" : "Błąd aktualizacji"}
          className={`mr-1 flex h-8 w-8 items-center justify-center hover:bg-white/5 ${
            netOk ? "text-emerald-400" : "text-amber-400"
          }`}
          onClick={() => setRoute("settings")}
        >
          <Wifi size={15} strokeWidth={2.25} />
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center text-syn-sub hover:bg-white/5"
          onClick={() => void window.synvity?.minimize()}
        >
          <Minus size={14} />
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center text-syn-sub hover:bg-white/5"
          onClick={() => void window.synvity?.maximize()}
        >
          <Square size={11} />
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center text-syn-sub hover:bg-red-500 hover:text-white"
          onClick={() => void window.synvity?.close()}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
