const API_KEY = "aries-accounts-v1";
const API_URLS = [
  "https://filipekweb.pl/aries/accounts.php",
  "https://www.filipekweb.pl/aries/accounts.php",
];
const FEEDBACK_URLS = [
  "https://filipekweb.pl/aries/feedback.php",
  "https://www.filipekweb.pl/aries/feedback.php",
];

function withKey(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(API_KEY)}&k=${encodeURIComponent(API_KEY)}`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function looksLikePhpSource(text: string) {
  const head = text.slice(0, 400);
  if (/^(<\?php|\?php)/i.test(head)) return true;
  if (/function_exists\s*\(\s*["']ob_start["']\s*\)/.test(head)) return true;
  if (/mysqli_report\s*\(/.test(head) && /error_reporting\s*\(/.test(head)) return true;
  return false;
}

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("invalid json");
  }
}

async function requestOne(url: string, method: "GET" | "POST", body?: unknown): Promise<unknown> {
  const res = await withTimeout(
    fetch(withKey(url), {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Aries-Key": API_KEY,
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
      },
      body: method === "POST" ? JSON.stringify({ ...(body as object), key: API_KEY }) : undefined,
    }),
    12000,
  );
  const text = (await res.text()).trim();
  if (!text) throw new Error(res.ok ? "empty" : String(res.status));
  if (looksLikePhpSource(text)) throw new Error("phpfile");
  try {
    return parseJsonLoose(text);
  } catch {
    if (!res.ok) throw new Error(String(res.status));
    throw new Error("invalid json");
  }
}

export type ApiFailure = {
  code: string;
  hint: string;
  url: string;
};

let lastFailure: ApiFailure | null = null;

export function lastApiError() {
  return lastFailure?.code || "";
}

export function lastApiFailure() {
  return lastFailure;
}

export function classifyApiError(err: unknown, url: string): ApiFailure {
  const raw = err instanceof Error ? err.message : String(err || "network");
  const extra = err instanceof Error && err.cause ? ` ${String(err.cause)}` : "";
  const lower = `${raw} ${extra}`.toLowerCase();
  if (raw === "phpfile" || /^(<\?php|\?php)/i.test(raw)) {
    return {
      code: "phpfile",
      hint: "Hosting nie uruchamia PHP — oddaje źródło pliku. Wgraj accounts.php z tego repo (rewards.php na serwerze jest popsute).",
      url,
    };
  }
  if (raw === "timeout" || lower.includes("etimedout") || lower.includes("timeout")) {
    return { code: "timeout", hint: "Serwer nie odpowiedział w 12 sekund (timeout).", url };
  }
  if (raw === "empty") {
    return { code: "empty", hint: "Serwer oddał pustą odpowiedź.", url };
  }
  if (raw === "invalid json") {
    return { code: "json", hint: "Serwer oddał HTML lub tekst zamiast JSON.", url };
  }
  if (/^\d+$/.test(raw.trim())) {
    return { code: "http", hint: `Serwer zwrócił HTTP ${raw}.`, url };
  }
  if (lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    return { code: "network", hint: "Nie znaleziono hosta (DNS).", url };
  }
  if (lower.includes("econnrefused")) {
    return { code: "network", hint: "Serwer odrzucił połączenie.", url };
  }
  if (lower.includes("econnreset") || lower.includes("socket")) {
    return { code: "network", hint: "Połączenie z serwerem się zerwało.", url };
  }
  if (lower.includes("cert") || lower.includes("ssl") || lower.includes("tls")) {
    return { code: "network", hint: "Błąd certyfikatu SSL.", url };
  }
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("offline")) {
    return { code: "network", hint: "Brak połączenia z serwerem (sieć).", url };
  }
  return { code: "network", hint: `Błąd sieci: ${raw.slice(0, 180)}`, url };
}

export async function apiRequestUrls(
  urls: string[],
  method: "GET" | "POST",
  body?: unknown,
  accept?: (payload: unknown) => boolean,
): Promise<unknown | null> {
  lastFailure = null;
  for (const base of urls) {
    try {
      const payload = await requestOne(base, method, body);
      lastFailure = null;
      if (!accept || accept(payload)) return payload;
    } catch (err) {
      lastFailure = classifyApiError(err, base);
    }
  }
  return null;
}

export async function apiRequest(method: "GET" | "POST", body?: unknown): Promise<unknown | null> {
  return apiRequestUrls(API_URLS, method, body);
}

export async function feedbackRequest(body: unknown): Promise<unknown | null> {
  const action =
    body && typeof body === "object" ? String((body as { action?: string }).action || "") : "";
  const dedicated = await apiRequestUrls(FEEDBACK_URLS, "POST", body);
  if (dedicated && typeof dedicated === "object" && (dedicated as { ok?: unknown }).ok === true) {
    return dedicated;
  }
  if (action === "feedbackCreate" && dedicated && typeof dedicated === "object") {
    return dedicated;
  }
  return apiRequest("POST", body);
}
