<?php
error_reporting(0);
ini_set("display_errors", "0");
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Aries-Key, Authorization");
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

$raw = file_get_contents("php://input") ?: "";
$data = json_decode($raw, true);
if (!is_array($data)) $data = [];

$auth = (string) ($_SERVER["HTTP_AUTHORIZATION"] ?? "");
if (stripos($auth, "Bearer ") === 0) $auth = substr($auth, 7);
$key = (string) (
  $_GET["k"]
  ?? $_GET["key"]
  ?? $data["key"]
  ?? $_SERVER["HTTP_X_ARIES_KEY"]
  ?? $auth
  ?? ""
);
if ($key !== "aries-accounts-v1") {
  http_response_code(403);
  echo json_encode(["error" => "forbidden", "accounts" => [], "roles" => []]);
  exit;
}

function client_ip() {
  $candidates = [
    $_SERVER["HTTP_CF_CONNECTING_IP"] ?? "",
    $_SERVER["HTTP_X_REAL_IP"] ?? "",
    $_SERVER["HTTP_X_FORWARDED_FOR"] ?? "",
    $_SERVER["REMOTE_ADDR"] ?? "",
  ];
  foreach ($candidates as $raw) {
    $first = trim(explode(",", (string) $raw)[0]);
    if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
  }
  return "";
}

function valid_ip($raw) {
  $ip = trim((string) $raw);
  return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : "";
}

function json_out($payload, $code = 200) {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
  exit;
}

$mysqli = @new mysqli("localhost", "host425499_ariespanel", "Wu8BzxevpdGr86f5WrXr", "host425499_ariespanel");
if ($mysqli->connect_errno) {
  json_out(["error" => "db", "accounts" => [], "roles" => []], 500);
}
$mysqli->set_charset("utf8mb4");
$mysqli->query(
  "CREATE TABLE IF NOT EXISTS discord_accounts (
    discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    avatar_url VARCHAR(512) NOT NULL,
    ip VARCHAR(45) NOT NULL DEFAULT '',
    last_login DATETIME NULL DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);
