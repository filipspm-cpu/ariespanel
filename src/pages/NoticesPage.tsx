import { Copyright } from "@/components/Copyright";
import { RankBadges, useAccountRanks } from "@/components/RankBadge";
import { Toggle } from "@/components/ui/Toggle";
import { hasMainDeveloperAccess } from "@/data/testers";
import { useAppStore } from "@/store/useAppStore";
import type { NoticeKind, PanelNotice } from "@/types/notices";
import { Megaphone, ScrollText, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type NoticesResult = {
  ok: boolean;
  editor?: boolean;
  popup?: boolean;
  notices?: PanelNotice[];
  error?: string;
};

function formatWhen(value?: string) {
  if (!value) return "";
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

export function NoticesPage() {
  const settings = useAppStore((s) => s.settings);
  const ranks = useAccountRanks(settings.discordId);
  const editor = hasMainDeveloperAccess(ranks);
  const [kind, setKind] = useState<NoticeKind>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [popup, setPopup] = useState(true);
  const [notices, setNotices] = useState<PanelNotice[]>([]);

  const applyResult = (result?: NoticesResult | null) => {
    if (!result) return;
    if (result.notices) setNotices(result.notices);
    if (typeof result.popup === "boolean") setPopup(result.popup);
  };

  const load = useCallback(async () => {
    const result = (await window.synvity?.noticesList?.()) as NoticesResult | undefined;
    applyResult(result);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    if (!editor || !window.synvity?.noticesCreate) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await window.synvity.noticesCreate({
        kind,
        title: title.trim(),
        body: body.trim(),
      });
      applyResult(result);
      if (!result?.ok) {
        if (result?.error === "login") setMessage("Zaloguj się przez Discord.");
        else if (result?.error === "forbidden") setMessage("Tylko main developer może tu pisać.");
        else if (result?.error === "invalid") setMessage("Uzupełnij tytuł i treść (minimum 3 znaki).");
        else setMessage("Nie udało się opublikować wpisu.");
        return;
      }
      setTitle("");
      setBody("");
      setMessage(kind === "announcement" ? "Ogłoszenie zostało opublikowane." : "Wpis w changelogu został dodany.");
    } catch {
      setMessage("Nie udało się opublikować wpisu.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: PanelNotice) => {
    if (!editor || !window.synvity?.noticesDelete) return;
    setBusyId(item.id || item.title);
    setMessage("");
    const previous = notices;
    setNotices((rows) => rows.filter((row) => row.id !== item.id || row.title !== item.title));
    try {
      const result = await window.synvity.noticesDelete({ id: item.id, title: item.title });
      applyResult(result);
      if (!result?.ok) {
        setNotices(previous);
        setMessage("Nie udało się usunąć wpisu.");
      }
    } catch {
      setNotices(previous);
      setMessage("Nie udało się usunąć wpisu.");
    } finally {
      setBusyId(null);
    }
  };

  const togglePopup = async (next: boolean) => {
    if (!editor || !window.synvity?.noticesSetPopup) return;
    const previous = popup;
    setPopup(next);
    try {
      const result = await window.synvity.noticesSetPopup(next);
      applyResult(result);
      if (!result?.ok) {
        setPopup(previous);
        setMessage("Nie udało się zapisać ustawienia okienka.");
      }
    } catch {
      setPopup(previous);
      setMessage("Nie udało się zapisać ustawienia okienka.");
    }
  };

  return (
    <div className="ink-page overflow-auto p-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Ogłoszenia</h1>
      </div>

      {!editor ? (
        <div className="ink-card mt-6 max-w-xl p-5">
          <div className="text-[14px] font-medium text-white">Brak uprawnień</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
            Ta zakładka jest tylko dla MAIN DEVELOPERA.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="flex flex-col gap-4">
            <div className="ink-card flex items-center justify-between p-5">
              <div>
                <div className="text-[14px] font-medium text-white">Okienko przy starcie</div>
              </div>
              <Toggle checked={popup} onChange={(v) => void togglePopup(v)} />
            </div>
            <div className="ink-card p-5">
              <div className="text-[14px] font-medium text-white">Nowy wpis</div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-zinc-500">
                Zalogowano jako {settings.discordGlobalName || settings.username}
                <RankBadges ranks={ranks} size="xs" />
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setKind("announcement")}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] ${
                    kind === "announcement"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                      : "border-white/[0.08] bg-[#050505] text-zinc-400"
                  }`}
                >
                  <Megaphone size={14} />
                  Ogłoszenie
                </button>
                <button
                  type="button"
                  onClick={() => setKind("changelog")}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] ${
                    kind === "changelog"
                      ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                      : "border-white/[0.08] bg-[#050505] text-zinc-400"
                  }`}
                >
                  <ScrollText size={14} />
                  Changelog
                </button>
              </div>
              <label className="mt-4 block text-[12px] text-zinc-500">
                {kind === "announcement" ? "Tytuł ogłoszenia" : "Wersja lub tytuł zmiany"}
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={191}
                  placeholder={kind === "announcement" ? "Promuj Aries panel" : "1.0.100"}
                  className="mt-1.5 h-10 w-full rounded-md border px-3 text-[13px]"
                />
              </label>
              <label className="mt-4 block text-[12px] text-zinc-500">
                Treść
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={4000}
                  rows={7}
                  placeholder={
                    kind === "announcement"
                      ? "Napisz, co mają zobaczyć wszyscy po wejściu do panelu."
                      : "Opisz, co się zmieniło. Każda linia to osobny punkt."
                  }
                  className="mt-1.5 w-full rounded-md border px-3 py-2 text-[13px] leading-relaxed"
                />
              </label>
              <button
                type="button"
                disabled={busy || title.trim().length < 3 || body.trim().length < 3}
                onClick={() => void publish()}
                className="mt-4 inline-flex h-10 items-center rounded-md bg-white px-4 text-[13px] font-medium text-black disabled:opacity-40"
              >
                {busy ? "Publikowanie…" : "Opublikuj"}
              </button>
              {message ? <div className="mt-3 text-[12px] text-zinc-400">{message}</div> : null}
            </div>
          </div>
          <div className="ink-card flex min-h-0 flex-col p-5">
            <div className="text-[14px] font-medium text-white">Opublikowane</div>
            <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
              {notices.length === 0 ? (
                <div className="text-[13px] text-zinc-500">Nie ma jeszcze żadnych wpisów.</div>
              ) : (
                notices.map((item) => (
                  <article key={`${item.id}-${item.title}`} className="rounded-xl border border-white/[0.06] bg-black/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                          {item.kind === "announcement" ? "Ogłoszenie" : "Changelog"}
                          {item.createdAt ? ` · ${formatWhen(item.createdAt)}` : ""}
                        </div>
                        <div className="mt-1 text-[14px] font-medium text-white">{item.title}</div>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === (item.id || item.title)}
                        onClick={() => void remove(item)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-rose-300 disabled:opacity-40"
                        title="Usuń"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-400">{item.body}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <Copyright className="settings-copyright" />
    </div>
  );
}
