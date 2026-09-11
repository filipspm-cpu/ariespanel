import fs from "fs";
import path from "path";
import { app, BrowserWindow, nativeImage, screen } from "electron";

function characterPath() {
  return [
    path.join(process.resourcesPath, "updateCharacter.png"),
    path.join(app.getAppPath(), "build", "updateCharacter.png"),
    path.join(__dirname, "..", "build", "updateCharacter.png"),
  ].find((file) => fs.existsSync(file));
}

function fileUrl(file: string) {
  return "file:///" + file.replace(/\\/g, "/");
}

function html(version: string, portrait: string) {
  const figure = portrait
    ? `<img class="char" src="${portrait}" alt="" draggable="false" />`
    : "";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Aktualizacja ARIES</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; color: #f4f4f5; font-family: Inter, Segoe UI, system-ui, sans-serif; overflow: hidden; }
    .wrap {
      box-sizing: border-box;
      height: 100%;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 0 10px 8px 0;
    }
    .char {
      height: 100%;
      width: auto;
      max-width: 46%;
      object-fit: contain;
      object-position: left bottom;
      pointer-events: none;
      user-select: none;
    }
    .bar {
      flex: 1;
      box-sizing: border-box;
      height: 64px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 0 16px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1);
      background: linear-gradient(180deg, #121212, #050505);
    }
    .label {
      flex-shrink: 0;
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #a1a1aa;
    }
    .ver { flex-shrink: 0; font-size: 13px; font-weight: 600; color: #fff; }
    .track { flex: 1; height: 8px; border-radius: 999px; background: #1a1a1a; overflow: hidden; }
    .fill { height: 100%; width: 0%; background: #fff; border-radius: 999px; transition: width .18s ease; }
    .meta { flex-shrink: 0; text-align: right; font-size: 12px; color: #a1a1aa; min-width: 168px; }
    .pct { color: #fff; font-weight: 600; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    ${figure}
    <div class="bar">
      <div class="label">Aktualizacja</div>
      <div class="ver" id="ver">v${version}</div>
      <div class="track"><div class="fill" id="fill"></div></div>
      <div class="meta">
        <span class="pct" id="pct">0%</span>
        <span id="detail">0 MB / —</span>
      </div>
    </div>
  </div>
  <script>
    window.renderProgress = function (payload) {
      var p = Math.max(0, Math.min(100, Math.round(payload.percent || 0)));
      document.getElementById("fill").style.width = p + "%";
      document.getElementById("pct").textContent = p + "%";
      document.getElementById("detail").textContent = payload.detail || "";
      if (payload.sub) document.getElementById("ver").textContent = payload.sub;
    };
  </script>
</body>
</html>`;
}

let progressWin: BrowserWindow | null = null;

export function openUpdateProgressWindow(version: string, icon: Electron.NativeImage) {
  if (progressWin && !progressWin.isDestroyed()) {
    progressWin.show();
    return progressWin;
  }
  const portrait = characterPath();
  const area = screen.getPrimaryDisplay().workArea;
  const width = Math.min(portrait ? 920 : 760, Math.max(480, area.width - 48));
  const height = portrait ? 210 : 64;
  const x = area.x + Math.round((area.width - width) / 2);
  const y = area.y + area.height - height - 12;
  const htmlPath = path.join(app.getPath("temp"), "aries-update-progress.html");
  fs.writeFileSync(htmlPath, html(version, portrait ? fileUrl(portrait) : ""), "utf8");
  progressWin = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    title: "Aktualizacja ARIES",
    icon: icon.isEmpty() ? nativeImage.createEmpty() : icon,
    webPreferences: { sandbox: false, contextIsolation: true },
  });
  progressWin.setMenuBarVisibility(false);
  progressWin.setAlwaysOnTop(true, "screen-saver");
  void progressWin.loadFile(htmlPath);
  progressWin.on("closed", () => {
    progressWin = null;
  });
  return progressWin;
}

export function setUpdateProgress(payload: { percent: number; detail: string; left: string; sub?: string }) {
  if (!progressWin || progressWin.isDestroyed()) return;
  const json = JSON.stringify({
    percent: payload.percent,
    detail: payload.left ? `${payload.detail} · ${payload.left}` : payload.detail,
    sub: payload.sub,
  });
  void progressWin.webContents.executeJavaScript(`window.renderProgress && window.renderProgress(${json})`);
}

export function closeUpdateProgressWindow() {
  if (progressWin && !progressWin.isDestroyed()) progressWin.close();
  progressWin = null;
}
