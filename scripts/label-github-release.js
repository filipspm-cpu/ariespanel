const fs = require("fs");
const os = require("os");
const path = require("path");
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
      "- Aktualizacje znowu dochodzą do testerów i developerów (kanał latest + beta.yml)",
      "- Konta: IP i ostatnie logowanie, rangi beta nie znikają",
      "- GET accounts.php bez 403 w przeglądarce",
      "- Opcja „Chcę otrzymywać aktualizacje” (domyślnie włączona)",
      "- Czas w aplikacji, reporty i statystyki na nakładce zerują się codziennie o 00:00",
      "- Zakładka Konta (tylko developer): avatar, ranga, IP i logowanie",
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
  execFileSync("gh", ["release", "download", publishedTag, "-p", "latest.yml", "-D", dir], { stdio: "inherit" });
  const latest = fs.readFileSync(path.join(dir, "latest.yml"), "utf8");
  fs.writeFileSync(path.join(dir, "beta.yml"), latest);
  execFileSync("gh", ["release", "upload", publishedTag, path.join(dir, "beta.yml"), "--clobber"], { stdio: "inherit" });
}
