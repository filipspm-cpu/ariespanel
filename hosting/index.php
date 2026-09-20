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
    }
    .glow2 {
      right: -12%; top: 28%;
      width: 420px; height: 420px;
      background: radial-gradient(circle, rgba(240, 45, 94, 0.12), transparent 70%);
    }
    header, main, footer { position: relative; z-index: 1; width: min(1160px, calc(100% - 32px)); margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 22px 0; }
    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .brand img { width: 42px; height: 42px; }
    .brand b { font-family: Orbitron, Inter, sans-serif; letter-spacing: 0.22em; font-size: 15px; }
    .brand span { display: block; font-size: 11px; color: #a1a1aa; letter-spacing: 0.2em; text-transform: uppercase; }
    .nav { display: flex; gap: 18px; font-size: 13px; color: #a1a1aa; }
    .nav a:hover { color: #fff; }
    .hero { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 44px; align-items: center; padding: 28px 0 52px; }
    h1 { margin: 0; font-size: clamp(38px, 6.2vw, 72px); line-height: 0.92; letter-spacing: -0.045em; }
    h1 em { font-style: normal; color: #f02d5e; white-space: nowrap; }
    .lead { margin: 18px 0 0; max-width: 540px; color: #a1a1aa; font-size: 17px; line-height: 1.55; }
    .cta { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 28px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 10px;
      height: 54px; padding: 0 24px; border-radius: 14px; background: #f02d5e; color: #fff;
      font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 14px 36px rgba(240, 45, 94, 0.32);
    }
    .btn:hover { filter: brightness(1.08); }
    .btn small { display: block; font-size: 11px; font-weight: 600; opacity: 0.86; }
    .meta { font-size: 13px; color: #71717a; line-height: 1.5; }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
    .pill {
      padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03); color: #d4d4d8; font-size: 12px;
    }
    .shot {
      position: relative;
      min-height: 390px; padding: 18px;
      border: 1px solid rgba(255,255,255,0.08); border-radius: 28px;
      background:
        radial-gradient(circle at 50% 18%, rgba(240, 45, 94, 0.2), transparent 48%),
        linear-gradient(180deg, #151515, #070707);
      box-shadow: 0 30px 80px rgba(0,0,0,0.5);
      overflow: hidden;
    }
    .chrome { display: flex; gap: 6px; margin-bottom: 18px; }
    .chrome i { width: 10px; height: 10px; border-radius: 50%; background: #3f3f46; display: block; }
    .chrome i:first-child { background: #f02d5e; }
    .shot-body { display: grid; grid-template-columns: 86px 1fr; gap: 14px; min-height: 280px; }
    .side { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 8px; }
    .side img { width: 54px; height: 54px; }
    .dot { width: 28px; height: 28px; border-radius: 8px; background: rgba(255,255,255,0.06); }
    .dot.on { background: rgba(240, 45, 94, 0.35); }
    .panel { padding: 22px 18px 18px; border-radius: 18px; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.05); }
    .panel img { display: block; width: min(180px, 55%); margin: 8px auto 12px; filter: drop-shadow(0 18px 40px rgba(240, 45, 94, 0.22)); }
    .word { font-family: Orbitron, Inter, sans-serif; text-align: center; letter-spacing: 0.34em; font-size: 18px; }
    .sub { text-align: center; color: #71717a; font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; margin-top: 6px; }
    .ver { text-align: center; margin-top: 14px; color: #f02d5e; font-size: 13px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding-bottom: 36px; }
    .card {
      padding: 20px; border: 1px solid rgba(255,255,255,0.07); border-radius: 18px;
      background: linear-gradient(180deg, rgba(16,16,16,.98), rgba(6,6,6,.97));
    }
    .card b { display: block; font-size: 15px; margin-bottom: 8px; }
    .card p { margin: 0; color: #a1a1aa; font-size: 13px; line-height: 1.5; }
    .adbar {
      display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: center;
      margin: 0 0 56px; padding: 18px 22px; border-radius: 18px;
      border: 1px solid rgba(240, 45, 94, 0.22); background: rgba(240, 45, 94, 0.07);
    }
    .adbar strong { display: block; font-size: 15px; }
    .adbar span { color: #a1a1aa; font-size: 13px; }
    footer { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 24px 0 40px; color: #52525b; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
    footer a { color: #a1a1aa; }
    @media (max-width: 860px) {
      .hero, .grid, .shot-body { grid-template-columns: 1fr; }
      .shot { min-height: 280px; }
      .side { flex-direction: row; justify-content: center; }
      .nav { display: none; }
    }
  </style>
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
        <a href="?download=1">Pobierz</a>
        <a href="aries_panel_polityka_prywatnosci.html">Prywatność</a>
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
            <a class="btn" href="?download=1">Pobierz ARIES na Windows</a>
            <div class="meta">
              <?php echo $verLabel; ?> · <?php echo htmlspecialchars($sizeLabel, ENT_QUOTES, "UTF-8"); ?> · Windows 10/11<br />
              Plik: <?php echo $fileName; ?>
            </div>
          </div>
          <div class="pills">
            <span class="pill">0 zł</span>
          </div>
        </div>
        <div class="shot" aria-hidden="true">
          <div class="chrome"><i></i><i></i><i></i></div>
          <div class="shot-body">
            <div class="side">
              <img src="aries-mark.png" alt="" />
              <div class="dot on"></div>
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
            <div class="panel">
              <img src="aries-logo.png" alt="ARIES" />
              <div class="word">ARIES</div>
              <div class="sub">panel</div>
              <div class="ver"><?php echo $verLabel; ?></div>
            </div>
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
        <a class="btn" href="?download=1">Pobierz teraz</a>
      </aside>
    </main>
    <footer>
      <div>© <?php echo date("Y"); ?> ARIES · filipekweb.pl</div>
      <div>
        <a href="aries_panel_polityka_prywatnosci.html">Polityka prywatności</a>
      </div>
    </footer>
  </div>
</body>
</html>
