<?php
define("ARIES_OK", 1);
require __DIR__ . "/aries-latest.php";
if (aries_want_download()) {
  aries_send_installer();
}
header_remove("Content-Disposition");
header("Content-Type: text/html; charset=utf-8");
header("Cache-Control: no-store");
header("X-Content-Type-Options: nosniff");

$latest = aries_latest_release();
$version = $latest && !empty($latest["version"]) ? $latest["version"] : "";
$sizeMb = $latest && !empty($latest["size"]) ? number_format($latest["size"] / 1048576, 0, ",", " ") : "";
$verLabel = $version !== "" ? "v" . htmlspecialchars($version, ENT_QUOTES, "UTF-8") : "najnowsza wersja";
$sizeLabel = $sizeMb !== "" ? $sizeMb . " MB" : "Windows";
$fileName = $latest && !empty($latest["name"]) ? htmlspecialchars($latest["name"], ENT_QUOTES, "UTF-8") : "ARIES-Setup.exe";
$adminCount = 0;
$accountsRaw = aries_http_get("https://filipekweb.pl/aries/accounts.php?token=aries-accounts-v1&k=aries-accounts-v1", 4);
$accountsPayload = json_decode($accountsRaw, true);
if (is_array($accountsPayload) && isset($accountsPayload["accounts"]) && is_array($accountsPayload["accounts"])) {
  $accountIds = array();
  foreach ($accountsPayload["accounts"] as $account) {
    if (!is_array($account)) continue;
    $id = trim((string) ($account["id"] ?? $account["discordId"] ?? $account["discord_id"] ?? ""));
    if ($id !== "") $accountIds[$id] = true;
  }
  $adminCount = count($accountIds);
}
$adminCountLabel = number_format($adminCount, 0, ",", " ");
?>
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ARIES - centrum dowodzenia dla administracji GTA RP</title>
  <meta name="description" content="ARIES to panel administracji GTA RP na Windows. Makra, reporty, nakładka HUD, statystyki i automatyczne aktualizacje w jednym miejscu." />
  <meta property="og:title" content="ARIES - panel administracji GTA RP" />
  <meta property="og:description" content="Mniej klikania. Więcej kontroli. Pobierz ARIES na Windows." />
  <meta property="og:image" content="aries-screen-home.jpg" />
  <meta property="og:type" content="website" />
  <link rel="icon" href="aries-mark.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: dark; --ink: #f5f5f4; --muted: #a1a1aa; --soft: #71717a; --line: rgba(255,255,255,.12); --panel: #101011; --accent: #ef315f; --cyan: #64d7d2; }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; min-width: 320px; background: #080809; color: var(--ink); font-family: "DM Sans", "Segoe UI", sans-serif; }
    a { color: inherit; }
    .shell { overflow: hidden; }
    .container { width: min(1160px, calc(100% - 40px)); margin: 0 auto; }
    .topbar { position: absolute; z-index: 3; top: 0; left: 0; right: 0; border-bottom: 1px solid rgba(255,255,255,.13); background: rgba(8,8,9,.66); backdrop-filter: blur(14px); }
    .topbar-inner { display: flex; align-items: center; justify-content: space-between; min-height: 76px; }
    .brand { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; }
    .brand img { width: 34px; height: 34px; object-fit: contain; }
    .brand-name { font: 700 17px/1 "Space Grotesk", sans-serif; letter-spacing: .19em; }
    .brand-kicker { margin-top: 4px; color: var(--soft); font-size: 10px; letter-spacing: .17em; text-transform: uppercase; }
    .nav { display: flex; align-items: center; gap: 27px; color: #d4d4d8; font-size: 13px; }
    .nav a { text-decoration: none; }
    .nav a:hover { color: #fff; }
    .nav .nav-cta { padding: 10px 15px; border: 1px solid rgba(255,255,255,.22); border-radius: 6px; color: #fff; }
    .nav .nav-cta:hover { border-color: var(--accent); color: #fff; }
    .hero { position: relative; min-height: 720px; display: flex; align-items: flex-end; padding: 150px 0 94px; isolation: isolate; }
    .hero-media { position: absolute; z-index: -2; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 63% center; filter: saturate(.9) contrast(1.08); }
    .hero::after { content: ""; position: absolute; z-index: -1; inset: 0; background: rgba(7,7,8,.73); }
    .hero-content { max-width: 680px; }
    .eyebrow { display: inline-flex; align-items: center; gap: 9px; margin-bottom: 20px; color: #f0a2b6; font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
    .eyebrow::before { content: ""; width: 28px; height: 2px; background: var(--accent); }
    h1 { max-width: 710px; margin: 0; font: 700 clamp(46px, 7vw, 86px)/.96 "Space Grotesk", sans-serif; letter-spacing: -.055em; }
    h1 span { color: var(--accent); }
    .hero-copy { max-width: 590px; margin: 25px 0 0; color: #d4d4d8; font-size: clamp(17px, 2vw, 21px); line-height: 1.5; }
    .hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 31px; }
    .button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 50px; padding: 0 19px; border-radius: 6px; font-size: 14px; font-weight: 700; text-decoration: none; transition: transform .2s ease, background .2s ease, border-color .2s ease; }
    .button:hover { transform: translateY(-2px); }
    .button-primary { background: var(--accent); color: #fff; box-shadow: 0 12px 28px rgba(239,49,95,.28); }
    .button-primary:hover { background: #f44d76; }
    .button-ghost { border: 1px solid rgba(255,255,255,.23); background: rgba(8,8,9,.35); color: #fff; }
    .button-ghost:hover { border-color: var(--cyan); }
    .release-note { margin: 13px 0 0; color: #a1a1aa; font-size: 12px; }
    .release-note strong { color: #e4e4e7; font-weight: 600; }
    .signal-row { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 44px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.17); color: #d4d4d8; font-size: 12px; }
    .signal { display: inline-flex; align-items: center; gap: 8px; }
    .signal i { display: block; width: 7px; height: 7px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 12px rgba(100,215,210,.75); }
    .trust-proof { display: flex; align-items: baseline; gap: 16px; margin-top: 25px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.1); }
    .trust-proof-label { display: inline-flex; align-items: center; gap: 8px; color: #a1a1aa; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }
    .trust-proof-label i { display: block; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 13px rgba(239,49,95,.8); }
    .trust-proof-copy { color: #e4e4e7; font-size: 15px; line-height: 1.35; }
    .trust-proof-copy strong { display: inline-block; margin: 0 3px; color: var(--cyan); font: 700 28px/1 "Space Grotesk", sans-serif; letter-spacing: 0; vertical-align: -3px; }
    .section { padding: 94px 0; }
    .section-dark { background: #0b0b0c; }
    .section-head { display: flex; align-items: end; justify-content: space-between; gap: 35px; margin-bottom: 34px; }
    .section-kicker { margin: 0 0 12px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
    h2 { max-width: 600px; margin: 0; font: 600 clamp(30px, 4.5vw, 54px)/1.03 "Space Grotesk", sans-serif; letter-spacing: -.045em; }
    .section-intro { max-width: 340px; margin: 0; color: var(--muted); font-size: 15px; line-height: 1.55; }
    .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; overflow: hidden; border: 1px solid var(--line); background: var(--line); }
    .feature { min-height: 190px; padding: 25px; background: var(--panel); }
    .feature-number { color: var(--cyan); font: 600 13px/1 "Space Grotesk", sans-serif; }
    .feature h3 { margin: 31px 0 9px; font: 600 19px/1.15 "Space Grotesk", sans-serif; }
    .feature p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.55; }
    .gallery { display: grid; grid-template-columns: 1.16fr .84fr; gap: 18px; }
    .gallery-main, .gallery-side figure { overflow: hidden; margin: 0; border: 1px solid var(--line); background: #111113; }
    .gallery-main img, .gallery-side img { display: block; width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; transition: transform .35s ease, filter .35s ease; }
    .gallery-main:hover img, .gallery-side figure:hover img { transform: scale(1.025); filter: brightness(1.08); }
    .gallery-main { min-height: 430px; }
    .gallery-side { display: grid; gap: 18px; }
    .gallery-side figure { min-height: 206px; }
    .lightbox { position: fixed; z-index: 10; inset: 0; display: grid; place-items: center; padding: 30px; background: rgba(4,4,5,.94); opacity: 0; pointer-events: none; transition: opacity .2s ease; }
    .lightbox.is-open { opacity: 1; pointer-events: auto; }
    .lightbox img { max-width: min(1320px, 96vw); max-height: 88vh; object-fit: contain; border: 1px solid rgba(255,255,255,.18); box-shadow: 0 28px 90px rgba(0,0,0,.6); }
    .lightbox-close { position: absolute; top: 20px; right: 24px; width: 42px; height: 42px; border: 1px solid rgba(255,255,255,.22); border-radius: 50%; background: rgba(17,17,19,.8); color: #fff; font-size: 27px; line-height: 1; cursor: pointer; }
    .lightbox-close:hover { border-color: var(--accent); color: #f7a1b6; }
    .lightbox-nav { position: absolute; top: 50%; width: 46px; height: 46px; margin-top: -23px; border: 1px solid rgba(255,255,255,.22); border-radius: 50%; background: rgba(17,17,19,.82); color: #fff; font-size: 32px; line-height: 1; cursor: pointer; }
    .lightbox-nav:hover { border-color: var(--cyan); color: var(--cyan); }
    .lightbox-prev { left: 24px; }
    .lightbox-next { right: 24px; }
    .download-band { padding: 70px 0; background: var(--accent); color: #fff; }
    .download-inner { display: flex; align-items: center; justify-content: space-between; gap: 28px; }
    .download-band h2 { max-width: 650px; }
    .download-band .button { background: #111113; color: #fff; box-shadow: none; }
    .download-band .button:hover { background: #26262a; }
    .download-meta { margin: 13px 0 0; color: rgba(255,255,255,.78); font-size: 13px; }
    footer { padding: 28px 0 36px; color: var(--soft); font-size: 12px; }
    .footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
    footer a { color: #d4d4d8; text-decoration: none; }
    footer a:hover { color: #fff; }
    @media (max-width: 760px) {
      .container { width: min(100% - 28px, 1160px); }
      .topbar-inner { min-height: 66px; }
      .nav a:not(.nav-cta) { display: none; }
      .hero { min-height: 690px; padding: 130px 0 62px; }
      .hero-media { object-position: 57% center; }
      .hero::after { background: rgba(7,7,8,.8); }
      .section { padding: 68px 0; }
      .section-head, .download-inner { display: block; }
      .section-intro { margin-top: 18px; }
      .trust-proof { display: block; }
      .trust-proof-copy { margin-top: 8px; }
      .feature-grid { grid-template-columns: 1fr; }
      .feature { min-height: 0; }
      .gallery { grid-template-columns: 1fr; }
      .gallery-main { min-height: 260px; }
      .gallery-side { grid-template-columns: 1fr 1fr; }
      .gallery-side figure { min-height: 130px; }
      .download-band .button { margin-top: 24px; }
      .footer-inner { align-items: flex-start; flex-direction: column; }
      .lightbox { padding: 18px 54px; }
      .lightbox-nav { width: 38px; height: 38px; margin-top: -19px; font-size: 27px; }
      .lightbox-prev { left: 9px; }
      .lightbox-next { right: 9px; }
      .lightbox-close { top: 11px; right: 11px; }
    }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { transition: none !important; } }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <div class="container topbar-inner">
        <a class="brand" href="./" aria-label="ARIES - strona główna">
          <img src="aries-mark.png" alt="" />
          <div><div class="brand-name">ARIES</div><div class="brand-kicker">panel administracji</div></div>
        </a>
        <nav class="nav" aria-label="Główna nawigacja">
          <a href="#funkcje">Funkcje</a>
          <a href="#podglad">Podgląd</a>
          <a href="polityka-prywatnosci.php">Prywatność</a>
          <a class="nav-cta" href="download.php" download="ARIES-Setup.exe">Pobierz</a>
        </nav>
      </div>
    </div>

    <main>
      <section class="hero">
        <img class="hero-media" src="aries-screen-home.jpg" alt="Interfejs panelu ARIES" />
        <div class="container hero-content">
          <div class="eyebrow">Centrum dowodzenia dla administracji GTA RP</div>
          <h1>Mniej klikania.<br /><span>Więcej kontroli.</span></h1>
          <p class="hero-copy">ARIES zbiera narzędzia, których potrzebujesz podczas służby, w jednym szybkim panelu. Makra, reporty, nakładka i statystyki są zawsze pod ręką.</p>
          <div class="hero-actions">
            <a class="button button-primary" href="download.php" download="ARIES-Setup.exe">Pobierz na Windows <span aria-hidden="true">→</span></a>
            <a class="button button-ghost" href="#funkcje">Zobacz możliwości</a>
          </div>
          <p class="release-note"><strong><?php echo $verLabel; ?></strong> · <?php echo htmlspecialchars($sizeLabel, ENT_QUOTES, "UTF-8"); ?> · Windows 10/11 · <?php echo $fileName; ?></p>
          <div class="trust-proof" aria-label="Liczba administratorow korzystajacych z ARIES">
            <div class="trust-proof-label"><i></i> Spo&#322;eczno&#347;&#263; ARIES</div>
            <div class="trust-proof-copy">Zaufa&#322;o nam ponad <strong><?php echo htmlspecialchars($adminCountLabel, ENT_QUOTES, "UTF-8"); ?></strong> administrator&#243;w</div>
          </div>
          <div class="signal-row" aria-label="Informacje o aplikacji">
            <span class="signal"><i></i> Aktualizacje w aplikacji</span>
            <span class="signal"><i></i> Zbudowany dla zespołów</span>
          </div>
        </div>
      </section>

      <section class="section section-dark" id="funkcje">
        <div class="container">
          <div class="section-head">
            <div><p class="section-kicker">Jedno narzędzie</p><h2>Twój dyżur. Twój rytm pracy.</h2></div>
            <p class="section-intro">ARIES porządkuje powtarzalne zadania i daje zespołowi wspólny widok na to, co dzieje się na serwerze.</p>
          </div>
          <div class="feature-grid">
            <article class="feature"><div class="feature-number">01</div><h3>Makra i komendy</h3><p>Zapisuj gotowe odpowiedzi i wywołuj je wtedy, gdy liczy się każda sekunda.</p></article>
            <article class="feature"><div class="feature-number">02</div><h3>Nakładka HUD</h3><p>Reporty, zegar, Spotify i powiadomienia bez przełączania się między oknami.</p></article>
            <article class="feature"><div class="feature-number">03</div><h3>Statystyki służby</h3><p>Śledź reporty i eventy z podziałem na dzień, tydzień i miesiąc.</p></article>
            <article class="feature"><div class="feature-number">04</div><h3>Osiągnięcia i kody</h3><p>Motywuj zespół rankingiem, nagrodami i aktualnymi kodami promocyjnymi.</p></article>
            <article class="feature"><div class="feature-number">05</div><h3>Wspólny panel</h3><p>Discordowe logowanie pomaga rozpoznać konto i utrzymać porządek w ekipie.</p></article>
            <article class="feature"><div class="feature-number">06</div><h3>Automatyczne aktualizacje</h3><p>Nowe wydania pojawiają się w aplikacji, bez szukania plików po repozytorium.</p></article>
          </div>
        </div>
      </section>

      <section class="section" id="podglad">
        <div class="container">
          <div class="section-head">
            <div><p class="section-kicker">Zobacz w akcji</p><h2>Interfejs, który nie przeszkadza w grze.</h2></div>
            <p class="section-intro">Czytelne widoki i szybki dostęp do najważniejszych informacji. Bez zbędnych ozdobników.</p>
          </div>
          <div class="gallery">
            <figure class="gallery-main"><img src="aries-screen-home.jpg" alt="Widok główny ARIES z reportami i serwerami" /></figure>
            <div class="gallery-side">
              <figure><img src="aries-screen-factions.png" alt="Frakcje w ARIES" /></figure>
              <figure><img src="aries-screen-achievements-new.png" alt="Osiągnięcia w ARIES" /></figure>
            </div>
          </div>
        </div>
      </section>

      <section class="download-band">
        <div class="container download-inner">
          <div><h2>Gotowy na spokojniejszą służbę?</h2><p class="download-meta">Pobierz instalator ARIES na Windows. <?php echo $verLabel; ?> · <?php echo htmlspecialchars($sizeLabel, ENT_QUOTES, "UTF-8"); ?></p></div>
          <a class="button" href="download.php" download="ARIES-Setup.exe">Pobierz ARIES <span aria-hidden="true">→</span></a>
        </div>
      </section>
    </main>

    <footer>
      <div class="container footer-inner"><div>© <?php echo date("Y"); ?> ARIES · filipekweb.pl</div><a href="polityka-prywatnosci.php">Polityka prywatności</a></div>
    </footer>
    <div class="lightbox" aria-hidden="true" role="dialog" aria-label="Powiększony zrzut ekranu">
      <button class="lightbox-close" type="button" aria-label="Zamknij powiększenie">×</button>
      <button class="lightbox-nav lightbox-prev" type="button" aria-label="Poprzedni ekran" title="Poprzedni ekran">‹</button>
      <img src="" alt="" />
      <button class="lightbox-nav lightbox-next" type="button" aria-label="Następny ekran" title="Następny ekran">›</button>
    </div>
  </div>
  <script>
    (function () {
      var lightbox = document.querySelector(".lightbox");
      var preview = lightbox && lightbox.querySelector("img");
      var close = lightbox && lightbox.querySelector(".lightbox-close");
      var previous = lightbox && lightbox.querySelector(".lightbox-prev");
      var next = lightbox && lightbox.querySelector(".lightbox-next");
      var galleryImages = Array.prototype.slice.call(document.querySelectorAll(".gallery img"));
      var active = 0;
      if (!lightbox || !preview) return;
      function show(index) {
        active = (index + galleryImages.length) % galleryImages.length;
        var image = galleryImages[active];
        preview.src = image.currentSrc || image.src;
        preview.alt = image.alt;
      }
      function hide() {
        lightbox.classList.remove("is-open");
        lightbox.setAttribute("aria-hidden", "true");
        preview.removeAttribute("src");
        document.body.style.overflow = "";
      }
      function open(index) {
        show(index);
        lightbox.classList.add("is-open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      }
      galleryImages.forEach(function (image, index) {
        image.addEventListener("click", function () {
          open(index);
        });
      });
      close.addEventListener("click", hide);
      previous.addEventListener("click", function () { show(active - 1); });
      next.addEventListener("click", function () { show(active + 1); });
      lightbox.addEventListener("click", function (event) { if (event.target === lightbox) hide(); });
      document.addEventListener("keydown", function (event) {
        if (!lightbox.classList.contains("is-open")) return;
        if (event.key === "Escape") hide();
        if (event.key === "ArrowLeft") show(active - 1);
        if (event.key === "ArrowRight") show(active + 1);
      });
    })();
  </script>
</body>
</html>
