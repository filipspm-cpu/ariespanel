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
      "- Craft",
      "- Większe przyciski Discord w Ustawieniach",
      "- Nowy awatar Fretki na stronie Autorzy",
      "- Pozostałe poprawki panelu i aktualizacji",
      "",
      "Zwykli użytkownicy powinni brać wydanie stabilne.",
    ].join("\n")
  : [
      "## Stabilna",
      "",
      "- Niższe zużycie CPU/RAM: wolniejsze pętle makr i Spotify, lżejsza nakładka",
      "- Awatar Filipka: GIF kota przy laptopie",
      "- Usunięty zbędny opis aktualizacji w Ustawieniach systemu",
      "- Flaga Polski w belce zamiast emoji PL, z powiewaniem",
      "- Plik makr: długi tekst, [losowe], [licznik] i znaczniki zamiast jednej linii z |",
      "- Autorzy: Dorek (Logo); Dorek dodany jako beta tester",
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
