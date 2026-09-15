const GAME_TITLE_HINTS = ["majestic", "gta5", "gtav", "fivem", "ragemp", "altv", "playgtav", "grand theft auto"];

export function scoreGameWindow(w: { title: string; name: string; className?: string }): number {
  const exe = (w.name || "").toLowerCase();
  const title = (w.title || "").toLowerCase();
  const cls = (w.className || "").toLowerCase();
  let score = 0;

  if (cls === "grcwindow") score += 100;
  if (/^(gta5|gta5_enhanced)\.exe$/.test(exe)) score += 90;
  if (/gtaprocess\.exe$/.test(exe) || /^fivem_.*gta/i.test(exe)) score += 90;
  if (/ragemp/i.test(exe) && /game|gta/i.test(exe)) score += 85;
  if (/^altv/i.test(exe) && /game|client/i.test(exe)) score += 80;
  if (/^playgtav\.exe$/.test(exe)) score += 35;
  if (/^fivem\.exe$/.test(exe)) score += 25;
  if (/^ragemp\.exe$/.test(exe)) score += 30;
  if (/^altv\.exe$/.test(exe)) score += 25;

  if (/launcher|socialclub|rockstarsteam|easyanticheat|epicgames|steamwebhelper|crashpad/.test(exe)) score -= 60;
  if (/(launcher|loader|updater|installer)/i.test(title)) score -= 45;
  if (/grand theft auto/i.test(title)) score += 50;
  if (GAME_TITLE_HINTS.some((hint) => title.includes(hint))) score += 20;
  if (/gta|roleplay/i.test(title)) score += 10;
  if (/majestic/i.test(title) && cls === "grcwindow") score += 25;

  return score;
}

export function pickGameWindow<T extends { title: string; name: string; className?: string }>(windows: T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const win of windows) {
    const score = scoreGameWindow(win);
    if (score > bestScore) {
      bestScore = score;
      best = win;
    }
  }
  return bestScore >= 10 ? best : null;
}
