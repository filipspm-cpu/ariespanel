import { RankBadge, useAccountRank } from "@/components/RankBadge";
import { useAppStore } from "@/store/useAppStore";
import { Bug, Lightbulb, LogIn, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type FeedbackKind = "bug" | "suggestion";

type FeedbackItem = {
  id: number;
  discordId: string;
  name: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  createdAt: string;
};

type FeedbackList = {
  ok: boolean;
  developer: boolean;
  items: FeedbackItem[];
  error?: string;
  created?: boolean;
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

export function FeedbackPage() {
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const rank = useAccountRank(settings.discordId);
  const loggedIn = Boolean(settings.discordId);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [developer, setDeveloper] = useState(rank === "developer");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!window.synvity?.feedbackList) return;
    setLoading(true);
    try {
      const result = (await window.synvity.feedbackList()) as FeedbackList;
      setItems(result?.items ?? []);
      setDeveloper(Boolean(result?.developer) || rank === "developer");
      if (result?.error === "network" || result?.error === "server") {
        setMessage("Nie udało się pobrać zgłoszeń.");
      }
    } catch {
      setMessage("Nie udało się pobrać zgłoszeń.");
    } finally {
      setLoading(false);
    }
  }, [rank]);

  useEffect(() => {
    if (!loggedIn) return;
    void load();
  }, [loggedIn, load]);

  const connectDiscord = async () => {
    setDiscordBusy(true);
    setMessage("");
    try {
      const profile = await window.synvity?.discordConnect();
      if (!profile) throw new Error("Nie udało się połączyć z Discordem.");
      patchSettings({
        username: profile.globalName || profile.username,
        discordId: profile.id,
        discordUsername: profile.username,
        discordGlobalName: profile.globalName,
        discordAvatar: profile.avatar,
        discordAvatarUrl: profile.avatarUrl,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się połączyć z Discordem.");
    } finally {
      setDiscordBusy(false);
    }
  };

  const submit = async () => {
    if (!loggedIn) {
      setMessage("Zaloguj się przez Discord, aby wysłać zgłoszenie.");
      return;
    }
    if (title.trim().length < 3 || body.trim().length < 3) {
      setMessage("Uzupełnij tytuł i treść (minimum 3 znaki).");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = (await window.synvity?.feedbackCreate({ kind, title: title.trim(), body: body.trim() })) as FeedbackList;
      if (!result?.ok) {
        if (result?.error === "login") setMessage("Zaloguj się przez Discord, aby wysłać zgłoszenie.");
        else if (result?.error === "invalid") setMessage("Uzupełnij tytuł i treść (minimum 3 znaki).");
        else setMessage("Nie udało się wysłać zgłoszenia.");
        if (result?.items) setItems(result.items);
        return;
      }
      setItems(result.items ?? []);
      setDeveloper(Boolean(result.developer) || rank === "developer");
      setTitle("");
      setBody("");
      setMessage(kind === "bug" ? "Błąd został zgłoszony." : "Sugestia została wysłana.");
    } catch {
      setMessage("Nie udało się wysłać zgłoszenia.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ink-page overflow-auto p-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Zgłoś błąd</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Kanał na błędy i nowe sugestie. Zgłoszenia widzą developerzy.
        </p>
      </div>

      {!loggedIn ? (
        <div className="ink-card mt-6 max-w-xl p-5">
          <div className="text-[14px] font-medium text-white">Wymagane logowanie</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
            Żeby zgłosić błąd albo dodać sugestię, musisz być zalogowany przez Discord.
          </p>
          <button
            type="button"
            disabled={discordBusy}
            onClick={() => void connectDiscord()}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-[#5865F2] px-4 text-[13px] font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
          >
            <LogIn size={15} />
            {discordBusy ? "Łączenie…" : "Zaloguj przez Discord"}
          </button>
          {message ? <div className="mt-3 text-[12px] text-zinc-400">{message}</div> : null}
        </div>
      ) : (
        <div className={`mt-6 grid gap-4 ${developer ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : ""}`}>
          <div className="ink-card p-5">
            <div className="text-[14px] font-medium text-white">Nowe zgłoszenie</div>
            <p className="mt-1 text-[12px] text-zinc-500">
              Zalogowano jako {settings.discordGlobalName || settings.username}
              {rank ? " · " : ""}
              {rank ? <RankBadge rank={rank} size="xs" /> : null}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setKind("bug")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] ${
                  kind === "bug"
                    ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                    : "border-white/[0.08] bg-[#050505] text-zinc-400"
                }`}
              >
                <Bug size={14} />
                Błąd
              </button>
              <button
                type="button"
                onClick={() => setKind("suggestion")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] ${
                  kind === "suggestion"
                    ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                    : "border-white/[0.08] bg-[#050505] text-zinc-400"
                }`}
              >
                <Lightbulb size={14} />
                Sugestia
              </button>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={191}
              placeholder="Tytuł"
              className="mt-4 h-10 w-full rounded-md border border-white/[0.08] bg-[#050505] px-3 text-[13px] text-white outline-none"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              rows={7}
              placeholder={kind === "bug" ? "Co się stało i kiedy?" : "Jaki pomysł chcesz dodać?"}
              className="mt-3 w-full resize-y rounded-md border border-white/[0.08] bg-[#050505] px-3 py-2 text-[13px] text-white outline-none"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-[13px] font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
              >
                <Send size={14} />
                {busy ? "Wysyłanie…" : "Wyślij"}
              </button>
              <span className="text-[11px] text-zinc-600">
                {title.trim().length}/191 · {body.trim().length}/4000
              </span>
            </div>
            {message ? <div className="mt-3 text-[12px] text-zinc-400">{message}</div> : null}
          </div>

          {developer ? (
            <div className="ink-card flex min-h-0 flex-col p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-medium text-white">Zgłoszenia</div>
                  <p className="mt-1 text-[12px] text-zinc-500">Widoczne tylko dla developerów.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="ink-btn"
                  disabled={loading}
                >
                  <RefreshCw size={13} className={loading ? "animate-spin" : undefined} />
                  Odśwież
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {items.length === 0 ? (
                  <div className="text-[13px] text-zinc-500">Brak zgłoszeń.</div>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/[0.07] bg-[#070707] p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${
                            item.kind === "suggestion"
                              ? "bg-sky-500/15 text-sky-300"
                              : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {item.kind === "suggestion" ? "Sugestia" : "Błąd"}
                        </span>
                        <span className="min-w-0 truncate text-[13px] font-medium text-white">{item.title}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        {item.name || "Konto"}
                        {item.createdAt ? ` · ${formatWhen(item.createdAt)}` : ""}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">{item.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            items.length > 0 ? (
              <div className="ink-card p-5 xl:col-span-1">
                <div className="text-[14px] font-medium text-white">Twoje zgłoszenia</div>
                <div className="mt-4 space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/[0.07] bg-[#070707] p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${
                            item.kind === "suggestion"
                              ? "bg-sky-500/15 text-sky-300"
                              : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {item.kind === "suggestion" ? "Sugestia" : "Błąd"}
                        </span>
                        <span className="text-[13px] font-medium text-white">{item.title}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">{formatWhen(item.createdAt)}</div>
                      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
