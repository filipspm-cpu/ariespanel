const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const releaseDir = path.join(root, "release");
const updateDir = path.join(root, "upd");
const latestSource = path.join(releaseDir, "latest.yml");
const updateDirs = [updateDir, path.join(root, "strona", "upd")];

if (!fs.existsSync(latestSource)) {
  throw new Error(`Missing update metadata: ${latestSource}`);
}
const latest = fs.readFileSync(latestSource);
for (const dir of updateDirs) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "latest.yml"), latest);
  fs.writeFileSync(path.join(dir, "beta.yml"), latest);
}

const metadata = latest.toString("utf8");
const installerMatch = metadata.match(/^path:\s*(\S+\.exe)\s*$/m);
if (installerMatch) {
  const installerName = installerMatch[1];
  const installerSource = path.join(releaseDir, installerName);
  if (!fs.existsSync(installerSource)) {
    throw new Error(`Missing installer referenced by latest.yml: ${installerSource}`);
  }
  for (const dir of updateDirs) {
    fs.copyFileSync(installerSource, path.join(dir, installerName));
    console.log(`Installer synced: ${path.relative(root, path.join(dir, installerName))}`);
  }
}

for (const dir of updateDirs) {
  console.log(`Update metadata synced to ${path.relative(root, dir)}`);
}
