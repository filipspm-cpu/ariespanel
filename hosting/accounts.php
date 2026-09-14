<?php
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
  $err = error_get_last();
  $detail = is_array($err) ? $err["message"] : "fatal";
  echo json_encode(array("error" => "php", "detail" => $detail, "accounts" => array(), "roles" => array()));
});

$raw = file_get_contents("php://input");
if ($raw === false) $raw = "";
$data = json_decode($raw, true);
if (!is_array($data)) $data = [];

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
    req_get($_GET, "aries"),
    req_get($_GET, "k"),
    req_get($_GET, "key"),
    req_get($data, "key"),
    req_get($data, "token"),
    isset($_SERVER["HTTP_X_ARIES_KEY"]) ? trim((string) $_SERVER["HTTP_X_ARIES_KEY"]) : "",
    isset($_SERVER["HTTP_X_ARIES_TOKEN"]) ? trim((string) $_SERVER["HTTP_X_ARIES_TOKEN"]) : "",
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
  http_response_code((int) $code);
  $flags = 0;
  if (defined("JSON_UNESCAPED_UNICODE")) $flags |= JSON_UNESCAPED_UNICODE;
  echo json_encode($payload, $flags);
  exit;
}

$authorized = key_ok($data, $auth);
$method = strtoupper(isset($_SERVER["REQUEST_METHOD"]) ? (string) $_SERVER["REQUEST_METHOD"] : "GET");
if ($method !== "GET" && !$authorized) {
  json_out(array("error" => "forbidden", "accounts" => array(), "roles" => array()), 403);
}

