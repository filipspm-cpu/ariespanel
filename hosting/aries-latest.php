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
  $cache = __DIR__ . "/latest-cache.json";
  if (is_file($cache) && (time() - filemtime($cache)) < 600) {
    $cached = json_decode((string) file_get_contents($cache), true);
    if (is_array($cached) && !empty($cached["url"]) && !empty($cached["name"])) return $cached;
  }
  $raw = aries_http_get("https://api.github.com/repos/filipspm-cpu/ariespanel/releases/latest");
  $data = json_decode($raw, true);
  if (!is_array($data) || empty($data["assets"]) || !is_array($data["assets"])) return null;
  $asset = null;
  foreach ($data["assets"] as $row) {
    $name = isset($row["name"]) ? (string) $row["name"] : "";
    if (!preg_match("/^ARIES-Setup-.+\\.exe$/i", $name)) continue;
    if (stripos($name, "blockmap") !== false) continue;
    $asset = $row;
    break;
  }
  if (!$asset || empty($asset["browser_download_url"])) return null;
  $tag = isset($data["tag_name"]) ? (string) $data["tag_name"] : "";
  $version = ltrim($tag, "vV");
  if (preg_match("/ARIES-Setup-(.+)\\.exe$/i", (string) $asset["name"], $m)) $version = $m[1];
  $out = array(
    "tag" => $tag,
    "version" => $version,
    "name" => (string) $asset["name"],
    "url" => (string) $asset["browser_download_url"],
    "size" => isset($asset["size"]) ? (int) $asset["size"] : 0,
  );
  @file_put_contents($cache, json_encode($out));
  return $out;
}

function aries_stream_github($url, $filename, $size) {
  set_time_limit(0);
  if (function_exists("ignore_user_abort")) @ignore_user_abort(true);
  while (function_exists("ob_get_level") && ob_get_level() > 0) @ob_end_clean();
  header("Content-Type: application/octet-stream");
  header("Content-Disposition: attachment; filename=\"" . str_replace('"', "", $filename) . "\"");
  if ($size > 0) header("Content-Length: " . $size);
  header("X-Content-Type-Options: nosniff");
  header("Cache-Control: no-store");
  if (function_exists("curl_init")) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, "ARIES-FilipekWeb/1.0");
    curl_setopt($ch, CURLOPT_BUFFERSIZE, 262144);
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $chunk) {
      echo $chunk;
      if (connection_aborted()) return -1;
      return strlen($chunk);
    });
    $ok = curl_exec($ch);
    curl_close($ch);
    return (bool) $ok;
  }
  $ctx = stream_context_create(array(
    "http" => array(
      "timeout" => 180,
      "header" => "User-Agent: ARIES-FilipekWeb/1.0\r\n",
      "follow_location" => 1,
    ),
  ));
  $fp = @fopen($url, "rb", false, $ctx);
  if (!$fp) return false;
  while (!feof($fp)) {
    $chunk = fread($fp, 262144);
    if ($chunk === false) break;
    echo $chunk;
    if (connection_aborted()) break;
  }
  fclose($fp);
  return true;
}
