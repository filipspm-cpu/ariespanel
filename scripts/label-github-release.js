const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const ver = pkg.version;
const isBeta = /-beta/i.test(ver);
const title = isBeta ? `ARIES ${ver} BETA` : `ARIES ${ver}`;

const emptyNotes = path.join(os.tmpdir(), "aries-empty-notes.md");
fs.writeFileSync(emptyNotes, "");

function gh(args) {
  execFileSync("gh", args, { stdio: "inherit" });
}

const tags = [`v${ver}`, ver];
let lastError = null;
for (const tag of tags) {
  try {
    const args = ["release", "edit", tag, "--title", title, "--notes-file", emptyNotes];
    if (isBeta) args.push("--prerelease");
    gh(args);
    lastError = null;
    break;
  } catch (err) {
    lastError = err;
  }
}
if (lastError) throw lastError;

try {
  const raw = execFileSync("gh", ["release", "list", "--limit", "50", "--json", "tagName"], { encoding: "utf8" });
  const list = JSON.parse(raw);
  for (const item of list) {
    const tag = item && item.tagName;
    if (!tag) continue;
    try {
      gh(["release", "edit", tag, "--notes-file", emptyNotes]);
    } catch {
      /* ignore older tags */
    }
  }
} catch {
  /* listing optional */
}

const publishedTag = tags.find((tag) => {
  try {
    execFileSync("gh", ["release", "view", tag], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
});
if (publishedTag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aries-release-"));
  gh(["release", "download", publishedTag, "-p", "latest.yml", "-D", dir]);
  const latest = fs.readFileSync(path.join(dir, "latest.yml"), "utf8");
  fs.writeFileSync(path.join(dir, "beta.yml"), latest);
  gh(["release", "upload", publishedTag, path.join(dir, "beta.yml"), "--clobber"]);
}
