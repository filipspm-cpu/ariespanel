<?php
if (function_exists("ob_start")) {
  @ob_start();
}
error_reporting(0);
ini_set("display_errors", "0");
if (function_exists("mysqli_report")) {
  mysqli_report(MYSQLI_REPORT_OFF);
}
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Aries-Key, Authorization");
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

$ARIES_DONE = false;
register_shutdown_function(function () {
  global $ARIES_DONE;
  if ($ARIES_DONE) return;
  echo json_encode(array("ok" => false, "error" => "php", "developer" => false, "items" => array()));
});

$raw = file_get_contents("php://input");
if ($raw === false) $raw = "";
$data = json_decode($raw, true);
if (!is_array($data)) $data = array();

$auth = isset($_SERVER["HTTP_AUTHORIZATION"]) ? (string) $_SERVER["HTTP_AUTHORIZATION"] : "";
if (stripos($auth, "Bearer ") === 0) $auth = substr($auth, 7);

function req_get($arr, $key) {
  if (!is_array($arr) || !isset($arr[$key])) return "";
  return trim((string) $arr[$key]);
}

function key_ok($data, $auth) {
  $expected = "aries-accounts-v1";
  $candidates = array(
    req_get($_GET, "token"),
    req_get($_GET, "k"),
    req_get($_GET, "key"),
    req_get($data, "key"),
    req_get($data, "token"),
    isset($_SERVER["HTTP_X_ARIES_KEY"]) ? trim((string) $_SERVER["HTTP_X_ARIES_KEY"]) : "",
    trim((string) $auth),
  );
  foreach ($candidates as $c) {
    if ($c === $expected) return true;
  }
  return false;
}

function json_out($payload, $code = 200) {
  global $ARIES_DONE;
  $ARIES_DONE = true;
  while (function_exists("ob_get_level") && ob_get_level() > 0) {
    @ob_end_clean();
  }
  http_response_code((int) $code);
  $flags = 0;
  if (defined("JSON_UNESCAPED_UNICODE")) $flags |= JSON_UNESCAPED_UNICODE;
  echo json_encode($payload, $flags);
  exit;
}

if (!key_ok($data, $auth)) {
  json_out(array("ok" => false, "error" => "forbidden", "developer" => false, "items" => array()), 403);
}

try {
  $mysqli = @new mysqli("localhost", "host425499_ariespanel", "Wu8BzxevpdGr86f5WrXr", "host425499_ariespanel");
} catch (Exception $e) {
  json_out(array("ok" => false, "error" => "db", "developer" => false, "items" => array()), 200);
}
if (!$mysqli || $mysqli->connect_errno) {
  json_out(array("ok" => false, "error" => "db", "developer" => false, "items" => array()), 200);
}
$mysqli->set_charset("utf8mb4");
$mysqli->query(
  "CREATE TABLE IF NOT EXISTS feedback (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    discord_id VARCHAR(32) NOT NULL,
    name VARCHAR(191) NOT NULL DEFAULT '',
    kind VARCHAR(16) NOT NULL DEFAULT 'bug',
    title VARCHAR(191) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    channel VARCHAR(32) NOT NULL DEFAULT 'other',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_feedback_discord (discord_id),
    INDEX idx_feedback_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);
$mysqli->query("ALTER TABLE feedback ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'open'");
$mysqli->query("ALTER TABLE feedback ADD COLUMN channel VARCHAR(32) NOT NULL DEFAULT 'other'");

function is_developer_id($mysqli, $id) {
  if ($id === "") return false;
  $stmt = $mysqli->prepare("SELECT rank FROM account_roles WHERE discord_id = ? LIMIT 1");
  if (!$stmt) return false;
  $stmt->bind_param("s", $id);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  if (!$row) return false;
  return strpos(strtolower((string) $row["rank"]), "dev") !== false;
}

function feedback_status($raw) {
  $k = strtolower(trim((string) $raw));
  if ($k === "done" || $k === "wykonane") return "done";
  if ($k === "deleted" || $k === "usun" || $k === "usuniete" || $k === "usunięte") return "deleted";
  return "open";
}

function feedback_kind($raw) {
  $k = strtolower(trim((string) $raw));
  if ($k === "suggestion" || $k === "sugestia") return "suggestion";
  return "bug";
}

function feedback_channel($raw) {
  $k = strtolower(trim((string) $raw));
  $map = array(
    "home" => "home",
    "glowna" => "home",
    "główna" => "home",
    "strona glowna" => "home",
    "strona główna" => "home",
    "cmd" => "cmd",
    "overlay" => "overlay",
    "nakladka" => "overlay",
    "nakładka" => "overlay",
    "macros" => "macros",
    "makra" => "macros",
    "counters" => "counters",
    "statystyki" => "counters",
    "forum" => "forum",
    "craft" => "craft",
    "settings" => "settings",
    "ustawienia" => "settings",
    "accounts" => "accounts",
    "konta" => "accounts",
    "about" => "about",
    "o aplikacji" => "about",
    "credits" => "credits",
    "autorzy" => "credits",
    "achievements" => "achievements",
    "osiagniecia" => "achievements",
    "osiągnięcia" => "achievements",
    "other" => "other",
    "inne" => "other",
  );
  return isset($map[$k]) ? $map[$k] : "other";
}

function status_rank($status) {
  if ($status === "deleted") return 2;
  if ($status === "done") return 1;
  return 0;
}

