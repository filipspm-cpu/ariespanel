<?php
// aries-accounts-1.0.100
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
    "CREATE TABLE IF NOT EXISTS panel_profiles (
      device_id VARCHAR(64) NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      discord_id VARCHAR(32) NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  $mysqli->query(
    "CREATE TABLE IF NOT EXISTS account_roles (
      discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL DEFAULT '',
      discord VARCHAR(191) NOT NULL DEFAULT '',
      rank VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  $mysqli->query("ALTER TABLE account_roles MODIFY rank VARCHAR(96) NOT NULL");
} catch (Exception $e) {
  /* kolumny mogły już istnieć */
}

function normalize_rank($raw) {
  $r = strtolower(trim((string) $raw));
  $r = str_replace(array("_", " "), "-", $r);
  if ($r === "m-dev" || $r === "mdev" || strpos($r, "main-dev") !== false) return "main-developer";
  if (strpos($r, "dev") !== false) return "developer";
  if (strpos($r, "vip") !== false) return "vip";
  if (strpos($r, "beta") !== false) return "beta";
  return "";
}

function rank_sort_order() {
  return array("main-developer" => 0, "developer" => 1, "vip" => 2, "beta" => 3);
}

function sort_ranks($found) {
  $order = rank_sort_order();
  usort($found, function ($a, $b) use ($order) {
    $aa = isset($order[$a]) ? $order[$a] : 9;
    $bb = isset($order[$b]) ? $order[$b] : 9;
    return $aa - $bb;
  });
  return $found;
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
  $order = rank_sort_order();
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
    if ($n === "" || $n === "main-developer") continue;
    if (!in_array($n, $found, true)) $found[] = $n;
  }
  return sort_ranks($found);
}

