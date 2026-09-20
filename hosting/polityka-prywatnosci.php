<?php
header_remove("Content-Disposition");
$candidates = array(
  __DIR__ . "/aries_panel_polityka_prywatnosci.html",
  __DIR__ . "/polityka-prywatnosci.html",
);
foreach ($candidates as $path) {
  if (@is_file($path) && @is_readable($path)) {
    header("Content-Type: text/html; charset=utf-8");
    header("Content-Disposition: inline");
    header("X-Content-Type-Options: nosniff");
    header("Cache-Control: public, max-age=120");
    http_response_code(200);
    readfile($path);
    exit;
  }
}
header("Location: aries_panel_polityka_prywatnosci.html", true, 302);
header("Cache-Control: no-store");
exit;
