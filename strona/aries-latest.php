<?php
if (!defined("ARIES_OK")) {
  http_response_code(404);
  exit;
}

function aries_http_get($url, $timeout = 15) {
  if (function_exists("curl_init")) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 8);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    curl_setopt($ch, CURLOPT_USERAGENT, "ARIES-FilipekWeb/1.0");
    curl_setopt($ch, CURLOPT_HTTPHEADER, array("Accept: application/vnd.github+json"));
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code >= 200 && $code < 300 && is_string($body) && $body !== "") return $body;
    return "";
  }
  $ctx = stream_context_create(array(
    "http" => array(
      "timeout" => $timeout,
      "header" => "User-Agent: ARIES-FilipekWeb/1.0\r\nAccept: application/vnd.github+json\r\n",
      "follow_location" => 1,
    ),
  ));
  $body = @file_get_contents($url, false, $ctx);
  return is_string($body) ? $body : "";
}

function aries_latest_release() {
  $latestFile = __DIR__ . "/upd/latest.yml";
  if (!is_file($latestFile)) return null;
  $raw = (string) @file_get_contents($latestFile);
  if (!preg_match("/^version:\\s*([0-9][0-9A-Za-z.\\-]*)/m", $raw, $versionMatch)) return null;
  if (!preg_match("/^path:\\s*(ARIES-Setup-[0-9A-Za-z.+-]+\\.exe)\\s*$/m", $raw, $nameMatch)) return null;
  $name = $nameMatch[1];
  $installer = __DIR__ . "/upd/" . $name;
  if (!is_file($installer)) return null;
  return array(
    "tag" => "v" . $versionMatch[1],
    "version" => $versionMatch[1],
    "name" => $name,
    "url" => "./upd/" . rawurlencode($name),
    "size" => (int) filesize($installer),
    "path" => $installer,
  );
}

function aries_want_download() {
  if (isset($_GET["download"])) return true;
  $script = strtolower(basename(str_replace("\\", "/", (string) ($_SERVER["SCRIPT_FILENAME"] ?? $_SERVER["SCRIPT_NAME"] ?? ""))));
  $uri = strtolower(basename((string) parse_url($_SERVER["REQUEST_URI"] ?? "", PHP_URL_PATH)));
  return $script === "download.php" || $uri === "download.php";
}

function aries_send_installer() {
  $latest = aries_latest_release();
  if (!$latest) {
    http_response_code(502);
    header("Content-Type: text/html; charset=utf-8");
    echo "<!DOCTYPE html><html lang=\"pl\"><head><meta charset=\"utf-8\"><title>ARIES</title></head><body style=\"background:#050505;color:#fff;font-family:Inter,sans-serif;padding:48px\"><p>Nie udało się pobrać instalatora. Spróbuj za chwilę.</p><p><a href=\"./\" style=\"color:#f02d5e\">Wróć na stronę ARIES</a></p></body></html>";
    exit;
  }
  while (function_exists("ob_get_level") && ob_get_level() > 0) @ob_end_clean();
  header("Content-Type: application/octet-stream");
  header("Content-Disposition: attachment; filename=\"" . $latest["name"] . "\"");
  header("Content-Length: " . $latest["size"]);
  header("X-Content-Type-Options: nosniff");
  header("Cache-Control: no-store");
  readfile($latest["path"]);
  exit;
}

