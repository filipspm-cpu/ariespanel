import { RankBadges, useAccountRanks } from "@/components/RankBadge";
import { FEEDBACK_CHANNELS, feedbackChannelLabel, type FeedbackChannelId } from "@/data/feedbackChannels";
import { hasDeveloperAccess } from "@/data/testers";
import { useAppStore } from "@/store/useAppStore";
import { Bug, Check, Lightbulb, LogIn, RefreshCw, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type FeedbackKind = "bug" | "suggestion";
type FeedbackStatus = "open" | "done" | "deleted";
type FeedbackChannel = FeedbackChannelId;

type FeedbackItem = {
  id: number;
  discordId: string;
  name: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  channel: FeedbackChannel;
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

function asStatus(value: unknown): FeedbackStatus {
  const raw = String(value || "").toLowerCase();
  if (raw === "done") return "done";
  if (raw === "deleted") return "deleted";
  return "open";
}

function asChannel(value: unknown): FeedbackChannel {
  const raw = String(value || "").toLowerCase();
  return FEEDBACK_CHANNELS.some((row) => row.id === raw) ? (raw as FeedbackChannel) : "other";
}

function normalizeItem(row: FeedbackItem): FeedbackItem {
  return { ...row, status: asStatus(row.status), channel: asChannel(row.channel) };
}

function statusRank(status: FeedbackStatus) {
  if (status === "deleted") return 2;
  if (status === "done") return 1;
  return 0;
}

function dedupeItems(rows: FeedbackItem[]): FeedbackItem[] {
  const seenId = new Set<number>();
  const byKey = new Map<string, FeedbackItem>();
  const order: string[] = [];
  for (const raw of rows) {
    const item = normalizeItem(raw);
    if (seenId.has(item.id)) continue;
    seenId.add(item.id);
    const key = `${item.discordId}|${item.channel}|${item.title}|${item.body}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      order.push(key);
      continue;
    }
    if (statusRank(item.status) > statusRank(existing.status)) {
      existing.status = item.status;
    }
  }
  return order.map((key) => byKey.get(key)!);
}

function statusLabel(status: FeedbackStatus) {
  if (status === "done") return "Wykonane";
  if (status === "deleted") return "Usunięte";
  return "Oczekuje";
}

function FeedbackCard({
  item,
  developer,
  busyId,
  onStatus,
}: {
  item: FeedbackItem;
  developer?: boolean;
  busyId?: number;
  onStatus?: (id: number, status: FeedbackStatus) => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-[#070707] p-3.5 ${
        item.status === "deleted"
          ? "border-white/[0.04] opacity-70"
          : item.status === "done"
            ? "border-emerald-500/20"
            : "border-white/[0.07]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${
            item.kind === "suggestion" ? "bg-sky-500/15 text-sky-300" : "bg-rose-500/15 text-rose-300"
          }`}
        >
          {item.kind === "suggestion" ? "Sugestia" : "Błąd"}
        </span>
        <span
          className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${
            item.status === "done"
              ? "bg-emerald-500/15 text-emerald-300"
              : item.status === "deleted"
                ? "bg-zinc-700 text-zinc-300"
                : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {statusLabel(item.status)}
        </span>
        <span className="rounded bg-white/[0.06] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
          {feedbackChannelLabel(item.channel)}
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-white">{item.title}</span>
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">
        {item.name || "Konto"}
        {item.createdAt ? ` · ${formatWhen(item.createdAt)}` : ""}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">{item.body}</p>
      {developer && onStatus ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyId === item.id}
            onClick={() => onStatus(item.id, item.status === "done" ? "open" : "done")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] ${
              item.status === "done"
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-white/[0.08] bg-[#050505] text-zinc-400 hover:text-white"
            }`}
          >
            <Check size={13} />
            Wykonane
          </button>
          <button
            type="button"
            disabled={busyId === item.id}
            onClick={() => onStatus(item.id, item.status === "deleted" ? "open" : "deleted")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] ${
              item.status === "deleted"
                ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                : "border-white/[0.08] bg-[#050505] text-zinc-400 hover:text-white"
            }`}
          >
            <Trash2 size={13} />
            Usuń
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function FeedbackPage() {
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const ranks = useAccountRanks(settings.discordId);
  const loggedIn = Boolean(settings.discordId);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [channel, setChannel] = useState<FeedbackChannel | "">("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [developer, setDeveloper] = useState(hasDeveloperAccess(ranks));
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [channelFilter, setChannelFilter] = useState<FeedbackChannel | "all">("all");

  const mine = useMemo(
    () => dedupeItems(items.filter((item) => !settings.discordId || item.discordId === settings.discordId)),
    [items, settings.discordId],
  );
  const all = useMemo(() => {
    const rows = dedupeItems(items);
    if (channelFilter === "all") return rows;
    return rows.filter((item) => item.channel === channelFilter);
  }, [items, channelFilter]);

  const load = useCallback(async () => {
    if (!window.synvity?.feedbackList) return;
    setLoading(true);
    try {
      const result = (await window.synvity.feedbackList()) as FeedbackList;
      setItems(dedupeItems(result?.items ?? []));
      setDeveloper(Boolean(result?.developer) || hasDeveloperAccess(ranks));
      if (result?.error === "network" || result?.error === "server") {
        setMessage("Nie udało się pobrać zgłoszeń.");
      }
    } catch {
      setMessage("Nie udało się pobrać zgłoszeń.");
    } finally {
      setLoading(false);
    }
  }, [ranks]);

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
    if (!channel) {
      setMessage("Wybierz, której strony dotyczy zgłoszenie.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = (await window.synvity?.feedbackCreate({
        kind,
        channel,
        title: title.trim(),
        body: body.trim(),
      })) as FeedbackList;
      if (!result?.ok) {
        if (result?.error === "login") setMessage("Zaloguj się przez Discord, aby wysłać zgłoszenie.");
        else if (result?.error === "invalid") setMessage("Uzupełnij tytuł i treść (minimum 3 znaki).");
        else setMessage("Nie udało się wysłać zgłoszenia.");
        if (result?.items) setItems(dedupeItems(result.items));
        return;
      }
      setItems(dedupeItems(result.items ?? []));
      setDeveloper(Boolean(result.developer) || hasDeveloperAccess(ranks));
      setTitle("");
      setBody("");
      setMessage(kind === "bug" ? "Błąd został zgłoszony." : "Sugestia została wysłana.");
    } catch {
      setMessage("Nie udało się wysłać zgłoszenia.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: number, status: FeedbackStatus) => {
    const current = items.find((item) => item.id === id);
    setBusyId(id);
    setMessage("");
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) return { ...item, status };
        if (
          current &&
          item.discordId === current.discordId &&
          item.channel === current.channel &&
          item.title === current.title &&
          item.body === current.body
        ) {
          return { ...item, status };
        }
        return item;
      }),
    );
    try {
      const result = (await window.synvity?.feedbackUpdate?.({ id, status })) as FeedbackList | undefined;
      if (result?.items) setItems(dedupeItems(result.items));
      if (!result?.ok) setMessage("Nie udało się zmienić statusu zgłoszenia.");
    } catch {
      setMessage("Nie udało się zmienić statusu zgłoszenia.");
    } finally {
      setBusyId(null);
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
        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="ink-card p-5">
            <div className="text-[14px] font-medium text-white">Nowe zgłoszenie</div>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-zinc-500">
              Zalogowano jako {settings.discordGlobalName || settings.username}
              <RankBadges ranks={ranks} size="xs" />
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
            <div className="mt-4">
              <div className="text-[12px] text-zinc-500">
                {kind === "bug" ? "Której strony dotyczy błąd?" : "Której strony dotyczy sugestia?"}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FEEDBACK_CHANNELS.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setChannel(row.id)}
                    className={`inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] ${
                      channel === row.id
                        ? "border-white/30 bg-white/[0.1] text-white"
                        : "border-white/[0.08] bg-[#050505] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {row.label}
                  </button>
                ))}
              </div>
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

          <div className="ink-card flex min-h-0 flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-medium text-white">Twoje zgłoszenia</div>
                <p className="mt-1 text-[12px] text-zinc-500">
                  To, co sam tu wysłałeś. Status od developera: Oczekuje, Wykonane albo Usunięte.
                </p>
              </div>
              <button type="button" onClick={() => void load()} className="ink-btn" disabled={loading}>
                <RefreshCw size={13} className={loading ? "animate-spin" : undefined} />
                Odśwież
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {mine.length === 0 ? (
                <div className="text-[13px] text-zinc-500">Nie masz jeszcze zgłoszeń.</div>
              ) : (
                mine.map((item) => (
                  <FeedbackCard
                    key={`mine-${item.id}`}
                    item={item}
                    developer={developer}
                    busyId={busyId ?? undefined}
                    onStatus={developer ? setStatus : undefined}
                  />
                ))
              )}
            </div>
            {developer ? (
              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <div className="text-[14px] font-medium text-white">Wszystkie zgłoszenia</div>
                <p className="mt-1 text-[12px] text-zinc-500">
                  Widoczne tylko dla developerów. Wykonane i Usuń widać też u osoby, która to zgłosiła.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setChannelFilter("all")}
                    className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] ${
                      channelFilter === "all"
                        ? "border-white/30 bg-white/[0.1] text-white"
                        : "border-white/[0.08] bg-[#050505] text-zinc-400"
                    }`}
                  >
                    Wszystkie
                  </button>
                  {FEEDBACK_CHANNELS.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setChannelFilter(row.id)}
                      className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] ${
                        channelFilter === row.id
                          ? "border-white/30 bg-white/[0.1] text-white"
                          : "border-white/[0.08] bg-[#050505] text-zinc-400"
                      }`}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-3">
                  {all.length === 0 ? (
                    <div className="text-[13px] text-zinc-500">
                      {channelFilter === "all" ? "Brak zgłoszeń." : "Brak zgłoszeń w tym kanale."}
                    </div>
                  ) : (
                    all.map((item) => (
                      <FeedbackCard
                        key={`all-${item.id}`}
                        item={item}
                        developer
                        busyId={busyId ?? undefined}
                        onStatus={setStatus}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