function unique_feedback_items($items) {
  $seenId = array();
  $byKey = array();
  $order = array();
  foreach ($items as $item) {
    $id = (int) $item["id"];
    if (isset($seenId[$id])) continue;
    $seenId[$id] = true;
    $key = $item["discordId"] . "|" . $item["channel"] . "|" . $item["title"] . "|" . $item["body"];
    if (!isset($byKey[$key])) {
      $byKey[$key] = $item;
      $order[] = $key;
      continue;
    }
    if (status_rank($item["status"]) > status_rank($byKey[$key]["status"])) {
      $byKey[$key]["status"] = $item["status"];
    }
  }
  $out = array();
  foreach ($order as $key) $out[] = $byKey[$key];
  return $out;
}

function update_feedback_status($mysqli, $itemId, $status) {
  $stmt = $mysqli->prepare("UPDATE feedback SET status = ? WHERE id = ?");
  if ($stmt) {
    $stmt->bind_param("si", $status, $itemId);
    $stmt->execute();
  }
  $dup = $mysqli->prepare(
    "UPDATE feedback AS f
     INNER JOIN feedback AS src
       ON f.discord_id = src.discord_id AND f.channel = src.channel AND f.title = src.title AND f.body = src.body
     SET f.status = ?
     WHERE src.id = ?"
  );
  if ($dup) {
    $dup->bind_param("si", $status, $itemId);
    $dup->execute();
  }
}

function insert_feedback_once($mysqli, $discordId, $name, $kind, $title, $body, $channel) {
  $stmt = $mysqli->prepare(
    "SELECT id FROM feedback WHERE discord_id = ? AND channel = ? AND title = ? AND body = ? AND created_at >= (NOW() - INTERVAL 5 MINUTE) ORDER BY id DESC LIMIT 1"
  );
  if ($stmt) {
    $stmt->bind_param("ssss", $discordId, $channel, $title, $body);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res && $res->fetch_assoc()) return;
  }
  $ins = $mysqli->prepare(
    "INSERT INTO feedback (discord_id, name, kind, title, body, channel) VALUES (?, ?, ?, ?, ?, ?)"
  );
  if ($ins) {
    $ins->bind_param("ssssss", $discordId, $name, $kind, $title, $body, $channel);
    $ins->execute();
  }
}

function list_feedback($mysqli, $discordId, $developer) {
  $out = array();
  if ($developer) {
    $result = $mysqli->query(
      "SELECT id, discord_id, name, kind, title, body, status, channel, created_at FROM feedback ORDER BY created_at DESC, id DESC LIMIT 250"
    );
  } else {
    $stmt = $mysqli->prepare(
      "SELECT id, discord_id, name, kind, title, body, status, channel, created_at FROM feedback WHERE discord_id = ? ORDER BY created_at DESC, id DESC LIMIT 80"
    );
    if (!$stmt) return $out;
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $result = $stmt->get_result();
  }
  if (!$result) return $out;
  while ($row = $result->fetch_assoc()) {
    $iso = "";
    if (!empty($row["created_at"])) {
      $ts = strtotime($row["created_at"]);
      if ($ts) $iso = date("c", $ts);
    }
    $out[] = array(
      "id" => (int) $row["id"],
      "discordId" => $row["discord_id"],
      "name" => $row["name"],
      "kind" => $row["kind"],
      "title" => $row["title"],
      "body" => $row["body"],
      "status" => feedback_status(isset($row["status"]) ? $row["status"] : "open"),
      "channel" => feedback_channel(isset($row["channel"]) ? $row["channel"] : "other"),
      "createdAt" => $iso,
    );
  }
  return unique_feedback_items($out);
}

function feedback_payload($mysqli, $discordId) {
  $developer = is_developer_id($mysqli, $discordId);
  return array(
    "ok" => true,
    "developer" => $developer,
    "items" => list_feedback($mysqli, $discordId, $developer),
  );
}

$action = req_get($data, "action");
$discordId = preg_replace("/[^0-9]/", "", req_get($data, "discordId"));
if ($discordId === "") $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discord_id"));
if ($discordId === "") $discordId = preg_replace("/[^0-9]/", "", req_get($_GET, "discordId"));
if ($discordId === "") {
  json_out(array("ok" => false, "error" => "login", "developer" => false, "items" => array()), 401);
}

if ($action === "feedbackUpdate" || $action === "update") {
  if (!is_developer_id($mysqli, $discordId)) {
    json_out(array("ok" => false, "error" => "forbidden", "developer" => false, "items" => array()), 403);
  }
  $itemId = (int) req_get($data, "id");
  $status = feedback_status(req_get($data, "status"));
  if ($itemId <= 0) {
    $payload = feedback_payload($mysqli, $discordId);
    $payload["ok"] = false;
    $payload["error"] = "invalid";
    json_out($payload, 400);
  }
  update_feedback_status($mysqli, $itemId, $status);
}

if ($action === "feedbackCreate" || $action === "create") {
  $kind = feedback_kind(req_get($data, "kind"));
  $title = req_get($data, "title");
  $body = req_get($data, "body");
  $name = req_get($data, "name");
  $channel = feedback_channel(req_get($data, "channel"));
  if (function_exists("mb_substr")) {
    $title = mb_substr($title, 0, 191);
    $name = mb_substr($name, 0, 191);
    $body = mb_substr($body, 0, 4000);
  } else {
    $title = substr($title, 0, 191);
    $name = substr($name, 0, 191);
    $body = substr($body, 0, 4000);
  }
  if (strlen($title) < 3 || strlen($body) < 3) {
    $payload = feedback_payload($mysqli, $discordId);
    $payload["ok"] = false;
    $payload["error"] = "invalid";
    json_out($payload, 400);
  }
  insert_feedback_once($mysqli, $discordId, $name, $kind, $title, $body, $channel);
}

json_out(feedback_payload($mysqli, $discordId));
