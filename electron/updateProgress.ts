import { BrowserWindow, nativeImage } from "electron";

function html(version: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Aktualizacja ARIES</title>
  <style>
    html, body { margin: 0; height: 100%; background: #09090b; color: #f4f4f5; font-family: Segoe UI, Inter, sans-serif; }
    .wrap { box-sizing: border-box; height: 100%; padding: 28px 32px 24px; display: flex; flex-direction: column; }
    h1 { margin: 0; font-size: 18px; font-weight: 600; }
    .sub { margin-top: 8px; font-size: 13px; color: #a1a1aa; }
    .bar { margin-top: 28px; height: 10px; border-radius: 999px; background: #1c1c1f; overflow: hidden; }
    .fill { height: 100%; width: 0%; background: #8b5cf6; border-radius: 999px; transition: width .2s ease; }
    .row { margin-top: 14px; display: flex; justify-content: space-between; font-size: 13px; color: #a1a1aa; }
    .pct { font-size: 22px; font-weight: 600; color: #fff; letter-spacing: -0.03em; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Aktualizacja ARIES</h1>
    <div class="sub" id="sub">Pobieranie wersji ${version}…</div>
    <div class="bar"><div class="fill" id="fill"></div></div>
    <div class="row">
      <span class="pct" id="pct">0%</span>
      <span id="detail">0 MB / —</span>
    </div>
    <div class="row"><span id="left">Szacowanie czasu…</span></div>
  </div>
  <script>
    window.renderProgress = function (payload) {
      var p = Math.max(0, Math.min(100, Math.round(payload.percent || 0)));
      document.getElementById("fill").style.width = p + "%";
      document.getElementById("pct").textContent = p + "%";
      document.getElementById("detail").textContent = payload.detail || "";
      document.getElementById("left").textContent = payload.left || "";
      if (payload.sub) document.getElementById("sub").textContent = payload.sub;
    };
  </script>
</body>
</html>`;
}

let progressWin: BrowserWindow | null = null;

export function openUpdateProgressWindow(version: string, icon: Electron.NativeImage) {
  if (progressWin && !progressWin.isDestroyed()) {
    progressWin.focus();
    return progressWin;
  }
  progressWin = new BrowserWindow({
    width: 460,
    height: 280,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: "#09090b",
    title: "Aktualizacja ARIES",
    icon: icon.isEmpty() ? nativeImage.createEmpty() : icon,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  progressWin.setMenuBarVisibility(false);
  void progressWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html(version)));
  progressWin.on("closed", () => {
    progressWin = null;
  });
  return progressWin;
}

export function setUpdateProgress(payload: { percent: number; detail: string; left: string; sub?: string }) {
  if (!progressWin || progressWin.isDestroyed()) return;
  const json = JSON.stringify(payload);
  void progressWin.webContents.executeJavaScript(`window.renderProgress && window.renderProgress(${json})`);
}

export function closeUpdateProgressWindow() {
  if (progressWin && !progressWin.isDestroyed()) progressWin.close();
  progressWin = null;
}
