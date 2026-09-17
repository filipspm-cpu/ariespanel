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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_promo_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$mysqli->query("CREATE TABLE IF NOT EXISTS reward_stats (
  discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL DEFAULT '',
  reports INT NOT NULL DEFAULT 0,
  events INT NOT NULL DEFAULT 0,
  online_ms BIGINT NOT NULL DEFAULT 0,
  night_reports INT NOT NULL DEFAULT 0,
  active_days INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$mysqli->query("CREATE TABLE IF NOT EXISTS reward_claims (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  discord_id VARCHAR(32) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reward_claim (discord_id, kind),
  INDEX idx_reward_user (discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

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

function task_points($stats) {
  $tasks = array(
    array("reports", 100, 30), array("reports", 200, 50), array("reports", 500, 90),
    array("reports", 1000, 150), array("reports", 2000, 260), array("reports", 3500, 420), array("reports", 5000, 200),
    array("onlineHours", 40, 20), array("onlineHours", 100, 45), array("onlineHours", 200, 90),
    array("onlineHours", 400, 150), array("onlineHours", 700, 240), array("onlineHours", 1000, 180),
    array("events", 80, 40), array("events", 200, 80), array("events", 500, 150), array("events", 1000, 250),
    array("referrals", 1, 100), array("referrals", 2, 160), array("referrals", 5, 280), array("referrals", 10, 450),
    array("activeDays", 14, 25), array("activeDays", 30, 50), array("activeDays", 60, 90), array("activeDays", 120, 160),
    array("nightReports", 30, 70), array("nightReports", 80, 140), array("nightReports", 180, 250), array("nightReports", 300, 160),
  );
  $sum = 0;
  foreach ($tasks as $task) {
    $key = $task[0];
    $need = $task[1];
    $pts = $task[2];
    if ((int) (isset($stats[$key]) ? $stats[$key] : 0) >= $need) $sum += $pts;
  }
  return $sum;
}

function money_tier($id) {
  $tiers = array(
    "cash-1500" => array(1500, 10000),
    "cash-2400" => array(2400, 20000),
    "cash-3300" => array(3300, 30000),
    "cash-4300" => array(4300, 50000),
  );
  return isset($tiers[$id]) ? $tiers[$id] : null;
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
      $stats["onlineHours"] = (int) floor(((int) $row["online_ms"]) / 3600000);
      $stats["nightReports"] = (int) $row["night_reports"];
      $stats["activeDays"] = (int) $row["active_days"];
      $stats["referrals"] = $referrals;
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
    "code" => $code,
    "redeemed" => $redeemedCode !== "",
    "redeemedCode" => $redeemedCode,
    "referrals" => $referrals,
    "points" => task_points($stats),
    "stats" => $stats,
    "pendingCash" => $pending,
    "paidCash" => $paid,
    "payouts" => $payouts,
    "claimedKinds" => $claimed,
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
  $result = $mysqli->query("SELECT discord_id FROM discord_accounts");
  if ($result) {
    while ($row = $result->fetch_assoc()) {
      $state = read_state($mysqli, $row["discord_id"]);
      $accounts[] = array(
        "id" => $row["discord_id"],
        "code" => $state["code"],
        "referrals" => $state["referrals"],
        "redeemed" => $state["redeemed"],
        "pendingCash" => $state["pendingCash"],
        "paidCash" => $state["paidCash"],
        "points" => $state["points"],
      );
    }
  }
  json_out(array("ok" => true, "accounts" => $accounts));
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
    $state["ok"] = false;
    $state["error"] = "invalid";
    json_out($state, 400);
  }
  if ($state["code"] === $code) {
    $state["ok"] = false;
    $state["error"] = "own";
    json_out($state, 400);
  }
  if ($state["redeemed"]) {
    $state["ok"] = false;
    $state["error"] = "used";
    json_out($state, 400);
  }
  $find = $mysqli->prepare("SELECT discord_id FROM promo_codes WHERE code = ? LIMIT 1");
  $find->bind_param("s", $code);
  $find->execute();
  $res = $find->get_result();
  $owner = $res ? $res->fetch_assoc() : null;
  if (!$owner) {
    $state["ok"] = false;
    $state["error"] = "missing";
    json_out($state, 400);
  }
  $ownerId = $owner["discord_id"];
  $amount = 30000;
  $ins = $mysqli->prepare("INSERT INTO promo_redemptions (discord_id, code, owner_id, amount) VALUES (?, ?, ?, ?)");
  $ins->bind_param("sssi", $discordId, $code, $ownerId, $amount);
  $ins->execute();
  $claim = $mysqli->prepare("INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, 'promo', ?, 'pending')");
  $claim->bind_param("si", $discordId, $amount);
  $claim->execute();
}

if ($action === "rewardsSync") {
  $reports = max(0, (int) req_get($data, "reports"));
  $events = max(0, (int) req_get($data, "events"));
  $onlineMs = max(0, (int) req_get($data, "onlineMs"));
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
  $onlineMsStr = (string) $onlineMs;
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
    json_out($state, 400);
  }
  if ($state["points"] < $tier[0]) {
    $state["ok"] = false;
    $state["error"] = "points";
    json_out($state, 400);
  }
  if (in_array($kind, $state["claimedKinds"], true)) {
    $state["ok"] = false;
    $state["error"] = "claimed";
    json_out($state, 400);
  }
  $amount = $tier[1];
  $ins = $mysqli->prepare("INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, ?, ?, 'pending')");
  $ins->bind_param("ssi", $discordId, $kind, $amount);
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

json_out(read_state($mysqli, $discordId));
