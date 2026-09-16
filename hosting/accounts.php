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
  while (function_exists("ob_get_level") && ob_get_level() > 0) {
    @ob_end_clean();
  }
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
      rank VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  $mysqli->query("ALTER TABLE account_roles MODIFY rank VARCHAR(64) NOT NULL");
} catch (Exception $e) {
  /* kolumny mogły już istnieć */
}

function normalize_rank($raw) {
  $r = strtolower(trim((string) $raw));
  if (strpos($r, "dev") !== false) return "developer";
  if (strpos($r, "vip") !== false) return "vip";
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

function ranks_from_stored($raw) {
  $found = array();
  $parts = preg_split("/[,|\\/]+/", strtolower(trim((string) $raw)));
  if (!is_array($parts)) $parts = array();
  foreach ($parts as $p) {
    $n = normalize_rank($p);
    if ($n !== "" && !in_array($n, $found, true)) $found[] = $n;
  }
  if (!$found) {
    $n = normalize_rank($raw);
    if ($n !== "") $found[] = $n;
  }
  $order = array("developer" => 0, "vip" => 1, "beta" => 2);
  usort($found, function ($a, $b) use ($order) {
    $aa = isset($order[$a]) ? $order[$a] : 9;
    $bb = isset($order[$b]) ? $order[$b] : 9;
    return $aa - $bb;
  });
  return $found;
}

function collect_ranks($data) {
  $raw = array();
  if (isset($data["ranks"]) && is_array($data["ranks"])) {
    foreach ($data["ranks"] as $item) $raw[] = (string) $item;
  }
  $s = req_get($data, "rank");
  if ($s !== "") {
    foreach (preg_split("/[,|\\/\\s]+/", $s) as $item) {
      if (trim($item) !== "") $raw[] = $item;
    }
  }
  $found = array();
  foreach ($raw as $item) {
    $n = normalize_rank($item);
    if ($n !== "" && !in_array($n, $found, true)) $found[] = $n;
  }
  $order = array("developer" => 0, "vip" => 1, "beta" => 2);
  usort($found, function ($a, $b) use ($order) {
    $aa = isset($order[$a]) ? $order[$a] : 9;
    $bb = isset($order[$b]) ? $order[$b] : 9;
    return $aa - $bb;
  });
  return $found;
}

function list_roles($mysqli) {
  $out = array();
  $result = $mysqli->query("SELECT discord_id, name, discord, rank FROM account_roles ORDER BY rank ASC, name ASC");
  if (!$result) return $out;
  while ($row = $result->fetch_assoc()) {
    $ranks = ranks_from_stored($row["rank"]);
    $out[] = array(
      "id" => $row["discord_id"],
      "name" => $row["name"],
      "discord" => $row["discord"],
      "rank" => implode(",", $ranks),
      "ranks" => $ranks,
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

function ensure_feedback_table($mysqli) {
  $mysqli->query(
    "CREATE TABLE IF NOT EXISTS feedback (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      discord_id VARCHAR(32) NOT NULL,
      name VARCHAR(191) NOT NULL DEFAULT '',
      kind VARCHAR(16) NOT NULL DEFAULT 'bug',
      title VARCHAR(191) NOT NULL,
      body TEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_feedback_discord (discord_id),
      INDEX idx_feedback_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  $mysqli->query("ALTER TABLE feedback ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'open'");
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
    $key = $item["discordId"] . "|" . $item["title"] . "|" . $item["body"];
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
       ON f.discord_id = src.discord_id AND f.title = src.title AND f.body = src.body
     SET f.status = ?
     WHERE src.id = ?"
  );
  if ($dup) {
    $dup->bind_param("si", $status, $itemId);
    $dup->execute();
  }
}

function insert_feedback_once($mysqli, $discordId, $name, $kind, $title, $body) {
  $stmt = $mysqli->prepare(
    "SELECT id FROM feedback WHERE discord_id = ? AND title = ? AND body = ? AND created_at >= (NOW() - INTERVAL 5 MINUTE) ORDER BY id DESC LIMIT 1"
  );
  if ($stmt) {
    $stmt->bind_param("sss", $discordId, $title, $body);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res && $res->fetch_assoc()) return;
  }
  $ins = $mysqli->prepare(
    "INSERT INTO feedback (discord_id, name, kind, title, body) VALUES (?, ?, ?, ?, ?)"
  );
  if ($ins) {
    $ins->bind_param("sssss", $discordId, $name, $kind, $title, $body);
    $ins->execute();
  }
}

function list_feedback($mysqli, $discordId, $developer) {
  $out = array();
  if ($developer) {
    $result = $mysqli->query(
      "SELECT id, discord_id, name, kind, title, body, status, created_at FROM feedback ORDER BY created_at DESC, id DESC LIMIT 250"
    );
  } else {
    $stmt = $mysqli->prepare(
      "SELECT id, discord_id, name, kind, title, body, status, created_at FROM feedback WHERE discord_id = ? ORDER BY created_at DESC, id DESC LIMIT 80"
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

try {
  seed_roles($mysqli);
} catch (Exception $e) {
}

try {
  ensure_feedback_table($mysqli);
} catch (Exception $e) {
}

$action = req_get($data, "action");
if ($method === "POST" && $action === "setRank") {
  $id = preg_replace("/[^0-9]/", "", req_get($data, "id"));
  $ranks = collect_ranks($data);
  $rank = implode(",", $ranks);
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

if ($method === "POST" && ($action === "feedbackList" || $action === "feedbackCreate" || $action === "feedbackUpdate")) {
  $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discordId"));
  if ($discordId === "") $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discord_id"));
  if ($discordId === "") {
    json_out(array("ok" => false, "error" => "login", "developer" => false, "items" => array()), 401);
  }
  if ($action === "feedbackUpdate") {
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
  if ($action === "feedbackCreate") {
    $kind = feedback_kind(req_get($data, "kind"));
    $title = req_get($data, "title");
    $body = req_get($data, "body");
    $name = req_get($data, "name");
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
    insert_feedback_once($mysqli, $discordId, $name, $kind, $title, $body);
  }
  json_out(feedback_payload($mysqli, $discordId));
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
