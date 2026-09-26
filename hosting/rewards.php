<?php
// aries-rewards-1.0.96
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
  echo json_encode(array("ok" => false, "error" => "php"));
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
  json_out(array("ok" => false, "error" => "forbidden"), 403);
}

try {
  $mysqli = @new mysqli("localhost", "host425499_ariespanel", "Wu8BzxevpdGr86f5WrXr", "host425499_ariespanel");
} catch (Exception $e) {
  json_out(array("ok" => false, "error" => "db"), 200);
}
if (!$mysqli || $mysqli->connect_errno) {
  json_out(array("ok" => false, "error" => "db"), 200);
}
$mysqli->set_charset("utf8mb4");

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
  amount INT NOT NULL DEFAULT 30000,
  device_id VARCHAR(64) NOT NULL DEFAULT '',
  device_hash VARCHAR(64) NOT NULL DEFAULT '',
  ip VARCHAR(45) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_promo_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$mysqli->query("ALTER TABLE promo_redemptions ADD COLUMN device_id VARCHAR(64) NOT NULL DEFAULT ''");
$mysqli->query("ALTER TABLE promo_redemptions ADD COLUMN device_hash VARCHAR(64) NOT NULL DEFAULT ''");
$mysqli->query("ALTER TABLE promo_redemptions ADD COLUMN ip VARCHAR(45) NOT NULL DEFAULT ''");
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
$mysqli->query("CREATE TABLE IF NOT EXISTS reward_claims (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  discord_id VARCHAR(32) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reward_user (discord_id),
  INDEX idx_reward_claim_kind (discord_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$mysqli->query("ALTER TABLE reward_claims DROP INDEX uniq_reward_claim");
$mysqli->query("ALTER TABLE reward_claims ADD INDEX idx_reward_claim_kind (discord_id, kind)");
$mysqli->query(
  "UPDATE reward_claims AS c
   INNER JOIN promo_redemptions AS r
     ON r.discord_id = c.discord_id AND c.kind = 'promo'
   SET c.discord_id = r.owner_id
   WHERE c.status = 'pending'
     AND r.owner_id <> ''
     AND r.owner_id <> c.discord_id"
);
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

function client_ip() {
  $candidates = array();
  if (!empty($_SERVER["HTTP_CF_CONNECTING_IP"])) $candidates[] = $_SERVER["HTTP_CF_CONNECTING_IP"];
  if (!empty($_SERVER["HTTP_X_FORWARDED_FOR"])) {
    foreach (explode(",", $_SERVER["HTTP_X_FORWARDED_FOR"]) as $part) $candidates[] = trim($part);
  }
  if (!empty($_SERVER["HTTP_X_REAL_IP"])) $candidates[] = $_SERVER["HTTP_X_REAL_IP"];
  if (!empty($_SERVER["REMOTE_ADDR"])) $candidates[] = $_SERVER["REMOTE_ADDR"];
  foreach ($candidates as $ip) {
    $ip = trim((string) $ip);
    if ($ip === "") continue;
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return $ip;
  }
  return "";
}

function norm_device($raw) {
  $value = preg_replace("/[^a-zA-Z0-9_-]/", "", (string) $raw);
  if (strlen($value) < 8) return "";
  if (strlen($value) > 64) return substr($value, 0, 64);
  return $value;
}

function fail_state($mysqli, $discordId, $error) {
  $state = read_state($mysqli, $discordId);
  $state["ok"] = false;
  $state["error"] = $error;
  json_out($state);
}

function device_taken($mysqli, $discordId, $deviceId, $deviceHash, $ip) {
  $checks = array($deviceId, $deviceHash, $ip);
  $sqls = array(
    "SELECT discord_id FROM promo_redemptions WHERE device_id <> '' AND device_id = ? LIMIT 1",
    "SELECT discord_id FROM promo_redemptions WHERE device_hash <> '' AND device_hash = ? LIMIT 1",
    "SELECT discord_id FROM promo_redemptions WHERE ip <> '' AND ip = ? LIMIT 1",
  );
  for ($i = 0; $i < 3; $i++) {
    $value = $checks[$i];
    if ($value === "") continue;
    $stmt = $mysqli->prepare($sqls[$i]);
    if (!$stmt) continue;
    $stmt->bind_param("s", $value);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    if ($row && (string) $row["discord_id"] !== $discordId) return true;
  }
  return false;
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

function make_code() {
  $alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  $body = "";
  for ($i = 0; $i < 6; $i++) $body .= $alphabet[random_int(0, strlen($alphabet) - 1)];
  return "ARIES-" . $body;
}

function normalize_code($raw) {
  return strtoupper(preg_replace("/\s+/", "", trim((string) $raw)));
}

function uint_str($value) {
  if (is_int($value) || is_float($value)) {
    if ($value < 0) return "0";
    return sprintf("%.0f", $value);
  }
  $text = preg_replace("/[^0-9]/", "", (string) $value);
  if ($text === "" || strlen($text) > 18) return "0";
  return $text;
}

function extra_tasks($mysqli) {
  $out = array();
  $result = $mysqli->query("SELECT stat, need, points FROM achievement_defs");
  if ($result) {
    while ($row = $result->fetch_assoc()) {
      $out[] = array($row["stat"], (int) $row["need"], (int) $row["points"]);
    }
  }
  return $out;
}

function custom_tasks($mysqli) {
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

function task_points($mysqli, $stats) {
  $tasks = array(
    array("onlineHours", 40, 20), array("onlineHours", 100, 45), array("onlineHours", 200, 90),
    array("onlineHours", 400, 150), array("onlineHours", 700, 240), array("onlineHours", 1000, 180),
    array("referrals", 1, 100), array("referrals", 2, 160), array("referrals", 5, 280), array("referrals", 10, 450),
    array("activeDays", 14, 25), array("activeDays", 30, 50), array("activeDays", 60, 90), array("activeDays", 120, 160),
  );
  foreach (extra_tasks($mysqli) as $task) $tasks[] = $task;
  $sum = 0;
  foreach ($tasks as $task) {
    $key = $task[0];
    $need = $task[1];
    $pts = $task[2];
    if ((float) (isset($stats[$key]) ? $stats[$key] : 0) >= (float) $need) $sum += $pts;
  }
  return $sum;
}

function builtin_task($id) {
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

function grant_stat($mysqli, $discordId, $name, $stat, $need) {
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
  $onlineMsStr = (string) $onlineMs;
  $stmt->bind_param("ssiisiii", $discordId, $name, $reports, $events, $onlineMsStr, $night, $days, $refs);
  $stmt->execute();
}

function money_tier($id) {
  $tiers = array(
    "rank-500" => array(400, 0, "vip"),
    "cash-1500" => array(800, 15000, "cash"),
    "cash-2400" => array(1200, 25000, "cash"),
    "cash-3300" => array(1600, 70000, "cash"),
    "cash-4300" => array(2000, 100000, "cash"),
  );
  return isset($tiers[$id]) ? $tiers[$id] : null;
}

function add_cash_claim($mysqli, $discordId, $kind, $amount) {
  $claim = $mysqli->prepare("INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, ?, ?, 'pending')");
  if (!$claim) return;
  $claim->bind_param("ssi", $discordId, $kind, $amount);
  $claim->execute();
}

function grant_vip($mysqli, $discordId, $name) {
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

function read_state($mysqli, $discordId) {
  $code = "";
  $stmt = $mysqli->prepare("SELECT code FROM promo_codes WHERE discord_id = ? LIMIT 1");
  if ($stmt) {
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    if ($row) $code = (string) $row["code"];
  }
  $redeemedCode = "";
  $stmt = $mysqli->prepare("SELECT code FROM promo_redemptions WHERE discord_id = ? LIMIT 1");
  if ($stmt) {
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    if ($row) $redeemedCode = (string) $row["code"];
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
  $stats = array("reports" => 0, "events" => 0, "onlineHours" => 0, "nightReports" => 0, "activeDays" => 0, "referrals" => $referrals);
  $stmt = $mysqli->prepare("SELECT * FROM reward_stats WHERE discord_id = ? LIMIT 1");
  if ($stmt) {
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    if ($row) {
      $stats["reports"] = (int) $row["reports"];
      $stats["events"] = (int) $row["events"];
      $stats["onlineHours"] = round(((float) $row["online_ms"]) / 3600000, 2);
      $stats["nightReports"] = (int) $row["night_reports"];
      $stats["activeDays"] = (int) $row["active_days"];
      $grantedRefs = isset($row["referrals"]) ? (int) $row["referrals"] : 0;
      $stats["referrals"] = max($referrals, $grantedRefs);
    }
  }
  $payouts = array();
  $claimed = array();
  $pending = 0;
  $paid = 0;
  $stmt = $mysqli->prepare("SELECT id, kind, amount, status, created_at FROM reward_claims WHERE discord_id = ? ORDER BY id ASC");
  if ($stmt) {
    $stmt->bind_param("s", $discordId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($res && ($row = $res->fetch_assoc())) {
      $status = $row["status"] === "paid" ? "paid" : "pending";
      $amount = (int) $row["amount"];
      $iso = "";
      if (!empty($row["created_at"])) {
        $ts = strtotime($row["created_at"]);
        if ($ts) $iso = date("c", $ts);
      }
      $payouts[] = array(
        "id" => (int) $row["id"],
        "kind" => $row["kind"],
        "amount" => $amount,
        "status" => $status,
        "createdAt" => $iso,
      );
      $claimed[] = $row["kind"];
      if ($status === "paid") $paid += $amount;
      else $pending += $amount;
    }
  }
  return array(
    "ok" => true,
    "statsReady" => true,
    "code" => $code,
    "redeemed" => $redeemedCode !== "",
    "redeemedCode" => $redeemedCode,
    "referrals" => $referrals,
    "points" => task_points($mysqli, $stats),
    "stats" => $stats,
    "pendingCash" => $pending,
    "paidCash" => $paid,
    "payouts" => $payouts,
    "claimedKinds" => $claimed,
    "customTasks" => custom_tasks($mysqli),
  );
}

$action = req_get($data, "action");
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
      $state = read_state($mysqli, $row["id"]);
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
    if ($a["points"] === $b["points"]) return strcasecmp($a["name"], $b["name"]);
    return $b["points"] - $a["points"];
  });
  json_out(array("ok" => true, "statsReady" => true, "accounts" => $accounts));
}

if ($discordId === "") {
  json_out(array("ok" => false, "error" => "login"), 401);
}

if ($action === "promoGenerate") {
  $stmt = $mysqli->prepare("SELECT code FROM promo_codes WHERE discord_id = ? LIMIT 1");
  $stmt->bind_param("s", $discordId);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  if (!$row) {
    for ($i = 0; $i < 8; $i++) {
      $code = make_code();
      $ins = $mysqli->prepare("INSERT INTO promo_codes (discord_id, code, name) VALUES (?, ?, ?)");
      if (!$ins) break;
      $ins->bind_param("sss", $discordId, $code, $name);
      if ($ins->execute()) break;
    }
  }
}

if ($action === "promoRedeem") {
  $code = normalize_code(req_get($data, "code"));
  $state = read_state($mysqli, $discordId);
  if (!preg_match("/^ARIES-[A-Z0-9]{6}$/", $code)) {
    fail_state($mysqli, $discordId, "invalid");
  }
  if ($state["code"] === $code) {
    fail_state($mysqli, $discordId, "own");
  }
  if ($state["redeemed"]) {
    fail_state($mysqli, $discordId, "used");
  }
  $deviceId = norm_device(req_get($data, "deviceId"));
  $deviceHash = norm_device(req_get($data, "deviceHash"));
  $ip = client_ip();
  if (device_taken($mysqli, $discordId, $deviceId, $deviceHash, $ip)) {
    fail_state($mysqli, $discordId, "device");
  }
  $find = $mysqli->prepare("SELECT discord_id FROM promo_codes WHERE code = ? LIMIT 1");
  if (!$find) fail_state($mysqli, $discordId, "db");
  $find->bind_param("s", $code);
  $find->execute();
  $res = $find->get_result();
  $owner = $res ? $res->fetch_assoc() : null;
  if (!$owner) {
    fail_state($mysqli, $discordId, "missing");
  }
  $ownerId = $owner["discord_id"];
  $enterAmount = 10000;
  $ownerAmount = 20000;
  $ins = $mysqli->prepare(
    "INSERT INTO promo_redemptions (discord_id, code, owner_id, amount, device_id, device_hash, ip) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  if ($ins) {
    $ins->bind_param("sssisss", $discordId, $code, $ownerId, $enterAmount, $deviceId, $deviceHash, $ip);
    if (!$ins->execute()) {
      $fallback = $mysqli->prepare("INSERT INTO promo_redemptions (discord_id, code, owner_id, amount) VALUES (?, ?, ?, ?)");
      if (!$fallback) fail_state($mysqli, $discordId, "db");
      $fallback->bind_param("sssi", $discordId, $code, $ownerId, $enterAmount);
      if (!$fallback->execute()) fail_state($mysqli, $discordId, "device");
    }
  } else {
    $fallback = $mysqli->prepare("INSERT INTO promo_redemptions (discord_id, code, owner_id, amount) VALUES (?, ?, ?, ?)");
    if (!$fallback) fail_state($mysqli, $discordId, "db");
    $fallback->bind_param("sssi", $discordId, $code, $ownerId, $enterAmount);
    if (!$fallback->execute()) fail_state($mysqli, $discordId, "db");
  }
  add_cash_claim($mysqli, $ownerId, "promo", $ownerAmount);
  add_cash_claim($mysqli, $discordId, "promo-enter", $enterAmount);
}

if ($action === "rewardsSync") {
  $reports = max(0, (int) req_get($data, "reports"));
  $events = max(0, (int) req_get($data, "events"));
  $onlineMsStr = uint_str(isset($data["onlineMs"]) ? $data["onlineMs"] : 0);
  $night = max(0, (int) req_get($data, "nightReports"));
  $days = max(0, (int) req_get($data, "activeDays"));
  $stmt = $mysqli->prepare(
    "INSERT INTO reward_stats (discord_id, name, reports, events, online_ms, night_reports, active_days)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       reports = GREATEST(reports, VALUES(reports)),
       events = GREATEST(events, VALUES(events)),
       online_ms = GREATEST(online_ms, VALUES(online_ms)),
       night_reports = GREATEST(night_reports, VALUES(night_reports)),
       active_days = GREATEST(active_days, VALUES(active_days))"
  );
  $stmt->bind_param("ssiisii", $discordId, $name, $reports, $events, $onlineMsStr, $night, $days);
  $stmt->execute();
}

if ($action === "rewardsClaim") {
  $kind = req_get($data, "kind");
  $tier = money_tier($kind);
  $state = read_state($mysqli, $discordId);
  if (!$tier) {
    $state["ok"] = false;
    $state["error"] = "invalid";
    json_out($state);
  }
  if ($state["points"] < $tier[0]) {
    $state["ok"] = false;
    $state["error"] = "points";
    json_out($state);
  }
  if (in_array($kind, $state["claimedKinds"], true)) {
    $state["ok"] = false;
    $state["error"] = "claimed";
    json_out($state);
  }
  $amount = $tier[1];
  $vip = isset($tier[2]) && $tier[2] === "vip";
  $status = $vip ? "paid" : "pending";
  if ($vip) grant_vip($mysqli, $discordId, $name);
  $ins = $mysqli->prepare("INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, ?, ?, ?)");
  $ins->bind_param("ssis", $discordId, $kind, $amount, $status);
  $ins->execute();
}

if ($action === "rewardsPaid") {
  if (!is_developer_id($mysqli, $discordId)) {
    json_out(array("ok" => false, "error" => "forbidden"), 403);
  }
  $target = preg_replace("/[^0-9]/", "", req_get($data, "targetId"));
  if ($target !== "") {
    $upd = $mysqli->prepare("UPDATE reward_claims SET status = 'paid' WHERE discord_id = ? AND status = 'pending'");
    $upd->bind_param("s", $target);
    $upd->execute();
  }
}

if ($action === "rewardsDefine") {
  if (!is_developer_id($mysqli, $discordId)) {
    json_out(array("ok" => false, "error" => "forbidden"), 403);
  }
  $label = substr(trim(req_get($data, "label")), 0, 80);
  if (strlen($label) < 2) {
    $state = read_state($mysqli, $discordId);
    $state["ok"] = false;
    $state["error"] = "invalid";
    json_out($state);
  }
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
  $ins->bind_param("sssssiiss", $id, $label, $hint, $category, $stat, $need, $points, $rarity, $discordId);
  $ins->execute();
}

if ($action === "rewardsUndefine") {
  if (!is_developer_id($mysqli, $discordId)) {
    json_out(array("ok" => false, "error" => "forbidden"), 403);
  }
  $id = req_get($data, "id");
  if (strpos($id, "custom-") === 0) {
    $del = $mysqli->prepare("DELETE FROM achievement_defs WHERE id = ?");
    $del->bind_param("s", $id);
    $del->execute();
  }
}

if ($action === "rewardsGrant") {
  if (!is_developer_id($mysqli, $discordId)) {
    json_out(array("ok" => false, "error" => "forbidden"), 403);
  }
  $id = req_get($data, "id");
  $task = builtin_task($id);
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
  if (!$task) {
    $state = read_state($mysqli, $discordId);
    $state["ok"] = false;
    $state["error"] = "invalid";
    json_out($state);
  }
  grant_stat($mysqli, $discordId, $name, $task[0], $task[1]);
}

json_out(read_state($mysqli, $discordId));
