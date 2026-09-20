<?php
define("ARIES_OK", 1);
require __DIR__ . "/aries-latest.php";

$latest = aries_latest_release();
if (!$latest) {
  http_response_code(502);
  header("Content-Type: text/html; charset=utf-8");
  echo "<!DOCTYPE html><html lang=\"pl\"><head><meta charset=\"utf-8\"><title>ARIES</title></head><body style=\"background:#050505;color:#fff;font-family:Inter,sans-serif;padding:48px\"><p>Nie udało się pobrać instalatora. Spróbuj za chwilę.</p><p><a href=\"./\" style=\"color:#f02d5e\">Wróć na stronę ARIES</a></p></body></html>";
  exit;
}

if (!aries_github_ok($latest["url"]) || !preg_match("/^ARIES-Setup-.+\\.exe$/i", $latest["name"])) {
  http_response_code(502);
  exit;
}

aries_stream_github($latest["url"], $latest["name"], $latest["size"]);
exit;
