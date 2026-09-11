import fs from "fs";
import path from "path";
import { app } from "electron";

export type UpdateNotice = {
  id: string;
  version: string;
  at: number;
  kind: "available" | "installed";
  read: boolean;
};

type FileShape = {
  lastSeenVersion: string;
  notices: UpdateNotice[];
};

function filePath() {
  return path.join(app.getPath("userData"), "aries-update-notices.json");
}

function empty(version: string): FileShape {
  return { lastSeenVersion: version, notices: [] };
}

function readFile(version: string): FileShape {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath(), "utf-8")) as Partial<FileShape>;
    return {
      lastSeenVersion: parsed.lastSeenVersion || version,
      notices: Array.isArray(parsed.notices) ? parsed.notices : [],
    };
  } catch {
    return empty(version);
  }
}

function writeFile(data: FileShape) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(data, null, 2), "utf-8");
}

export function listUpdateNotices(currentVersion: string): UpdateNotice[] {
  const data = readFile(currentVersion);
  if (data.lastSeenVersion !== currentVersion) {
    data.notices.unshift({
      id: `installed-${currentVersion}-${Date.now()}`,
      version: currentVersion,
      at: Date.now(),
      kind: "installed",
      read: false,
    });
    data.lastSeenVersion = currentVersion;
    data.notices = data.notices.slice(0, 40);
    writeFile(data);
  }
  return data.notices;
}

export function pushUpdateNotice(currentVersion: string, notice: Omit<UpdateNotice, "id" | "read">) {
  const data = readFile(currentVersion);
  const dup = data.notices.find(
    (n) => n.kind === notice.kind && n.version === notice.version && Date.now() - n.at < 24 * 60 * 60 * 1000,
  );
  if (dup) return data.notices;
  data.notices.unshift({
    ...notice,
    id: `${notice.kind}-${notice.version}-${Date.now()}`,
    read: false,
  });
  data.notices = data.notices.slice(0, 40);
  writeFile(data);
  return data.notices;
}

export function markUpdateNoticesRead(currentVersion: string): UpdateNotice[] {
  const data = readFile(currentVersion);
  data.notices = data.notices.map((n) => ({ ...n, read: true }));
  writeFile(data);
  return data.notices;
}
