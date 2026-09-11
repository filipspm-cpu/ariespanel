const fs = require("fs");
const { execFileSync } = require("child_process");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const ver = pkg.version;
const isBeta = /-beta/i.test(ver);
const title = isBeta ? `ARIES ${ver} BETA` : `ARIES ${ver}`;
const notes = isBeta
  ? [
      "## BETA",
      "Wydanie dla beta testerów i developerów.",
      "",
      "- Forum (zasady Majestic w przeglądarce)",
      "- Craft (czerwony znaczek BETA w menu)",
      "- Pozostałe poprawki z tej linii",
      "",
      "Zwykli użytkownicy powinni brać wydanie stabilne, bez Crafta.",
    ].join("\n")
  : [
      "## Stabilna",
      "Wydanie dla zwykłych użytkowników.",
      "",
      "- Forum (zasady Majestic w przeglądarce)",
      "- Poprawki aktualizacji, makr i panelu",
      "- Craft jest ukryty (tylko beta testerzy)",
      "",
      "Beta testerzy na tym samym instalatorze widzą Craft z czerwonym znaczkiem BETA.",
    ].join("\n");

const tags = [`v${ver}`, ver];
let lastError = null;
for (const tag of tags) {
  try {
    const args = ["release", "edit", tag, "--title", title, "--notes", notes];
    if (isBeta) args.push("--prerelease");
    execFileSync("gh", args, { stdio: "inherit" });
    lastError = null;
    break;
  } catch (err) {
    lastError = err;
  }
}
if (lastError) throw lastError;
