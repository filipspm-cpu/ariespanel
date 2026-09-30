const fs = require("fs");
const path = require("path");

const dir = path.join(process.cwd(), "release");
const latest = path.join(dir, "latest.yml");
const beta = path.join(dir, "beta.yml");

if (!fs.existsSync(latest)) {
  console.log("sync-update: no latest.yml yet, skip");
  process.exit(0);
}

fs.copyFileSync(latest, beta);
console.log("sync-update: copied latest.yml -> beta.yml");
