<?php
define("ARIES_OK", 1);
require __DIR__ . "/aries-latest.php";
header_remove("Content-Disposition");
header("Content-Type: text/html; charset=utf-8");
header("X-Content-Type-Options: nosniff");

$latest = aries_latest_release();
$version = $latest && !empty($latest["version"]) ? $latest["version"] : "";
$sizeMb = $latest && !empty($latest["size"]) ? number_format($latest["size"] / 1048576, 0, ",", " ") : "";
$verLabel = $version !== "" ? "v" . htmlspecialchars($version, ENT_QUOTES, "UTF-8") : "najnowsza wersja";
$sizeLabel = $sizeMb !== "" ? $sizeMb . " MB" : "Windows";
?>
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ARIES — panel administracji GTA RP</title>
  <meta name="description" content="ARIES to panel dla administracji GTA RP: makra, nakładka HUD, statystyki reportów, osiągnięcia i kody. Pobierz najnowszą wersję na Windows." />
  <meta property="og:title" content="ARIES — panel administracji GTA RP" />
  <meta property="og:description" content="Makra, nakładka, reporty i aktualizacje. Pobierz ARIES na Windows." />
  <meta property="og:image" content="https://filipekweb.pl/aries/aries-logo.png" />
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
    .wrap { position: relative; overflow: hidden; }
    .glow {
      pointer-events: none;
      position: absolute;
      inset: -20% 10% auto;
      height: 420px;
      background: radial-gradient(ellipse at 50% 0%, rgba(240, 45, 94, 0.22), transparent 62%);
    }
    header, main, footer { position: relative; z-index: 1; width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 22px 0; }
    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .brand img { width: 42px; height: 42px; }
    .brand b { font-family: Orbitron, Inter, sans-serif; letter-spacing: 0.18em; font-size: 14px; }
    .brand span { display: block; font-size: 11px; color: #a1a1aa; letter-spacing: 0.16em; text-transform: uppercase; }
    .nav { display: flex; gap: 18px; font-size: 13px; color: #a1a1aa; }
    .nav a:hover { color: #fff; }
    .hero { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 48px; align-items: center; padding: 36px 0 56px; }
    h1 { margin: 0; font-size: clamp(36px, 6vw, 68px); line-height: 0.95; letter-spacing: -0.04em; }
    h1 em { font-style: normal; color: #f02d5e; }
    .lead { margin: 18px 0 0; max-width: 520px; color: #a1a1aa; font-size: 17px; line-height: 1.55; }
    .cta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 28px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 10px;
      height: 52px; padding: 0 22px; border-radius: 12px; background: #f02d5e; color: #fff;
      font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 12px 32px rgba(240, 45, 94, 0.28);
    }
    .btn:hover { filter: brightness(1.08); }
    .meta { font-size: 13px; color: #71717a; }
    .shot {
      display: flex; align-items: center; justify-content: center;
      min-height: 360px; border: 1px solid rgba(255,255,255,0.08); border-radius: 28px;
      background:
        radial-gradient(circle at 50% 30%, rgba(240, 45, 94, 0.16), transparent 46%),
        linear-gradient(180deg, #141414, #070707);
      box-shadow: 0 30px 80px rgba(0,0,0,0.45);
    }
    .shot img { width: min(280px, 70%); filter: drop-shadow(0 18px 40px rgba(240, 45, 94, 0.2)); }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding-bottom: 72px; }
    .card {
      padding: 20px; border: 1px solid rgba(255,255,255,0.07); border-radius: 18px;
      background: linear-gradient(180deg, rgba(16,16,16,.98), rgba(6,6,6,.97));
    }
    .card b { display: block; font-size: 15px; margin-bottom: 8px; }
    .card p { margin: 0; color: #a1a1aa; font-size: 13px; line-height: 1.5; }
    footer { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 24px 0 40px; color: #52525b; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
    footer a { color: #a1a1aa; }
    @media (max-width: 860px) {
      .hero, .grid { grid-template-columns: 1fr; }
      .shot { min-height: 240px; }
      .nav { display: none; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="glow"></div>
    <header>
      <a class="brand" href="./">
        <img src="aries-mark.png" alt="" />
        <div>
          <b>ARIES</b>
          <span>Panel</span>
        </div>
      </a>
      <nav class="nav">
        <a href="#funkcje">Funkcje</a>
        <a href="polityka-prywatnosci.php">Prywatność</a>
      </nav>
    </header>
    <main>
      <section class="hero">
        <div>
          <h1>Panel, który trzyma służbę <em>w ryzach</em>.</h1>
          <p class="lead">
            ARIES to aplikacja dla administracji GTA RP: makra, nakładka na grę, reporty, osiągnięcia i kody.
            Pobierasz najnowszą wersję prosto z tej strony — bez wchodzenia na GitHuba.
          </p>
          <div class="cta">
            <a class="btn" href="download.php">Pobierz ARIES na Windows</a>
            <div class="meta"><?php echo $verLabel; ?> · <?php echo htmlspecialchars($sizeLabel, ENT_QUOTES, "UTF-8"); ?> · Windows 10/11</div>
          </div>
        </div>
        <div class="shot">
          <img src="aries-logo.png" alt="ARIES" />
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
          <p>Przycisk pobiera najnowszy installer z wydania GitHub, ale zostajesz na filipekweb.pl.</p>
        </article>
      </section>
    </main>
    <footer>
      <div>© <?php echo date("Y"); ?> ARIES · filipekweb.pl</div>
      <div>
        <a href="polityka-prywatnosci.php">Polityka prywatności</a>
      </div>
    </footer>
  </div>
</body>
</html>
