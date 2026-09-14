const API_KEY = "aries-accounts-v1";
const API_URLS = [
  "https://filipekweb.pl/aries/accounts.php",
  "https://www.filipekweb.pl/aries/accounts.php",
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

export async function apiRequest(method: "GET" | "POST", body?: unknown): Promise<unknown | null> {
  const attempts = API_URLS.map(async (base) => {
    const res = await withTimeout(
      fetch(withKey(base), {
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
    if (!res.ok) throw new Error(String(res.status));
    const text = (await res.text()).trim();
    if (!text) throw new Error("empty");
    return JSON.parse(text) as unknown;
  });
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}
