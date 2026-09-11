const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const pfx = path.join(__dirname, "..", "build", "aries-codesign.pfx");
const passwordFile = path.join(__dirname, "..", "build", "aries-codesign.password");
if (fs.existsSync(pfx)) {
  process.env.CSC_LINK = pfx;
  if (fs.existsSync(passwordFile)) {
    process.env.CSC_KEY_PASSWORD = fs.readFileSync(passwordFile, "utf8").trim();
  }
}

const args = process.argv.slice(2);
if (!args.length) process.exit(0);
const result = spawnSync(args[0], args.slice(1), { stdio: "inherit", env: process.env, shell: true });
process.exit(result.status ?? 1);
