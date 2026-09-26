const NAMED: Record<string, number> = {
  SPACE: 0x20,
  ENTER: 0x0d,
  TAB: 0x09,
  ESC: 0x1b,
  ESCAPE: 0x1b,
  "MOUSE-LEFT": 0x01,
  "MOUSE-RIGHT": 0x02,
  "MOUSE-MIDDLE": 0x04,
};

export function virtualKeyFromName(name: string): number | null {
  const key = name.trim().toUpperCase();
  if (!key) return null;
  if (NAMED[key]) return NAMED[key];
  const fn = /^F(\d{1,2})$/.exec(key);
  if (fn) {
    const n = Number(fn[1]);
    if (n >= 1 && n <= 24) return 0x70 + n - 1;
  }
  if (key.length === 1) {
    const code = key.charCodeAt(0);
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90)) return code;
  }
  return null;
}
