const fs = require("fs");
const { execFileSync } = require("child_process");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const ver = pkg.version;
const isBeta = /-beta/i.test(ver);
const title = isBeta ? `ARIES ${ver} BETA` : `ARIES ${ver}`;
const notes = isBeta
  ? [
      "## BETA — testerzy i developerzy",
      "",
      "Pełne wydanie z Craftem i regulaminem w panelu.",
      "",
      "- Forum: zasady wklejone w aplikacji, bez otwierania linków",
      "- Craft (czerwony znaczek BETA w menu)",
      "- Większe przyciski Discord w Ustawieniach",
      "- Nowy awatar Fretki na stronie Autorzy",
      "- Pozostałe poprawki panelu i aktualizacji",
      "",
      "Zwykli użytkownicy powinni brać wydanie stabilne — bez Crafta.",
    ].join("\n")
  : [
      "## Stabilna",
      "",
      "- Forum: szukaj i asystent wskazuje konkretny punkt we wszystkich regulaminach",
      "- Regulamin 1:1, pogrubiane tylko nagłówki typu „Zasady ogólne”",
      "- Craft i Forum ze znaczkiem BETA — testerzy i developerzy",
      "",
      "Zwykłe konto nie widzi Forum ani Crafta.",
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
