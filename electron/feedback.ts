import { feedbackRequest } from "./accountsApi";
import { loadTesters } from "./testers";

export type FeedbackKind = "bug" | "suggestion";

export type FeedbackItem = {
  id: number;
  discordId: string;
  name: string;
  kind: FeedbackKind;
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
        title,
        body,
        createdAt: String(item.createdAt || item.created_at || ""),
      };
    })
    .filter((row): row is FeedbackItem => Boolean(row));
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
    items: parseItems(payload),
    error: typeof data.error === "string" ? data.error : data.ok === true ? undefined : "server",
  };
}

export async function createFeedback(input: {
  discordId: string;
  name: string;
  kind: string;
  title: string;
  body: string;
}): Promise<FeedbackList & { created?: boolean }> {
  const discordId = input.discordId.replace(/\D/g, "");
  if (!discordId) return { ok: false, developer: false, items: [], error: "login" };
  const title = input.title.trim().slice(0, 191);
  const body = input.body.trim().slice(0, 4000);
  if (title.length < 3 || body.length < 3) {
    return { ok: false, developer: isDeveloperId(discordId), items: [], error: "invalid" };
  }
  const payload = await feedbackRequest({
    action: "feedbackCreate",
    discordId,
    name: input.name.trim().slice(0, 191),
    kind: normalizeKind(input.kind),
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