try {
  $mysqli = @new mysqli("localhost", "host425499_ariespanel", "Wu8BzxevpdGr86f5WrXr", "host425499_ariespanel");
} catch (Exception $e) {
  json_out(array("error" => "db", "detail" => $e->getMessage(), "accounts" => array(), "roles" => array()), 200);
}
if (!$mysqli || $mysqli->connect_errno) {
  json_out(array("error" => "db", "accounts" => array(), "roles" => array()), 200);
}
$mysqli->set_charset("utf8mb4");
try {
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
  $mysqli->query("ALTER TABLE discord_accounts ADD COLUMN ip VARCHAR(45) NOT NULL DEFAULT ''");
  $mysqli->query("ALTER TABLE discord_accounts ADD COLUMN last_login DATETIME NULL DEFAULT NULL");
  $mysqli->query(
    "CREATE TABLE IF NOT EXISTS account_roles (
      discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL DEFAULT '',
      discord VARCHAR(191) NOT NULL DEFAULT '',
      rank VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
} catch (Exception $e) {
  /* kolumny mogły już istnieć */
}

function normalize_rank($raw) {
  $r = strtolower(trim((string) $raw));
  if (strpos($r, "dev") !== false) return "developer";
  if (strpos($r, "beta") !== false) return "beta";
  return "";
}

function seed_roles($mysqli) {
  $countRes = $mysqli->query("SELECT COUNT(*) AS c FROM account_roles");
  $countRow = $countRes ? $countRes->fetch_assoc() : null;
  if ((int) (isset($countRow["c"]) ? $countRow["c"] : 0) > 0) return;
  $seed = array(
    array("1305449847125708811", "Filipek", "filipek_wita", "developer"),
    array("1039967564664676412", "Rysiasty", "rysiowsky", "developer"),
  );
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
  $out = array();
  $result = $mysqli->query("SELECT discord_id, name, discord, rank FROM account_roles ORDER BY rank ASC, name ASC");
  if (!$result) return $out;
  while ($row = $result->fetch_assoc()) {
    $out[] = array(
      "id" => $row["discord_id"],
      "name" => $row["name"],
      "discord" => $row["discord"],
      "rank" => $row["rank"],
    );
  }
  return $out;
}

function list_accounts($mysqli) {
  $out = array();
  $result = $mysqli->query("SELECT * FROM discord_accounts ORDER BY name ASC");
  if (!$result) return $out;
  while ($row = $result->fetch_assoc()) {
    $login = "";
    if (isset($row["last_login"]) && $row["last_login"]) $login = $row["last_login"];
    else if (isset($row["updated_at"]) && $row["updated_at"]) $login = $row["updated_at"];
    $iso = "";
    if ($login) {
      $ts = strtotime($login);
      if ($ts) $iso = date("c", $ts);
    }
    $out[] = array(
      "id" => $row["discord_id"],
      "name" => $row["name"],
      "avatarUrl" => isset($row["avatar_url"]) ? $row["avatar_url"] : "",
      "lastLogin" => $iso,
    );
  }
  return $out;
}

function upsert_account($mysqli, $id, $name, $avatar) {
  $stmt = $mysqli->prepare(
    "INSERT INTO discord_accounts (discord_id, name, avatar_url, ip, last_login) VALUES (?, ?, ?, '', NOW())
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       avatar_url = VALUES(avatar_url),
       ip = '',
       last_login = NOW()"
  );
  if ($stmt) {
    $stmt->bind_param("sss", $id, $name, $avatar);
    if ($stmt->execute()) return true;
  }
  $stmt = $mysqli->prepare(
    "INSERT INTO discord_accounts (discord_id, name, avatar_url) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url)"
  );
  if (!$stmt) return false;
  $stmt->bind_param("sss", $id, $name, $avatar);
  if (!$stmt->execute()) return false;
  $clear = $mysqli->prepare("UPDATE discord_accounts SET ip = '' WHERE discord_id = ?");
  if ($clear) {
    $clear->bind_param("s", $id);
    $clear->execute();
  }
  $login = $mysqli->prepare("UPDATE discord_accounts SET last_login = NOW() WHERE discord_id = ?");
  if ($login) {
    $login->bind_param("s", $id);
    $login->execute();
  }
  return true;
}

try {
  seed_roles($mysqli);
} catch (Exception $e) {
}

$action = req_get($data, "action");
if ($method === "POST" && $action === "setRank") {
  $id = preg_replace("/[^0-9]/", "", req_get($data, "id"));
  $rank = normalize_rank(req_get($data, "rank"));
  $name = req_get($data, "name");
  if ($id === "") {
    json_out(array("error" => "invalid", "accounts" => list_accounts($mysqli), "roles" => list_roles($mysqli)), 400);
  }
  if ($rank === "") {
    $stmt = $mysqli->prepare("DELETE FROM account_roles WHERE discord_id = ?");
    if ($stmt) {
      $stmt->bind_param("s", $id);
      $stmt->execute();
    }
  } else {
    $stmt = $mysqli->prepare(
      "INSERT INTO account_roles (discord_id, name, discord, rank) VALUES (?, ?, '', ?)
       ON DUPLICATE KEY UPDATE rank = VALUES(rank), name = IF(VALUES(name) = '', name, VALUES(name))"
    );
    if ($stmt) {
      $stmt->bind_param("sss", $id, $name, $rank);
      $stmt->execute();
    }
  }
  json_out(array("ok" => true, "accounts" => list_accounts($mysqli), "roles" => list_roles($mysqli)));
}

if ($method === "POST") {
  $id = preg_replace("/[^0-9]/", "", req_get($data, "id"));
  if ($id === "") $id = preg_replace("/[^0-9]/", "", req_get($_GET, "id"));
  $name = req_get($data, "name");
  $avatar = req_get($data, "avatarUrl");
  if ($avatar === "") $avatar = req_get($data, "avatar_url");
  if ($id === "" || $name === "") {
    json_out(array("error" => "invalid", "accounts" => list_accounts($mysqli), "roles" => list_roles($mysqli)), 400);
  }
  if (function_exists("mb_substr")) {
    $name = mb_substr($name, 0, 191);
  } else {
    $name = substr($name, 0, 191);
  }
  $avatar = substr($avatar, 0, 512);
  upsert_account($mysqli, $id, $name, $avatar);
}

json_out(array("ok" => true, "accounts" => list_accounts($mysqli), "roles" => list_roles($mysqli)));
