import { BrowserWindow, session } from "electron";

const cache = new Map<string, { text: string; at: number }>();
const TTL_MS = 30 * 60 * 1000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchForumThreadText(url: string) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.text;

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      session: session.fromPartition("persist:majestic-forum"),
      sandbox: true,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  try {
    await win.loadURL(url, { userAgent: UA });
    const deadline = Date.now() + 18000;
    while (Date.now() < deadline) {
      if (win.isDestroyed()) break;
      const text = (await win.webContents.executeJavaScript(`(() => {
        const el = document.querySelector(".message-body .bbWrapper, .message-content .bbWrapper, article .bbWrapper");
        const raw = el && el.innerText ? String(el.innerText).trim() : "";
        return raw.length > 80 ? raw : "";
      })()`)) as string;
      if (text) {
        cache.set(url, { text, at: Date.now() });
        return text;
      }
      await sleep(400);
    }
    throw new Error("Forum nie oddało treści (ochrona strony). Spróbuj jeszcze raz.");
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