@$mysqli->query("ALTER TABLE discord_accounts ADD COLUMN ip VARCHAR(45) NOT NULL DEFAULT ''");
@$mysqli->query("ALTER TABLE discord_accounts ADD COLUMN last_login DATETIME NULL DEFAULT NULL");
$mysqli->query(
  "CREATE TABLE IF NOT EXISTS account_roles (
    discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(191) NOT NULL DEFAULT '',
    discord VARCHAR(191) NOT NULL DEFAULT '',
    rank VARCHAR(32) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

function normalize_rank($raw) {
  $r = strtolower(trim((string) $raw));
  if (strpos($r, "dev") !== false) return "developer";
  if (strpos($r, "beta") !== false) return "beta";
  return "";
}

function seed_roles($mysqli) {
  $seed = [
    ["1305449847125708811", "Filipek", "filipek_wita", "developer"],
    ["1039967564664676412", "Rysiasty", "rysiowsky", "developer"],
    ["1200264556354752565", "wisniofka", "wisniofka", "beta"],
    ["584315259360247808", "bartssv", "bartssv", "beta"],
    ["352473379326001152", "Dorek", ".dorek.", "beta"],
  ];
  $stmt = $mysqli->prepare(
    "INSERT IGNORE INTO account_roles (discord_id, name, discord, rank) VALUES (?, ?, ?, ?)"
  );
  if (!$stmt) return;
  foreach ($seed as $row) {
    $stmt->bind_param("ssss", $row[0], $row[1], $row[2], $row[3]);
    $stmt->execute();
  }
}

function list_roles($mysqli) {
  $out = [];
  $result = $mysqli->query("SELECT discord_id, name, discord, rank FROM account_roles ORDER BY rank ASC, name ASC");
  if (!$result) return $out;
  while ($row = $result->fetch_assoc()) {
    $out[] = [
      "id" => $row["discord_id"],
      "name" => $row["name"],
      "discord" => $row["discord"],
      "rank" => $row["rank"],
    ];
  }
  return $out;
}

function list_accounts($mysqli) {
  $out = [];
  $result = $mysqli->query(
    "SELECT * FROM discord_accounts ORDER BY COALESCE(last_login, updated_at) DESC, name ASC"
  );
  if (!$result) {
    $result = $mysqli->query("SELECT * FROM discord_accounts ORDER BY name ASC");
  }
  if (!$result) return $out;
  while ($row = $result->fetch_assoc()) {
    $login = $row["last_login"] ?? "";
    if (!$login) $login = $row["updated_at"] ?? "";
    $out[] = [
      "id" => $row["discord_id"],
      "name" => $row["name"],
      "avatarUrl" => $row["avatar_url"] ?? "",
      "ip" => $row["ip"] ?? "",
      "lastLogin" => $login ? date("c", strtotime($login)) : "",
    ];
  }
  return $out;
}

function upsert_account($mysqli, $id, $name, $avatar, $ip) {
  $stmt = $mysqli->prepare(
    "INSERT INTO discord_accounts (discord_id, name, avatar_url, ip, last_login) VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       avatar_url = VALUES(avatar_url),
       ip = IF(VALUES(ip) = '', ip, VALUES(ip)),
       last_login = NOW()"
  );
  if ($stmt) {
    $stmt->bind_param("ssss", $id, $name, $avatar, $ip);
    if ($stmt->execute()) return true;
  }
  $stmt = $mysqli->prepare(
    "INSERT INTO discord_accounts (discord_id, name, avatar_url) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url)"
  );
  if (!$stmt) return false;
  $stmt->bind_param("sss", $id, $name, $avatar);
  if (!$stmt->execute()) return false;
  if ($ip !== "") {
    $upd = $mysqli->prepare("UPDATE discord_accounts SET ip = ? WHERE discord_id = ?");
    if ($upd) {
      $upd->bind_param("ss", $ip, $id);
      $upd->execute();
    }
  }
  $login = $mysqli->prepare("UPDATE discord_accounts SET last_login = NOW() WHERE discord_id = ?");
  if ($login) {
    $login->bind_param("s", $id);
    $login->execute();
  }
  return true;
}

seed_roles($mysqli);

if ($_SERVER["REQUEST_METHOD"] === "POST" && ($data["action"] ?? "") === "setRank") {
  $id = preg_replace("/[^0-9]/", "", (string) ($data["id"] ?? ""));
  $rank = normalize_rank($data["rank"] ?? "");
  $name = trim((string) ($data["name"] ?? ""));
  if ($id === "") {
    json_out(["error" => "invalid", "accounts" => list_accounts($mysqli), "roles" => list_roles($mysqli)], 400);
  }
  if ($rank === "") {
    $stmt = $mysqli->prepare("DELETE FROM account_roles WHERE discord_id = ?");
    $stmt->bind_param("s", $id);
    $stmt->execute();
  } else {
    $stmt = $mysqli->prepare(
      "INSERT INTO account_roles (discord_id, name, discord, rank) VALUES (?, ?, '', ?)
       ON DUPLICATE KEY UPDATE rank = VALUES(rank), name = IF(VALUES(name) = '', name, VALUES(name))"
    );
    $stmt->bind_param("sss", $id, $name, $rank);
    $stmt->execute();
  }
  json_out(["ok" => true, "accounts" => list_accounts($mysqli), "roles" => list_roles($mysqli)]);
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $id = preg_replace("/[^0-9]/", "", (string) ($data["id"] ?? $_GET["id"] ?? ""));
  $name = trim((string) ($data["name"] ?? ""));
  $avatar = trim((string) ($data["avatarUrl"] ?? $data["avatar_url"] ?? ""));
  $ip = valid_ip($data["ip"] ?? "") ?: client_ip();
  if ($id === "" || $name === "") {
    json_out(["error" => "invalid", "accounts" => list_accounts($mysqli), "roles" => list_roles($mysqli)], 400);
  }
  if (function_exists("mb_substr")) {
    $name = mb_substr($name, 0, 191);
  } else {
    $name = substr($name, 0, 191);
  }
  $avatar = substr($avatar, 0, 512);
  upsert_account($mysqli, $id, $name, $avatar, $ip);
}

json_out(["ok" => true, "accounts" => list_accounts($mysqli), "roles" => list_roles($mysqli)]);