function stored_has_main_developer($mysqli, $id) {
  $stmt = $mysqli->prepare("SELECT rank FROM account_roles WHERE discord_id = ? LIMIT 1");
  if (!$stmt) return false;
  $stmt->bind_param("s", $id);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  if (!$row) return false;
  return in_array("main-developer", ranks_from_stored($row["rank"]), true);
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
  $seen = array();
  $result = $mysqli->query("SELECT * FROM discord_accounts ORDER BY name ASC");
  if ($result) {
    while ($row = $result->fetch_assoc()) {
      $id = preg_replace("/\\D+/", "", (string) $row["discord_id"]);
      $name = trim((string) $row["name"]);
      if ($id === "" || $name === "") continue;
      $login = "";
      if (isset($row["last_login"]) && $row["last_login"]) $login = $row["last_login"];
      else if (isset($row["updated_at"]) && $row["updated_at"]) $login = $row["updated_at"];
      $iso = "";
      if ($login) {
        $ts = strtotime($login);
        if ($ts) $iso = date("c", $ts);
      }
      $seen[$id] = true;
      $out[] = array(
        "id" => $id,
        "name" => $name,
        "avatarUrl" => isset($row["avatar_url"]) ? $row["avatar_url"] : "",
        "lastLogin" => $iso,
      );
    }
  }
  $profiles = $mysqli->query("SELECT device_id, discord_id, name, updated_at FROM panel_profiles WHERE name IS NOT NULL AND TRIM(name) <> ''");
  if ($profiles) {
    while ($row = $profiles->fetch_assoc()) {
      $discordId = preg_replace("/\\D+/", "", (string) $row["discord_id"]);
      $deviceId = preg_replace("/[^a-zA-Z0-9_-]/", "", (string) $row["device_id"]);
      $id = $discordId !== "" ? $discordId : $deviceId;
      $name = trim((string) $row["name"]);
      if ($id === "" || $name === "" || isset($seen[$id])) continue;
      $iso = "";
      if ($discordId === "" && isset($row["updated_at"]) && $row["updated_at"]) {
        $ts = strtotime($row["updated_at"]);
        if ($ts) $iso = date("c", $ts);
      }
      $seen[$id] = true;
      $out[] = array(
        "id" => $id,
        "name" => $name,
        "avatarUrl" => "",
        "lastLogin" => $iso,
      );
    }
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
      channel VARCHAR(32) NOT NULL DEFAULT 'other',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_feedback_discord (discord_id),
      INDEX idx_feedback_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  $mysqli->query("ALTER TABLE feedback ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'open'");
  $mysqli->query("ALTER TABLE feedback ADD COLUMN channel VARCHAR(32) NOT NULL DEFAULT 'other'");
}

function ensure_notices_table($mysqli) {
  $mysqli->query(
    "CREATE TABLE IF NOT EXISTS panel_notices (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      kind VARCHAR(16) NOT NULL DEFAULT 'announcement',
      title VARCHAR(191) NOT NULL,
      body TEXT NOT NULL,
      author_id VARCHAR(32) NOT NULL DEFAULT '',
      author_name VARCHAR(191) NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notices_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  $mysqli->query(
    "CREATE TABLE IF NOT EXISTS panel_notice_settings (
      k VARCHAR(32) NOT NULL PRIMARY KEY,
      v VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
}

function notice_setting($mysqli, $key, $default = "") {
  $stmt = $mysqli->prepare("SELECT v FROM panel_notice_settings WHERE k = ? LIMIT 1");
  if (!$stmt) return $default;
  $stmt->bind_param("s", $key);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  if (!$row) return $default;
  return (string) $row["v"];
}

function set_notice_setting($mysqli, $key, $value) {
  $stmt = $mysqli->prepare(
    "INSERT INTO panel_notice_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)"
  );
  if (!$stmt) return;
  $stmt->bind_param("ss", $key, $value);
  $stmt->execute();
}

function notices_popup($mysqli) {
  return notice_setting($mysqli, "popup", "1") !== "0";
}

function notice_kind($raw) {
  $k = strtolower(trim((string) $raw));
  if ($k === "changelog" || $k === "zmiany" || $k === "log") return "changelog";
  return "announcement";
}

function list_notices($mysqli) {
  $out = array();
  $result = $mysqli->query("SELECT id, kind, title, body, author_name, created_at FROM panel_notices ORDER BY created_at DESC, id DESC");
  if (!$result) return $out;
  while ($row = $result->fetch_assoc()) {
    $iso = "";
    if (!empty($row["created_at"])) {
      $ts = strtotime($row["created_at"]);
      if ($ts) $iso = date("c", $ts);
    }
    $out[] = array(
      "id" => (int) $row["id"],
      "kind" => notice_kind($row["kind"]),
      "title" => $row["title"],
      "body" => $row["body"],
      "authorName" => $row["author_name"],
      "createdAt" => $iso,
    );
  }
  return $out;
}

function seed_notices($mysqli) {
  if (notice_setting($mysqli, "seeded", "0") === "1") return;
  $countRes = $mysqli->query("SELECT COUNT(*) AS c FROM panel_notices");
  $countRow = $countRes ? $countRes->fetch_assoc() : null;
  if ($countRow && (int) $countRow["c"] > 0) {
    set_notice_setting($mysqli, "seeded", "1");
    return;
  }
  $stmt = $mysqli->prepare(
    "INSERT INTO panel_notices (kind, title, body, author_id, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  if (!$stmt) return;
  $rows = array(
    array(
      "announcement",
      "Promuj Aries panel",
      "Pokaż ARIES znajomym z serwera. Im więcej osób korzysta z panelu, tym łatwiej trzymać raporty, makra i nakładkę w jednym miejscu.",
      "1305449847125708811",
      "Filipek",
      "2026-09-21 00:00:00",
    ),
    array(
      "changelog",
      "1.0.99",
      "• Na starcie panelu widać changelog i ogłoszenia\n• Main developer dodaje wpisy w zakładce Ogłoszenia",
      "1305449847125708811",
      "Filipek",
      "2026-09-21 00:00:00",
    ),
    array(
      "changelog",
      "1.0.98",
      "• Zakładka Konta znowu pokazuje połączone konta Discord\n• Przy pierwszym uruchomieniu panel pyta o nazwę i zapisuje ją w bazie\n• Sugestie i błędy można kopiować oraz trwale usuwać\n• Asystent forum odpowiada na pytania z regulaminu",
      "1305449847125708811",
      "Filipek",
      "2026-09-20 21:00:00",
    ),
  );
  foreach ($rows as $row) {
    $kind = $row[0];
    $title = $row[1];
    $body = $row[2];
    $authorId = $row[3];
    $authorName = $row[4];
    $created = $row[5];
    $stmt->bind_param("ssssss", $kind, $title, $body, $authorId, $authorName, $created);
    $stmt->execute();
  }
  set_notice_setting($mysqli, "seeded", "1");
}

function notices_payload($mysqli, $discordId = "") {
  ensure_notices_table($mysqli);
  seed_notices($mysqli);
  return array(
    "ok" => true,
    "editor" => stored_has_main_developer($mysqli, $discordId),
    "popup" => notices_popup($mysqli),
    "notices" => list_notices($mysqli),
  );
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
  $deletedKeys = array();
  foreach ($items as $item) {
    $id = (int) $item["id"];
    if (isset($seenId[$id])) continue;
    $seenId[$id] = true;
    $key = $item["discordId"] . "|" . $item["channel"] . "|" . $item["title"] . "|" . $item["body"];
    if (isset($item["status"]) && $item["status"] === "deleted") {
      $deletedKeys[$key] = true;
      continue;
    }
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
  foreach ($order as $key) {
    if (isset($deletedKeys[$key])) continue;
    $out[] = $byKey[$key];
  }
  return $out;
}

function update_feedback_status($mysqli, $itemId, $status) {
  if ($status === "deleted") {
    delete_feedback($mysqli, $itemId);
    return;
  }
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

function delete_feedback($mysqli, $itemId) {
  $row = null;
  $stmt = $mysqli->prepare("SELECT discord_id, channel, title, body FROM feedback WHERE id = ? LIMIT 1");
  if ($stmt) {
    $stmt->bind_param("i", $itemId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
  }
  if ($row) {
    $dup = $mysqli->prepare("DELETE FROM feedback WHERE discord_id = ? AND channel = ? AND title = ? AND body = ?");
    if ($dup) {
      $dup->bind_param("ssss", $row["discord_id"], $row["channel"], $row["title"], $row["body"]);
      $dup->execute();
    }
  }
  $byId = $mysqli->prepare("DELETE FROM feedback WHERE id = ?");
  if ($byId) {
    $byId->bind_param("i", $itemId);
    $byId->execute();
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
      "SELECT id, discord_id, name, kind, title, body, status, channel, created_at FROM feedback WHERE status <> 'deleted' ORDER BY created_at DESC, id DESC LIMIT 250"
    );
  } else {
    $stmt = $mysqli->prepare(
      "SELECT id, discord_id, name, kind, title, body, status, channel, created_at FROM feedback WHERE discord_id = ? AND status <> 'deleted' ORDER BY created_at DESC, id DESC LIMIT 80"
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

try {
  seed_roles($mysqli);
} catch (Exception $e) {
}

try {
  ensure_feedback_table($mysqli);
} catch (Exception $e) {
}

function aries_rw_make_code() {
  $alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  $body = "";
  for ($i = 0; $i < 6; $i++) $body .= $alphabet[random_int(0, strlen($alphabet) - 1)];
  return "ARIES-" . $body;
}

function aries_rw_setup($mysqli) {
  $mysqli->query("CREATE TABLE IF NOT EXISTS promo_codes (
    discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
    code VARCHAR(24) NOT NULL UNIQUE,
    name VARCHAR(191) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $mysqli->query("CREATE TABLE IF NOT EXISTS promo_redemptions (
    discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
    code VARCHAR(24) NOT NULL,
    owner_id VARCHAR(32) NOT NULL,
    amount INT NOT NULL DEFAULT 10000,
    device_id VARCHAR(64) NOT NULL DEFAULT '',
    device_hash VARCHAR(64) NOT NULL DEFAULT '',
    ip VARCHAR(45) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $mysqli->query("CREATE TABLE IF NOT EXISTS reward_claims (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    discord_id VARCHAR(32) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    amount INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reward_user (discord_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $mysqli->query("CREATE TABLE IF NOT EXISTS reward_stats (
    discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(191) NOT NULL DEFAULT '',
    reports INT NOT NULL DEFAULT 0,
    events INT NOT NULL DEFAULT 0,
    online_ms BIGINT NOT NULL DEFAULT 0,
    night_reports INT NOT NULL DEFAULT 0,
    active_days INT NOT NULL DEFAULT 0,
    referrals INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $mysqli->query("ALTER TABLE reward_stats ADD COLUMN referrals INT NOT NULL DEFAULT 0");
  $mysqli->query("ALTER TABLE reward_stats ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  $mysqli->query("CREATE TABLE IF NOT EXISTS achievement_defs (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    label VARCHAR(191) NOT NULL,
    hint VARCHAR(255) NOT NULL DEFAULT '',
    category VARCHAR(32) NOT NULL DEFAULT 'wlasne',
    stat VARCHAR(32) NOT NULL,
    need INT NOT NULL,
    points INT NOT NULL,
    rarity VARCHAR(16) NOT NULL DEFAULT 'brown',
    created_by VARCHAR(32) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function aries_rw_uint($value) {
  if (is_int($value) || is_float($value)) {
    if ($value < 0) return "0";
    return sprintf("%.0f", $value);
  }
  $text = preg_replace("/[^0-9]/", "", (string) $value);
  if ($text === "" || strlen($text) > 18) return "0";
  return $text;
}

function aries_rw_custom_tasks($mysqli) {
  $out = array();
  $result = $mysqli->query("SELECT * FROM achievement_defs ORDER BY created_at ASC");
  if ($result) {
    while ($row = $result->fetch_assoc()) {
      $out[] = array(
        "id" => $row["id"],
        "category" => $row["category"],
        "label" => $row["label"],
        "hint" => $row["hint"],
        "stat" => $row["stat"],
        "need" => (int) $row["need"],
        "points" => (int) $row["points"],
        "rarity" => $row["rarity"],
        "custom" => true,
      );
    }
  }
  return $out;
}

function aries_rw_task_points($mysqli, $stats) {
  $tasks = array(
    array("onlineHours", 40, 20), array("onlineHours", 100, 45), array("onlineHours", 200, 90),
    array("onlineHours", 400, 150), array("onlineHours", 700, 240), array("onlineHours", 1000, 180),
    array("referrals", 1, 100), array("referrals", 2, 160), array("referrals", 5, 280), array("referrals", 10, 450),
    array("activeDays", 14, 25), array("activeDays", 30, 50), array("activeDays", 60, 90), array("activeDays", 120, 160),
  );
  $result = $mysqli->query("SELECT stat, need, points FROM achievement_defs");
  if ($result) {
    while ($row = $result->fetch_assoc()) {
      $tasks[] = array($row["stat"], (int) $row["need"], (int) $row["points"]);
    }
  }
  $sum = 0;
  foreach ($tasks as $task) {
    $key = $task[0];
    if ((int) (isset($stats[$key]) ? $stats[$key] : 0) >= $task[1]) $sum += $task[2];
  }
  return $sum;
}

function aries_rw_builtin_task($id) {
  $tasks = array(
    "duty-40" => array("onlineHours", 40),
    "duty-100" => array("onlineHours", 100),
    "duty-200" => array("onlineHours", 200),
    "duty-400" => array("onlineHours", 400),
    "duty-700" => array("onlineHours", 700),
    "duty-1000" => array("onlineHours", 1000),
    "ref-1" => array("referrals", 1),
    "ref-2" => array("referrals", 2),
    "ref-5" => array("referrals", 5),
    "ref-10" => array("referrals", 10),
    "day-14" => array("activeDays", 14),
    "day-30" => array("activeDays", 30),
    "day-60" => array("activeDays", 60),
    "day-120" => array("activeDays", 120),
  );
  return isset($tasks[$id]) ? $tasks[$id] : null;
}

function aries_rw_money_tier($id) {
  $tiers = array(
    "rank-500" => array(400, 0, "vip"),
    "cash-1500" => array(800, 15000, "cash"),
    "cash-2400" => array(1200, 25000, "cash"),
    "cash-3300" => array(1600, 70000, "cash"),
    "cash-4300" => array(2000, 100000, "cash"),
  );
  return isset($tiers[$id]) ? $tiers[$id] : null;
}

function aries_rw_grant_vip($mysqli, $discordId, $name) {
  $stmt = $mysqli->prepare("SELECT rank FROM account_roles WHERE discord_id = ? LIMIT 1");
  if (!$stmt) return;
  $stmt->bind_param("s", $discordId);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  $rank = $row ? (string) $row["rank"] : "";
  if (stripos($rank, "vip") !== false) return;
  $next = $rank === "" ? "vip" : $rank . ",vip";
  if ($row) {
    $upd = $mysqli->prepare("UPDATE account_roles SET rank = ? WHERE discord_id = ?");
    if ($upd) {
      $upd->bind_param("ss", $next, $discordId);
      $upd->execute();
    }
    return;
  }
  $ins = $mysqli->prepare("INSERT INTO account_roles (discord_id, name, discord, rank) VALUES (?, ?, '', ?)");
  if ($ins) {
    $ins->bind_param("sss", $discordId, $name, $next);
    $ins->execute();
  }
}

function aries_rw_grant_stat($mysqli, $discordId, $name, $stat, $need) {
  $reports = $stat === "reports" ? $need : 0;
  $events = $stat === "events" ? $need : 0;
  $onlineMs = $stat === "onlineHours" ? $need * 3600000 : 0;
  $night = $stat === "nightReports" ? $need : 0;
  $days = $stat === "activeDays" ? $need : 0;
  $refs = $stat === "referrals" ? $need : 0;
  $stmt = $mysqli->prepare(
    "INSERT INTO reward_stats (discord_id, name, reports, events, online_ms, night_reports, active_days, referrals)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       reports = GREATEST(reports, VALUES(reports)),
       events = GREATEST(events, VALUES(events)),
       online_ms = GREATEST(online_ms, VALUES(online_ms)),
       night_reports = GREATEST(night_reports, VALUES(night_reports)),
       active_days = GREATEST(active_days, VALUES(active_days)),
       referrals = GREATEST(referrals, VALUES(referrals))"
  );
  if (!$stmt) return;
  $onlineMsStr = aries_rw_uint($onlineMs);
  $stmt->bind_param("ssiisiii", $discordId, $name, $reports, $events, $onlineMsStr, $night, $days, $refs);
  $stmt->execute();
}

function aries_rw_sync_sql() {
  return "INSERT INTO reward_stats (discord_id, name, reports, events, online_ms, night_reports, active_days)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       reports = GREATEST(reports, VALUES(reports)),
       events = GREATEST(events, VALUES(events)),
       online_ms = GREATEST(online_ms, VALUES(online_ms)),
       night_reports = GREATEST(night_reports, VALUES(night_reports)),
       active_days = GREATEST(active_days + IF(IFNULL(DATE(updated_at), '1970-01-01') < CURDATE(), 1, 0), VALUES(active_days))";
}

function aries_rw_state($mysqli, $discordId) {
  $code = "";
  $stmt = $mysqli->prepare("SELECT code FROM promo_codes WHERE discord_id = ? LIMIT 1");
  if ($stmt) {
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    if ($row) $code = (string) $row["code"];
  }
  $redeemed = false;
  $redeemedCode = "";
  $stmt = $mysqli->prepare("SELECT code FROM promo_redemptions WHERE discord_id = ? LIMIT 1");
  if ($stmt) {
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    if ($row) {
      $redeemed = true;
      $redeemedCode = (string) $row["code"];
    }
  }
  $referrals = 0;
  $stmt = $mysqli->prepare("SELECT COUNT(*) AS c FROM promo_redemptions WHERE owner_id = ?");
  if ($stmt) {
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $referrals = (int) (isset($row["c"]) ? $row["c"] : 0);
  }
  $pending = 0;
  $paid = 0;
  $payouts = array();
  $claimed = array();
  $stmt = $mysqli->prepare("SELECT id, kind, amount, status, created_at FROM reward_claims WHERE discord_id = ? ORDER BY id ASC");
  if ($stmt) {
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($res && ($row = $res->fetch_assoc())) {
      $status = $row["status"] === "paid" ? "paid" : "pending";
      $amount = (int) $row["amount"];
      $payouts[] = array(
        "id" => (int) $row["id"],
        "kind" => $row["kind"],
        "amount" => $amount,
        "status" => $status,
        "createdAt" => $row["created_at"],
      );
      $claimed[] = $row["kind"];
      if ($status === "paid") $paid += $amount;
      else $pending += $amount;
    }
  }
  $stats = array(
    "reports" => 0,
    "events" => 0,
    "onlineHours" => 0,
    "nightReports" => 0,
    "activeDays" => 0,
    "referrals" => $referrals,
  );
  $stmt = $mysqli->prepare("SELECT * FROM reward_stats WHERE discord_id = ? LIMIT 1");
  if ($stmt) {
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    if ($row) {
      $stats["reports"] = (int) $row["reports"];
      $stats["events"] = (int) $row["events"];
      $stats["onlineHours"] = (int) floor(((float) $row["online_ms"]) / 3600000);
      $stats["nightReports"] = (int) $row["night_reports"];
      $stats["activeDays"] = (int) $row["active_days"];
      $grantedRefs = isset($row["referrals"]) ? (int) $row["referrals"] : 0;
      $stats["referrals"] = max($referrals, $grantedRefs);
    }
  }
  $custom = aries_rw_custom_tasks($mysqli);
  return array(
    "ok" => true,
    "statsReady" => true,
    "code" => $code,
    "redeemed" => $redeemed,
    "redeemedCode" => $redeemedCode,
    "referrals" => $stats["referrals"],
    "points" => aries_rw_task_points($mysqli, $stats),
    "stats" => $stats,
    "pendingCash" => $pending,
    "paidCash" => $paid,
    "payouts" => $payouts,
    "claimedKinds" => $claimed,
    "customTasks" => $custom,
    "leaderboard" => array(),
  );
}

function aries_rw_fail($mysqli, $discordId, $error) {
  $state = aries_rw_state($mysqli, $discordId);
  $state["ok"] = false;
  $state["error"] = $error;
  json_out($state);
}

function aries_rw_dispatch($mysqli, $data, $action) {
  aries_rw_setup($mysqli);
  $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discordId"));
  if ($discordId === "") $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discord_id"));
  $name = req_get($data, "name");
  if (function_exists("mb_substr")) $name = mb_substr($name, 0, 191);
  else $name = substr($name, 0, 191);

  if ($action === "rewardsAccounts") {
    $accounts = array();
    $result = $mysqli->query(
      "SELECT a.discord_id AS id,
              COALESCE(NULLIF(d.name, ''), NULLIF(s.name, ''), NULLIF(p.name, ''), a.discord_id) AS name,
              COALESCE(d.avatar_url, '') AS avatar_url
       FROM (
         SELECT discord_id FROM discord_accounts
         UNION SELECT discord_id FROM promo_codes
         UNION SELECT discord_id FROM promo_redemptions
         UNION SELECT owner_id FROM promo_redemptions WHERE owner_id <> ''
         UNION SELECT discord_id FROM reward_stats
         UNION SELECT discord_id FROM reward_claims
       ) a
       LEFT JOIN discord_accounts d ON d.discord_id = a.discord_id
       LEFT JOIN reward_stats s ON s.discord_id = a.discord_id
       LEFT JOIN promo_codes p ON p.discord_id = a.discord_id"
    );
    if ($result) {
      while ($row = $result->fetch_assoc()) {
        $state = aries_rw_state($mysqli, $row["id"]);
        $accounts[] = array(
          "id" => (string) $row["id"],
          "name" => $row["name"],
          "avatarUrl" => $row["avatar_url"],
          "code" => $state["code"],
          "referrals" => $state["referrals"],
          "redeemed" => $state["redeemed"],
          "pendingCash" => $state["pendingCash"],
          "paidCash" => $state["paidCash"],
          "points" => $state["points"],
        );
      }
    }
    usort($accounts, function ($a, $b) {
      if ($a["referrals"] !== $b["referrals"]) return $b["referrals"] - $a["referrals"];
      if ($a["points"] !== $b["points"]) return $b["points"] - $a["points"];
      return strcasecmp($a["name"], $b["name"]);
    });
    json_out(array("ok" => true, "statsReady" => true, "accounts" => $accounts));
  }
  if ($discordId === "") {
    json_out(array("ok" => false, "error" => "login"), 401);
  }

  if ($action === "promoGenerate") {
    $stmt = $mysqli->prepare("SELECT code FROM promo_codes WHERE discord_id = ? LIMIT 1");
    $row = null;
    if ($stmt) {
      $stmt->bind_param("s", $discordId);
      $stmt->execute();
      $res = $stmt->get_result();
      $row = $res ? $res->fetch_assoc() : null;
    }
    if (!$row) {
      for ($i = 0; $i < 8; $i++) {
        $code = aries_rw_make_code();
        $ins = $mysqli->prepare("INSERT INTO promo_codes (discord_id, code, name) VALUES (?, ?, ?)");
        if (!$ins) break;
        $ins->bind_param("sss", $discordId, $code, $name);
        if ($ins->execute()) break;
      }
    } else if ($name !== "") {
      $upd = $mysqli->prepare("UPDATE promo_codes SET name = ? WHERE discord_id = ?");
      if ($upd) {
        $upd->bind_param("ss", $name, $discordId);
        $upd->execute();
      }
    }
    json_out(aries_rw_state($mysqli, $discordId));
  }

  if ($action === "promoRedeem") {
    $code = strtoupper(preg_replace("/\s+/", "", trim(req_get($data, "code"))));
    $state = aries_rw_state($mysqli, $discordId);
    if (!preg_match("/^ARIES-[A-Z0-9]{6}$/", $code)) aries_rw_fail($mysqli, $discordId, "invalid");
    if ($state["code"] === $code) aries_rw_fail($mysqli, $discordId, "own");
    if ($state["redeemed"]) aries_rw_fail($mysqli, $discordId, "used");
    $find = $mysqli->prepare("SELECT discord_id FROM promo_codes WHERE code = ? LIMIT 1");
    if (!$find) aries_rw_fail($mysqli, $discordId, "db");
    $find->bind_param("s", $code);
    $find->execute();
    $res = $find->get_result();
    $owner = $res ? $res->fetch_assoc() : null;
    if (!$owner) aries_rw_fail($mysqli, $discordId, "missing");
    $ownerId = $owner["discord_id"];
    $enterAmount = 10000;
    $ownerAmount = 20000;
    $deviceId = preg_replace("/[^a-zA-Z0-9_-]/", "", req_get($data, "deviceId"));
    $deviceHash = preg_replace("/[^a-zA-Z0-9_-]/", "", req_get($data, "deviceHash"));
    $ins = $mysqli->prepare("INSERT INTO promo_redemptions (discord_id, code, owner_id, amount, device_id, device_hash) VALUES (?, ?, ?, ?, ?, ?)");
    if ($ins) {
      $ins->bind_param("sssiss", $discordId, $code, $ownerId, $enterAmount, $deviceId, $deviceHash);
      if (!$ins->execute()) aries_rw_fail($mysqli, $discordId, "device");
    } else {
      $fallback = $mysqli->prepare("INSERT INTO promo_redemptions (discord_id, code, owner_id, amount) VALUES (?, ?, ?, ?)");
      if (!$fallback) aries_rw_fail($mysqli, $discordId, "db");
      $fallback->bind_param("sssi", $discordId, $code, $ownerId, $enterAmount);
      if (!$fallback->execute()) aries_rw_fail($mysqli, $discordId, "db");
    }
    $claim = $mysqli->prepare("INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, ?, ?, 'pending')");
    if ($claim) {
      $kind = "promo";
      $claim->bind_param("ssi", $ownerId, $kind, $ownerAmount);
      $claim->execute();
      $kind = "promo-enter";
      $claim->bind_param("ssi", $discordId, $kind, $enterAmount);
      $claim->execute();
    }
    $next = aries_rw_state($mysqli, $discordId);
    $next["ok"] = true;
    json_out($next);
  }

  if ($action === "rewardsSync") {
    $reports = max(0, (int) req_get($data, "reports"));
    $events = max(0, (int) req_get($data, "events"));
    $onlineMsStr = aries_rw_uint(isset($data["onlineMs"]) ? $data["onlineMs"] : 0);
    $night = max(0, (int) req_get($data, "nightReports"));
    $days = max(0, (int) req_get($data, "activeDays"));
    $stmt = $mysqli->prepare(aries_rw_sync_sql());
    if ($stmt) {
      $stmt->bind_param("ssiisii", $discordId, $name, $reports, $events, $onlineMsStr, $night, $days);
      $stmt->execute();
    }
  }

  if ($action === "rewardsClaim") {
    $kind = req_get($data, "kind");
    $tier = aries_rw_money_tier($kind);
    $state = aries_rw_state($mysqli, $discordId);
    if (!$tier) aries_rw_fail($mysqli, $discordId, "invalid");
    if ($state["points"] < $tier[0]) aries_rw_fail($mysqli, $discordId, "points");
    if (in_array($kind, $state["claimedKinds"], true)) aries_rw_fail($mysqli, $discordId, "claimed");
    $amount = $tier[1];
    $vip = isset($tier[2]) && $tier[2] === "vip";
    $status = $vip ? "paid" : "pending";
    if ($vip) aries_rw_grant_vip($mysqli, $discordId, $name);
    $ins = $mysqli->prepare("INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, ?, ?, ?)");
    if ($ins) {
      $ins->bind_param("ssis", $discordId, $kind, $amount, $status);
      $ins->execute();
    }
  }

  if ($action === "rewardsPaid") {
    if (!is_developer_id($mysqli, $discordId)) {
      json_out(array("ok" => false, "error" => "forbidden"), 403);
    }
    $target = preg_replace("/[^0-9]/", "", req_get($data, "targetId"));
    if ($target !== "") {
      $upd = $mysqli->prepare("UPDATE reward_claims SET status = 'paid' WHERE discord_id = ? AND status = 'pending'");
      if ($upd) {
        $upd->bind_param("s", $target);
        $upd->execute();
      }
    }
  }

  if ($action === "rewardsDefine") {
    if (!is_developer_id($mysqli, $discordId)) {
      json_out(array("ok" => false, "error" => "forbidden"), 403);
    }
    $label = substr(trim(req_get($data, "label")), 0, 80);
    if (strlen($label) < 2) aries_rw_fail($mysqli, $discordId, "invalid");
    $id = "custom-" . uniqid();
    $hint = substr(trim(req_get($data, "hint")), 0, 255);
    $category = req_get($data, "category");
    if ($category === "") $category = "wlasne";
    $stat = req_get($data, "stat");
    if ($stat === "") $stat = "onlineHours";
    $need = max(1, (int) req_get($data, "need"));
    $points = max(1, min(5000, (int) req_get($data, "points")));
    $rarity = req_get($data, "rarity");
    if ($rarity === "") $rarity = "brown";
    $ins = $mysqli->prepare("INSERT INTO achievement_defs (id, label, hint, category, stat, need, points, rarity, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    if ($ins) {
      $ins->bind_param("sssssiiss", $id, $label, $hint, $category, $stat, $need, $points, $rarity, $discordId);
      $ins->execute();
    }
  }

  if ($action === "rewardsUndefine") {
    if (!is_developer_id($mysqli, $discordId)) {
      json_out(array("ok" => false, "error" => "forbidden"), 403);
    }
    $id = req_get($data, "id");
    if (strpos($id, "custom-") === 0) {
      $del = $mysqli->prepare("DELETE FROM achievement_defs WHERE id = ?");
      if ($del) {
        $del->bind_param("s", $id);
        $del->execute();
      }
    }
  }

  if ($action === "rewardsGrant") {
    if (!is_developer_id($mysqli, $discordId)) {
      json_out(array("ok" => false, "error" => "forbidden"), 403);
    }
    $id = req_get($data, "id");
    $task = aries_rw_builtin_task($id);
    if (!$task) {
      $stmt = $mysqli->prepare("SELECT stat, need FROM achievement_defs WHERE id = ? LIMIT 1");
      if ($stmt) {
        $stmt->bind_param("s", $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        if ($row) $task = array($row["stat"], (int) $row["need"]);
      }
    }
    if (!$task) aries_rw_fail($mysqli, $discordId, "invalid");
    aries_rw_grant_stat($mysqli, $discordId, $name, $task[0], $task[1]);
  }

  json_out(aries_rw_state($mysqli, $discordId));
}

$action = req_get($data, "action");
if ($action === "") $action = req_get($_GET, "action");
if ($action === "noticesList" || $action === "noticesCreate" || $action === "noticesDelete" || $action === "noticesSetPopup") {
  $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discordId"));
  if ($discordId === "") $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discord_id"));
  if ($discordId === "") $discordId = preg_replace("/[^0-9]/", "", req_get($_GET, "discordId"));
  if ($action === "noticesList") {
    json_out(notices_payload($mysqli, $discordId));
  }
  if ($method !== "POST") {
    json_out(array("ok" => false, "error" => "method", "editor" => false, "notices" => list_notices($mysqli)), 405);
  }
  if ($discordId === "") {
    json_out(array("ok" => false, "error" => "login", "editor" => false, "notices" => list_notices($mysqli)), 401);
  }
  if (!stored_has_main_developer($mysqli, $discordId)) {
    $payload = notices_payload($mysqli, $discordId);
    $payload["ok"] = false;
    $payload["error"] = "forbidden";
    json_out($payload, 403);
  }
  ensure_notices_table($mysqli);
  if ($action === "noticesSetPopup") {
    $popup = req_get($data, "popup");
    $enabled = !($popup === "0" || $popup === "false" || $popup === "");
    if (isset($data["popup"]) && ($data["popup"] === false || $data["popup"] === 0 || $data["popup"] === "0")) $enabled = false;
    if (isset($data["popup"]) && ($data["popup"] === true || $data["popup"] === 1 || $data["popup"] === "1")) $enabled = true;
    set_notice_setting($mysqli, "popup", $enabled ? "1" : "0");
    json_out(notices_payload($mysqli, $discordId));
  }
  if ($action === "noticesDelete") {
    $itemId = (int) req_get($data, "id");
    $title = req_get($data, "title");
    if ($itemId === 0 && $title === "") {
      $payload = notices_payload($mysqli, $discordId);
      $payload["ok"] = false;
      $payload["error"] = "invalid";
      json_out($payload, 400);
    }
    if ($itemId !== 0) {
      $stmt = $mysqli->prepare("DELETE FROM panel_notices WHERE id = ?");
      if ($stmt) {
        $stmt->bind_param("i", $itemId);
        $stmt->execute();
      }
    }
    if ($title !== "") {
      $stmt = $mysqli->prepare("DELETE FROM panel_notices WHERE title = ?");
      if ($stmt) {
        $stmt->bind_param("s", $title);
        $stmt->execute();
      }
    }
    json_out(notices_payload($mysqli, $discordId));
  }
  $kind = notice_kind(req_get($data, "kind"));
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
    $payload = notices_payload($mysqli, $discordId);
    $payload["ok"] = false;
    $payload["error"] = "invalid";
    json_out($payload, 400);
  }
  $stmt = $mysqli->prepare("INSERT INTO panel_notices (kind, title, body, author_id, author_name) VALUES (?, ?, ?, ?, ?)");
  if ($stmt) {
    $stmt->bind_param("sssss", $kind, $title, $body, $discordId, $name);
    $stmt->execute();
  }
  json_out(notices_payload($mysqli, $discordId));
}

function faction_ids() {
  return array(
    "lspd",
    "ems",
    "lscsd",
    "sang",
    "gov",
    "wn",
    "fib",
    "ballas",
    "vagos",
    "families",
    "bloods",
    "marabunta",
  );
}

function ensure_factions_table($mysqli) {
  $mysqli->query(
    "CREATE TABLE IF NOT EXISTS panel_factions (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      leader VARCHAR(64) NOT NULL DEFAULT '',
      frozen TINYINT NOT NULL DEFAULT 0,
      updated_by VARCHAR(191) NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
}

function factions_payload($mysqli, $discordId = "") {
  ensure_factions_table($mysqli);
  $stored = array();
  $result = $mysqli->query("SELECT id, leader, frozen, updated_at FROM panel_factions");
  if ($result) {
    while ($row = $result->fetch_assoc()) {
      $iso = "";
      if (!empty($row["updated_at"])) {
        $ts = strtotime($row["updated_at"]);
        if ($ts) $iso = date("c", $ts);
      }
      $stored[$row["id"]] = array(
        "leader" => (string) $row["leader"],
        "frozen" => ((int) $row["frozen"]) === 1,
        "updatedAt" => $iso,
      );
    }
  }
  $out = array();
  foreach (faction_ids() as $id) {
    $row = isset($stored[$id]) ? $stored[$id] : null;
    $out[] = array(
      "id" => $id,
      "leader" => $row ? $row["leader"] : "",
      "frozen" => $row ? $row["frozen"] : false,
      "updatedAt" => $row ? $row["updatedAt"] : "",
    );
  }
  return array(
    "ok" => true,
    "editor" => stored_has_main_developer($mysqli, $discordId),
    "factions" => $out,
  );
}

if ($action === "factionsList" || $action === "factionsSave") {
  $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discordId"));
  if ($discordId === "") $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discord_id"));
  if ($discordId === "") $discordId = preg_replace("/[^0-9]/", "", req_get($_GET, "discordId"));
  if ($action === "factionsList") {
    json_out(factions_payload($mysqli, $discordId));
  }
  if ($method !== "POST") {
    json_out(array("ok" => false, "error" => "method", "editor" => false, "factions" => array()), 405);
  }
  if ($discordId === "") {
    $payload = factions_payload($mysqli, $discordId);
    $payload["ok"] = false;
    $payload["error"] = "login";
    json_out($payload, 401);
  }
  if (!stored_has_main_developer($mysqli, $discordId)) {
    $payload = factions_payload($mysqli, $discordId);
    $payload["ok"] = false;
    $payload["error"] = "forbidden";
    json_out($payload, 403);
  }
  $id = strtolower(trim(req_get($data, "id")));
  if (!in_array($id, faction_ids(), true)) {
    $payload = factions_payload($mysqli, $discordId);
    $payload["ok"] = false;
    $payload["error"] = "invalid";
    json_out($payload, 400);
  }
  $leader = trim(req_get($data, "leader"));
  $leader = preg_replace("/[\\r\\n\\t]+/", " ", $leader);
  if (function_exists("mb_substr")) $leader = mb_substr($leader, 0, 64);
  else $leader = substr($leader, 0, 64);
  $frozen = false;
  if (isset($data["frozen"]) && ($data["frozen"] === true || $data["frozen"] === 1 || $data["frozen"] === "1" || $data["frozen"] === "true")) {
    $frozen = true;
  }
  $flag = $frozen ? 1 : 0;
  $name = req_get($data, "name");
  if (function_exists("mb_substr")) $name = mb_substr($name, 0, 191);
  else $name = substr($name, 0, 191);
  ensure_factions_table($mysqli);
  $stmt = $mysqli->prepare(
    "INSERT INTO panel_factions (id, leader, frozen, updated_by) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE leader = VALUES(leader), frozen = VALUES(frozen), updated_by = VALUES(updated_by)"
  );
  if ($stmt) {
    $stmt->bind_param("ssis", $id, $leader, $flag, $name);
    $stmt->execute();
  }
  json_out(factions_payload($mysqli, $discordId));
}

if ($method === "POST" && $action === "profileSave") {
  $deviceId = preg_replace("/[^a-zA-Z0-9_-]/", "", req_get($data, "deviceId"));
  $name = req_get($data, "name");
  $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discordId"));
  if (function_exists("mb_substr")) $name = mb_substr($name, 0, 32);
  else $name = substr($name, 0, 32);
  if (strlen($deviceId) < 8 || strlen($name) < 2) {
    json_out(array("ok" => false, "error" => "invalid"), 400);
  }
  $stmt = $mysqli->prepare(
    "INSERT INTO panel_profiles (device_id, name, discord_id) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), discord_id = IF(VALUES(discord_id) = '', discord_id, VALUES(discord_id))"
  );
  if ($stmt) {
    $stmt->bind_param("sss", $deviceId, $name, $discordId);
    $stmt->execute();
  }
  if ($discordId !== "") {
    upsert_account($mysqli, $discordId, $name, "");
    $rw = $mysqli->prepare("UPDATE reward_stats SET name = ? WHERE discord_id = ?");
    if ($rw) {
      $rw->bind_param("ss", $name, $discordId);
      $rw->execute();
    }
  }
  json_out(array("ok" => true, "name" => $name));
}
if ($method === "POST" && preg_match("/^(promoGenerate|promoRedeem|rewardsState|rewardsSync|rewardsClaim|rewardsPaid|rewardsDefine|rewardsUndefine|rewardsGrant|rewardsAccounts)$/", $action)) {
  aries_rw_dispatch($mysqli, $data, $action);
}

if ($method === "POST" && $action === "setRank") {
  $id = preg_replace("/[^0-9]/", "", req_get($data, "id"));
  $name = req_get($data, "name");
  if ($id === "") {
    json_out(array("error" => "invalid", "accounts" => list_accounts($mysqli), "roles" => list_roles($mysqli)), 400);
  }
  $ranks = collect_ranks($data);
  if (stored_has_main_developer($mysqli, $id) && !in_array("main-developer", $ranks, true)) {
    array_unshift($ranks, "main-developer");
    $ranks = sort_ranks($ranks);
  }
  $rank = implode(",", $ranks);
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
