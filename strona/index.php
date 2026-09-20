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
?>
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ARIES — pobierz panel administracji GTA RP</title>
  <meta name="description" content="Pobierz ARIES na Windows. Makra, nakładka HUD, reporty, osiągnięcia i kody. Najnowsza wersja schodzi z tej strony — bez otwierania GitHuba." />
  <meta property="og:title" content="ARIES — pobierz panel administracji GTA RP" />
  <meta property="og:description" content="Darmowy panel dla administracji GTA RP. Pobierz najnowszy installer na Windows z filipekweb.pl." />
  <meta property="og:image" content="https://filipekweb.pl/aries/aries-logo.png" />
  <meta property="og:url" content="https://filipekweb.pl/aries/" />
  <meta property="og:type" content="website" />
  <link rel="icon" href="aries-mark.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #050505; color: #f4f4f5; font-family: Inter, "Segoe UI", sans-serif; }
    a { color: inherit; }
    .wrap { position: relative; overflow: hidden; min-height: 100vh; }
    .glow, .glow2 {
      pointer-events: none;
      position: absolute;
    }
    .glow {
      inset: -18% 8% auto;
      height: 520px;
      background: radial-gradient(ellipse at 50% 0%, rgba(240, 45, 94, 0.28), transparent 62%);
      animation: glow-breathe 6.5s ease-in-out infinite;
    }
    .glow2 {
      right: -12%; top: 28%;
      width: 420px; height: 420px;
      background: radial-gradient(circle, rgba(240, 45, 94, 0.12), transparent 70%);
      animation: glow-drift 11s ease-in-out infinite;
    }
    header, main, footer { position: relative; z-index: 1; width: min(1160px, calc(100% - 32px)); margin: 0 auto; }
    header {
      display: flex; align-items: center; justify-content: space-between; padding: 22px 0;
      animation: fade-down 0.7s ease both;
    }
    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .brand img { width: 42px; height: 42px; }
    .brand b { font-family: Orbitron, Inter, sans-serif; letter-spacing: 0.22em; font-size: 15px; }
    .brand span { display: block; font-size: 11px; color: #a1a1aa; letter-spacing: 0.2em; text-transform: uppercase; }
    .nav { display: flex; gap: 18px; font-size: 13px; color: #a1a1aa; }
    .nav a { position: relative; text-decoration: none; transition: color 0.2s ease; }
    .nav a::after {
      content: ""; position: absolute; left: 0; right: 0; bottom: -4px; height: 1px;
      background: #f02d5e; transform: scaleX(0); transform-origin: left; transition: transform 0.22s ease;
    }
    .nav a:hover { color: #fff; }
    .nav a:hover::after { transform: scaleX(1); }
    .hero { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 44px; align-items: center; padding: 28px 0 52px; }
    h1 {
      margin: 0; font-size: clamp(38px, 6.2vw, 72px); line-height: 0.92; letter-spacing: -0.045em;
      animation: fade-up 0.7s ease 0.08s both;
    }
    h1 em { font-style: normal; color: #f02d5e; white-space: nowrap; }
    .lead {
      margin: 18px 0 0; max-width: 540px; color: #a1a1aa; font-size: 17px; line-height: 1.55;
      animation: fade-up 0.7s ease 0.16s both;
    }
    .cta {
      display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 28px;
      animation: fade-up 0.7s ease 0.24s both;
    }
    .btn {
      position: relative; overflow: hidden;
      display: inline-flex; align-items: center; justify-content: center; gap: 10px;
      height: 54px; padding: 0 24px; border-radius: 14px; background: #f02d5e; color: #fff;
      font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 14px 36px rgba(240, 45, 94, 0.32);
      transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
    }
    .btn::after {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%);
      transform: translateX(-130%);
      animation: btn-shine 2.8s ease-in-out 0.8s infinite;
    }
    .btn:hover { filter: brightness(1.08); transform: translateY(-2px); box-shadow: 0 18px 40px rgba(240, 45, 94, 0.42); }
    .btn small { display: block; font-size: 11px; font-weight: 600; opacity: 0.86; }
    .meta { font-size: 13px; color: #71717a; line-height: 1.5; }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; animation: fade-up 0.7s ease 0.32s both; }
    .pill {
      padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03); color: #d4d4d8; font-size: 12px;
    }
    .shot {
      position: relative;
      padding: 8px;
      border: 1px solid rgba(255,255,255,0.08); border-radius: 22px;
      background: linear-gradient(180deg, #151515, #070707);
      box-shadow: 0 30px 80px rgba(0,0,0,0.5);
      animation: shot-in 0.9s cubic-bezier(.2,.8,.2,1) 0.18s both;
    }
    .screens {
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      aspect-ratio: 16 / 10;
      background: #050505;
    }
    .screen {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      object-position: left top;
      opacity: 0;
      transition: opacity 0.55s ease;
    }
    .screen.is-on { opacity: 1; }
    .screen-dots {
      display: flex; justify-content: center; gap: 8px;
      padding: 10px 0 4px;
    }
    .screen-dots button {
      width: 7px; height: 7px; padding: 0; border: 0; border-radius: 50%;
      background: rgba(255,255,255,0.22); cursor: pointer;
    }
    .screen-dots button.is-on { background: #f02d5e; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding-bottom: 36px; }
    .card {
      padding: 20px; border: 1px solid rgba(255,255,255,0.07); border-radius: 18px;
      background: linear-gradient(180deg, rgba(16,16,16,.98), rgba(6,6,6,.97));
      opacity: 0; transform: translateY(22px);
      transition: opacity 0.55s ease var(--d, 0ms), transform 0.55s ease var(--d, 0ms), border-color 0.2s ease;
    }
    .card.in { opacity: 1; transform: none; }
    .card:hover { border-color: rgba(240, 45, 94, 0.35); }
    .card b { display: block; font-size: 15px; margin-bottom: 8px; }
    .card p { margin: 0; color: #a1a1aa; font-size: 13px; line-height: 1.5; }
    .adbar {
      display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: center;
      margin: 0 0 56px; padding: 18px 22px; border-radius: 18px;
      border: 1px solid rgba(240, 45, 94, 0.22); background: rgba(240, 45, 94, 0.07);
      opacity: 0; transform: translateY(18px);
      transition: opacity 0.55s ease, transform 0.55s ease;
    }
    .adbar.in { opacity: 1; transform: none; }
    .adbar strong { display: block; font-size: 15px; }
    .adbar span { color: #a1a1aa; font-size: 13px; }
    footer { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 24px 0 40px; color: #52525b; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
    footer a { color: #a1a1aa; }
    @media (max-width: 860px) {
      .hero, .grid { grid-template-columns: 1fr; }
      .nav { display: none; }
    }
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(18px); filter: blur(6px); }
      to { opacity: 1; transform: none; filter: none; }
    }
    @keyframes fade-down {
      from { opacity: 0; transform: translateY(-12px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes shot-in {
      from { opacity: 0; transform: translateX(36px) scale(0.96); filter: blur(8px); }
      to { opacity: 1; transform: none; filter: none; }
    }
    @keyframes glow-breathe {
      0%, 100% { opacity: 0.72; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.08); }
    }
    @keyframes glow-drift {
      0%, 100% { transform: translate(0, 0); opacity: 0.7; }
      50% { transform: translate(-40px, 24px); opacity: 1; }
    }
    @keyframes btn-shine {
      0%, 55% { transform: translateX(-130%); }
      75%, 100% { transform: translateX(130%); }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
      .card, .adbar { opacity: 1; transform: none; }
    }
  </style>
  <noscript><style>.card,.adbar{opacity:1;transform:none}</style></noscript>
</head>
<body>
  <div class="wrap">
    <div class="glow"></div>
    <div class="glow2"></div>
    <header>
      <a class="brand" href="./">
        <img src="aries-mark.png" alt="" />
        <div>
          <b>ARIES</b>
          <span>Panel</span>
        </div>
      </a>
      <nav class="nav">
        <a href="./#funkcje">Funkcje</a>
        <a href="download.php">Pobierz</a>
        <a href="polityka-prywatnosci.php">Prywatność</a>
      </nav>
    </header>
    <main>
      <section class="hero">
        <div>
          <h1>Panel, który trzyma służbę <em>w ryzach</em>.</h1>
          <p class="lead">
            ARIES to aplikacja dla administracji GTA RP: makra, nakładka na grę, reporty, osiągnięcia i kody.
          </p>
          <div class="cta">
            <a class="btn" href="download.php" download="ARIES-Setup.exe">Pobierz ARIES na Windows</a>
            <div class="meta">
              <?php echo $verLabel; ?> · <?php echo htmlspecialchars($sizeLabel, ENT_QUOTES, "UTF-8"); ?> · Windows 10/11<br />
              Plik: <?php echo $fileName; ?>
            </div>
          </div>
          <div class="pills">
            <span class="pill">0 zł</span>
          </div>
        </div>
        <div class="shot">
          <div class="screens">
            <img class="screen is-on" src="aries-screen-home.jpg" alt="Panel ARIES — główna, reporty i serwery" />
            <img class="screen" src="aries-screen-achievements.jpg" alt="Panel ARIES — osiągnięcia" />
            <img class="screen" src="aries-screen-overlay.jpg" alt="Panel ARIES — nakładka HUD" />
          </div>
          <div class="screen-dots" role="tablist" aria-label="Zrzuty panelu">
            <button type="button" class="is-on" aria-label="Główna"></button>
            <button type="button" aria-label="Osiągnięcia"></button>
            <button type="button" aria-label="Nakładka"></button>
          </div>
        </div>
      </section>
      <section class="grid" id="funkcje">
        <article class="card">
          <b>Makra i komendy</b>
          <p>Zapisujesz powtarzalne odpowiedzi i wysyłasz je do okna gry, bez przepisywania czatu.</p>
        </article>
        <article class="card">
          <b>Nakładka HUD</b>
          <p>Reporty, zegar, Spotify i powiadomienia o aktualizacji na przezroczystej nakładce.</p>
        </article>
        <article class="card">
          <b>Statystyki służby</b>
          <p>Liczniki reportów i eventów z historią dnia, tygodnia i miesiąca.</p>
        </article>
        <article class="card">
          <b>Osiągnięcia i kody</b>
          <p>Ranking, nagrody in-game i kody promocyjne dla drużyny.</p>
        </article>
        <article class="card">
          <b>Discord</b>
          <p>Logowanie po Discordzie rozpoznaje konto w panelu. To nie jest sklep i nie zastępuje gry.</p>
        </article>
        <article class="card">
          <b>Zawsze aktualne</b>
          <p>Przycisk ściąga najnowszy installer z wydania GitHub, ale zostajesz na filipekweb.pl.</p>
        </article>
      </section>
      <aside class="adbar">
        <div>
          <strong>Pobierasz z filipekweb.pl</strong>
          <span>Serwer sam bierze najnowszy plik z GitHuba i od razu go wysyła. Adres w przeglądarce się nie zmienia.</span>
        </div>
        <a class="btn" href="download.php" download="ARIES-Setup.exe">Pobierz teraz</a>
      </aside>
    </main>
    <footer>
      <div>© <?php echo date("Y"); ?> ARIES · filipekweb.pl</div>
      <div>
        <a href="polityka-prywatnosci.php">Polityka prywatności</a>
      </div>
    </footer>
  </div>
  <script>
    (function () {
      var nodes = document.querySelectorAll(".card, .adbar");
      if (!("IntersectionObserver" in window)) {
        for (var i = 0; i < nodes.length; i++) nodes[i].classList.add("in");
      } else {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.16, rootMargin: "0px 0px -40px 0px" });
        for (var j = 0; j < nodes.length; j++) {
          nodes[j].style.setProperty("--d", (j % 3) * 80 + "ms");
          io.observe(nodes[j]);
        }
      }

      var shots = document.querySelectorAll(".screen");
      var dots = document.querySelectorAll(".screen-dots button");
      if (!shots.length) return;
      var idx = 0;
      var timer;
      function show(n) {
        idx = (n + shots.length) % shots.length;
        for (var k = 0; k < shots.length; k++) {
          shots[k].classList.toggle("is-on", k === idx);
          if (dots[k]) dots[k].classList.toggle("is-on", k === idx);
        }
      }
      function start() {
        stop();
        timer = setInterval(function () { show(idx + 1); }, 4200);
      }
      function stop() { if (timer) clearInterval(timer); }
      for (var d = 0; d < dots.length; d++) {
        (function (n) {
          dots[n].addEventListener("click", function () { show(n); start(); });
        })(d);
      }
      var shot = document.querySelector(".shot");
      if (shot) {
        shot.addEventListener("mouseenter", stop);
        shot.addEventListener("mouseleave", start);
      }
      start();
    })();
  </script>
</body>
</html>
