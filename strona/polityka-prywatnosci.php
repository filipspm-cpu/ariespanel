<?php
header_remove("Content-Disposition");
header("Content-Type: text/html; charset=utf-8");
header("Content-Disposition: inline");
header("X-Content-Type-Options: nosniff");
header("Cache-Control: public, max-age=120");
http_response_code(200);

$candidates = array(
  __DIR__ . "/aries_panel_polityka_prywatnosci.html",
  __DIR__ . "/polityka-prywatnosci.html",
);
foreach ($candidates as $path) {
  if (@is_file($path) && @is_readable($path)) {
    readfile($path);
    exit;
  }
}

echo "<!DOCTYPE html><html lang=\"pl\"><head><meta charset=\"utf-8\"><title>Polityka prywatności</title></head><body style=\"background:#050505;color:#fff;font-family:Inter,sans-serif;padding:48px\"><p>Nie znaleziono polityki prywatności.</p><p><a href=\"./\" style=\"color:#f02d5e\">Wróć</a></p></body></html>";
exit;
