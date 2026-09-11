import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { app } from "electron";

export function trustPublisherCert() {
  if (process.platform !== "win32") return;
  const cer = [
    path.join(process.resourcesPath, "aries-codesign.cer"),
    path.join(app.getAppPath(), "build", "aries-codesign.cer"),
    path.join(__dirname, "..", "build", "aries-codesign.cer"),
  ].find((file) => fs.existsSync(file));
  if (!cer) return;
  for (const store of ["Root", "TrustedPublisher"]) {
    spawnSync("certutil", ["-user", "-addstore", "-f", store, cer], {
      windowsHide: true,
      stdio: "ignore",
    });
  }
}
