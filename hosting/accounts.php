<?php
// Wgraj ten plik do WWW jako accounts.php (np. https://host425499.lh.pl/accounts.php).
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Aries-Key");
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

$key = $_SERVER["HTTP_X_ARIES_KEY"] ?? "";
if ($key !== "aries-accounts-v1") {
  http_response_code(403);
  echo json_encode(["error" => "forbidden"]);
  exit;
}

$mysqli = @new mysqli("localhost", "host425499_ariespanel", "Wu8BzxevpdGr86f5WrXr", "host425499_ariespanel");
if ($mysqli->connect_errno) {
  http_response_code(500);
  echo json_encode(["error" => "db"]);
  exit;
}
$mysqli->set_charset("utf8mb4");
$mysqli->query(
  "CREATE TABLE IF NOT EXISTS discord_accounts (
    discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    avatar_url VARCHAR(512) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $raw = file_get_contents("php://input");
  $data = json_decode($raw ?: "[]", true) ?: [];
  $id = preg_replace("/[^0-9]/", "", (string) ($data["id"] ?? ""));
  $name = trim((string) ($data["name"] ?? ""));
  $avatar = trim((string) ($data["avatarUrl"] ?? ""));
  if ($id === "" || $name === "") {
    http_response_code(400);
    echo json_encode(["error" => "invalid"]);
    exit;
  }
  if (function_exists("mb_substr")) {
    $name = mb_substr($name, 0, 191);
  } else {
    $name = substr($name, 0, 191);
  }
  $avatar = substr($avatar, 0, 512);
  $stmt = $mysqli->prepare(
    "INSERT INTO discord_accounts (discord_id, name, avatar_url) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url)"
  );
  $stmt->bind_param("sss", $id, $name, $avatar);
  $stmt->execute();
  echo json_encode(["ok" => true]);
  exit;
}

$result = $mysqli->query("SELECT name, avatar_url FROM discord_accounts ORDER BY updated_at DESC, name ASC");
$out = [];
if ($result) {
  while ($row = $result->fetch_assoc()) {
    $out[] = [
      "name" => $row["name"],
      "avatarUrl" => $row["avatar_url"],
    ];
  }
}
echo json_encode($out);
