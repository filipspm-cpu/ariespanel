<?php
// Frakcje ARIES. Wgraj obok accounts.php: /aries/factions.php
// MySQL na LH.pl przyjmuje połączenia tylko z localhost, więc panel nie łączy się z bazą sam.
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
  echo json_encode(array("ok" => false, "error" => "php", "detail" => $detail, "storage" => "db", "editor" => false, "factions" => array()));
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
  json_out(array("ok" => false, "error" => "forbidden", "storage" => "db", "editor" => false, "factions" => array()), 403);
}

try {
  $mysqli = @new mysqli("localhost", "host425499_ariespanel", "Wu8BzxevpdGr86f5WrXr", "host425499_ariespanel");
} catch (Exception $e) {
  json_out(array("ok" => false, "error" => "db", "detail" => $e->getMessage(), "storage" => "db", "editor" => false, "factions" => array()), 200);
}
if (!$mysqli || $mysqli->connect_errno) {
  json_out(array("ok" => false, "error" => "db", "storage" => "db", "editor" => false, "factions" => array()), 200);
}
$mysqli->set_charset("utf8mb4");

function faction_ids() {
  return array("lspd", "ems", "lscsd", "sang", "gov", "wn", "fib", "ballas", "vagos", "families", "bloods", "marabunta");
}

function faction_leader_seed() {
  return array(
    "lspd" => "",
    "ems" => "Janek Leon [#94585]",
    "lscsd" => "Jacob Magnat [#39521]",
    "sang" => "Mietek Blue [#18768]",
    "gov" => "John Ewans [#40952]",
    "wn" => "Monika Bundy [#124332]",
    "fib" => "Lucas Anderson [#536]",
    "ballas" => "Kawik Codeine [#58280]",
    "vagos" => "Grygolek Arkadia [#82305]",
    "families" => "Shadowek Vybili [#45118]",
    "bloods" => "",
    "marabunta" => "",
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
  $seed = faction_leader_seed();
  $stmt = $mysqli->prepare("INSERT IGNORE INTO panel_factions (id, leader) VALUES (?, ?)");
  if (!$stmt) return;
  foreach ($seed as $id => $leader) {
    $stmt->bind_param("ss", $id, $leader);
    $stmt->execute();
  }
}

function factions_is_editor($mysqli, $discordId) {
  if ($discordId === "") return false;
  $stmt = $mysqli->prepare("SELECT rank FROM account_roles WHERE discord_id = ? LIMIT 1");
  if (!$stmt) return false;
  $stmt->bind_param("s", $discordId);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res ? $res->fetch_assoc() : null;
  if (!$row) return false;
  $rank = strtolower((string) $row["rank"]);
  return strpos($rank, "main-developer") !== false || strpos($rank, "main-dev") !== false || strpos($rank, "m-dev") !== false || strpos($rank, "mdev") !== false;
}

function factions_payload($mysqli, $discordId) {
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
    "storage" => "db",
    "editor" => factions_is_editor($mysqli, $discordId),
    "factions" => $out,
  );
}

$action = req_get($data, "action");
if ($action === "") $action = req_get($_GET, "action");
if ($action === "") $action = "factionsList";
$discordId = preg_replace("/[^0-9]/", "", req_get($data, "discordId"));
if ($discordId === "") $discordId = preg_replace("/[^0-9]/", "", req_get($data, "discord_id"));

if ($action === "factionsSave") {
  if ($discordId === "") {
    $payload = factions_payload($mysqli, $discordId);
    $payload["ok"] = false;
    $payload["error"] = "login";
    json_out($payload, 401);
  }
  if (!factions_is_editor($mysqli, $discordId)) {
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

json_out(factions_payload($mysqli, $discordId));
