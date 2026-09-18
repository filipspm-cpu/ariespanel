import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

export type PromoDevice = {
  id: string;
  hash: string;
  redeemed: boolean;
};

function filePath() {
  return path.join(app.getPath("userData"), "promo-device.json");
}

function hardwareHash() {
  const macs: string[] = [];
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (!net || net.internal) continue;
      const mac = String(net.mac || "").toLowerCase();
      if (mac && mac !== "00:00:00:00:00:00") macs.push(mac);
    }
  }
  macs.sort();
  let username = "user";
  try {
    username = os.userInfo().username || username;
  } catch {
    /* ignore */
  }
  return crypto.createHash("sha256").update([os.hostname(), username, ...macs].join("|")).digest("hex");
}

function isId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(value);
}

function writeDevice(device: PromoDevice) {
  fs.writeFileSync(
    filePath(),
    JSON.stringify({ id: device.id, redeemed: device.redeemed, at: Date.now() }),
    "utf8",
  );
}

export function loadPromoDevice(): PromoDevice {
  const hash = hardwareHash();
  try {
    const saved = JSON.parse(fs.readFileSync(filePath(), "utf8")) as { id?: string; redeemed?: boolean };
    if (isId(saved?.id)) {
      return { id: saved.id as string, hash, redeemed: Boolean(saved.redeemed) };
    }
  } catch {
    /* create */
  }
  const next: PromoDevice = { id: crypto.randomBytes(16).toString("hex"), hash, redeemed: false };
  writeDevice(next);
  return next;
}

export function markPromoDeviceRedeemed() {
  const device = loadPromoDevice();
  if (device.redeemed) return;
  writeDevice({ ...device, redeemed: true });
}
