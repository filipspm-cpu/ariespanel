export type DiscordAccountCard = {
  name: string;
  avatarUrl: string;
};

const API_KEY = "aries-accounts-v1";
const API_URLS = [
  "https://host425499.lh.pl/accounts.php",
  "https://host425499.lh.pl/aries/accounts.php",
  "https://s425499.lh.pl/accounts.php",
];

function cardName(profile: { globalName?: string; username?: string; name?: string }) {
  return (profile.globalName || profile.username || profile.name || "Konto").trim() || "Konto";
}

function parseCards(payload: unknown): DiscordAccountCard[] | null {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { accounts?: unknown }).accounts)
      ? (payload as { accounts: unknown[] }).accounts
      : null;
  if (!rows) return null;
  return rows
    .map((row) => {
      const item = row as { name?: string; avatarUrl?: string; avatar_url?: string };
      const name = String(item.name || "").trim();
      if (!name) return null;
      return { name, avatarUrl: String(item.avatarUrl || item.avatar_url || "") };
    })
    .filter((row): row is DiscordAccountCard => Boolean(row));
}

async function apiRequest(method: "GET" | "POST", body?: unknown): Promise<unknown | null> {
  for (const url of API_URLS) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Aries-Key": API_KEY,
          "User-Agent": "ARIES",
        },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      /* next */
    }
  }
  return null;
}

export async function recordDiscordAccount(profile: {
  id?: string;
  username?: string;
  globalName?: string;
  avatarUrl?: string;
}): Promise<void> {
  const id = String(profile.id || "").replace(/\D/g, "");
  const name = cardName(profile).slice(0, 191);
  const avatarUrl = String(profile.avatarUrl || "").slice(0, 512);
  if (!id || !name) return;
  await apiRequest("POST", { id, name, avatarUrl });
}

export async function listDiscordAccounts(): Promise<DiscordAccountCard[]> {
  const remote = await apiRequest("GET");
  return parseCards(remote) ?? [];
}
