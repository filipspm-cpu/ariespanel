import { feedbackRequest } from "./accountsApi";
import { loadTesters } from "./testers";

export type FeedbackKind = "bug" | "suggestion";
export type FeedbackStatus = "open" | "done" | "deleted";
export type FeedbackChannel =
  | "home"
  | "cmd"
  | "overlay"
  | "macros"
  | "counters"
  | "forum"
  | "craft"
  | "settings"
  | "accounts"
  | "about"
  | "credits"
  | "achievements"
  | "other";

export type FeedbackItem = {
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

export type FeedbackList = {
  ok: boolean;
  developer: boolean;
  items: FeedbackItem[];
  error?: string;
};

function normalizeKind(raw: string): FeedbackKind {
  return raw === "suggestion" ? "suggestion" : "bug";
}

function normalizeStatus(raw: string): FeedbackStatus {
  const value = raw.trim().toLowerCase();
  if (value === "done" || value === "wykonane") return "done";
  if (value === "deleted" || value === "usun" || value === "usuniete" || value === "usunięte") return "deleted";
  return "open";
}

function normalizeChannel(raw: string): FeedbackChannel {
  const value = raw.trim().toLowerCase();
  if (value === "home" || value === "glowna" || value === "główna" || value.includes("strona")) return "home";
  if (value === "cmd") return "cmd";
  if (value === "overlay" || value === "nakladka" || value === "nakładka") return "overlay";
  if (value === "macros" || value === "makra") return "macros";
  if (value === "counters" || value === "statystyki") return "counters";
  if (value === "forum") return "forum";
  if (value === "craft") return "craft";
  if (value === "settings" || value === "ustawienia") return "settings";
  if (value === "accounts" || value === "konta") return "accounts";
  if (value === "about" || value.includes("aplikacji")) return "about";
  if (value === "credits" || value === "autorzy") return "credits";
  if (value === "achievements" || value === "osiagniecia" || value === "osiągnięcia") return "achievements";
  return "other";
}

function parseItems(payload: unknown): FeedbackItem[] {
  const rows =
    payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];
  return rows
    .map((row) => {
      const item = row as {
        id?: number | string;
        discordId?: string;
        discord_id?: string;
        name?: string;
        kind?: string;
        status?: string;
        channel?: string;
        title?: string;
        body?: string;
        createdAt?: string;
        created_at?: string;
      };
      const id = Number(item.id);
      const title = String(item.title || "").trim();
      const body = String(item.body || "").trim();
      if (!Number.isFinite(id) || !title || !body) return null;
      return {
        id,
        discordId: String(item.discordId || item.discord_id || ""),
        name: String(item.name || "").trim() || "Konto",
        kind: normalizeKind(String(item.kind || "bug")),
        status: normalizeStatus(String(item.status || "open")),
        channel: normalizeChannel(String(item.channel || "other")),
        title,
        body,
        createdAt: String(item.createdAt || item.created_at || ""),
      };
    })
    .filter((row): row is FeedbackItem => Boolean(row));
}

function statusRank(status: FeedbackStatus) {
  if (status === "deleted") return 2;
  if (status === "done") return 1;
  return 0;
}

function uniqueItems(rows: FeedbackItem[]): FeedbackItem[] {
  const seenId = new Set<number>();
  const byKey = new Map<string, FeedbackItem>();
  const order: string[] = [];
  for (const item of rows) {
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

function isDeveloperId(discordId: string) {
  return loadTesters().some((row) => row.id === discordId && /dev/i.test(row.role));
}

export async function listFeedback(discordId: string): Promise<FeedbackList> {
  const id = discordId.replace(/\D/g, "");
  if (!id) return { ok: false, developer: false, items: [], error: "login" };
  const payload = await feedbackRequest({ action: "feedbackList", discordId: id });
  if (!payload || typeof payload !== "object") {
    return { ok: false, developer: isDeveloperId(id), items: [], error: "network" };
  }
  const data = payload as { ok?: unknown; error?: string; developer?: unknown };
  return {
    ok: data.ok === true,
    developer: Boolean(data.developer) || isDeveloperId(id),
    items: uniqueItems(parseItems(payload)),
    error: typeof data.error === "string" ? data.error : data.ok === true ? undefined : "server",
  };
}

export async function createFeedback(input: {
  discordId: string;
  name: string;
  kind: string;
  channel: string;
  title: string;
  body: string;
}): Promise<FeedbackList & { created?: boolean }> {
  const discordId = input.discordId.replace(/\D/g, "");
  if (!discordId) return { ok: false, developer: false, items: [], error: "login" };
  const title = input.title.trim().slice(0, 191);
  const body = input.body.trim().slice(0, 4000);
  const channel = normalizeChannel(input.channel);
  if (title.length < 3 || body.length < 3) {
    return { ok: false, developer: isDeveloperId(discordId), items: [], error: "invalid" };
  }
  const payload = await feedbackRequest({
    action: "feedbackCreate",
    discordId,
    name: input.name.trim().slice(0, 191),
    kind: normalizeKind(input.kind),
    channel,
    title,
    body,
  });
  if (!payload || typeof payload !== "object" || (payload as { ok?: unknown }).ok !== true) {
    const listed = await listFeedback(discordId);
    return { ...listed, ok: false, created: false, error: "server" };
  }
  const listed = await listFeedback(discordId);
  return { ...listed, ok: true, created: true };
}

export async function updateFeedback(input: {
  discordId: string;
  id: number;
  status: string;
}): Promise<FeedbackList> {
  const discordId = input.discordId.replace(/\D/g, "");
  if (!discordId) return { ok: false, developer: false, items: [], error: "login" };
  if (!isDeveloperId(discordId)) {
    const listed = await listFeedback(discordId);
    return { ...listed, ok: false, error: "forbidden" };
  }
  const payload = await feedbackRequest({
    action: "feedbackUpdate",
    discordId,
    id: input.id,
    status: normalizeStatus(input.status),
  });
  if (!payload || typeof payload !== "object" || (payload as { ok?: unknown }).ok !== true) {
    const listed = await listFeedback(discordId);
    return { ...listed, ok: false, error: "server" };
  }
  return listFeedback(discordId);
}
