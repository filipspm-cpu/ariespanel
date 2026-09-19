<?php
header_remove("Content-Disposition");
header("Content-Type: text/html; charset=utf-8");
header("Content-Disposition: inline");
header("X-Content-Type-Options: nosniff");
$path = __DIR__ . "/aries_panel_polityka_prywatnosci.html";
if (!is_file($path)) {
  http_response_code(404);
  echo "<!DOCTYPE html><html lang=\"pl\"><head><meta charset=\"utf-8\"><title>Polityka prywatności</title></head><body><p>Nie znaleziono polityki prywatności.</p></body></html>";
  exit;
}
readfile($path);
exit;
