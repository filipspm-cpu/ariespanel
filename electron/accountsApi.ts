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
  try {
    return parseJsonLoose(text);
  } catch {
    if (!res.ok) throw new Error(String(res.status));
    throw new Error("invalid json");
  }
}

export async function apiRequestUrls(
  urls: string[],
  method: "GET" | "POST",
  body?: unknown,
): Promise<unknown | null> {
  for (const base of urls) {
    try {
      return await requestOne(base, method, body);
    } catch {
      /* try next host */
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
