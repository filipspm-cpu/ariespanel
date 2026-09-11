import fs from "fs";
import path from "path";
import { app } from "electron";

export type Tester = {
  name: string;
  discord: string;
  id: string;
  role: string;
};

function parseLine(line: string): Tester | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const parts = trimmed.split("|").map((p) => p.trim());
  if (parts.length < 4 || !parts[2]) return null;
  return { name: parts[0], discord: parts[1], id: parts[2], role: parts[3] };
}

function testersPath() {
  return [
    path.join(process.resourcesPath, "testers.txt"),
    path.join(app.getAppPath(), "src", "data", "testers.txt"),
    path.join(__dirname, "..", "src", "data", "testers.txt"),
    path.join(process.cwd(), "src", "data", "testers.txt"),
  ].find((file) => fs.existsSync(file));
}

export function loadTesters(): Tester[] {
  const file = testersPath();
  if (!file) return [];
  try {
    return fs
      .readFileSync(file, "utf-8")
      .split(/\r?\n/)
      .map(parseLine)
      .filter((row): row is Tester => Boolean(row));
  } catch {
    return [];
  }
}

export function isBetaTesterId(discordId: string | undefined) {
  if (!discordId) return false;
  return loadTesters().some((t) => t.id === discordId && /beta/i.test(t.role));
}
