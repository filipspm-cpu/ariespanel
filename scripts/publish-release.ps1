$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\cmd\git.exe"
$ask = @"
protocol=https
host=github.com

"@
$credLines = $ask | & $git credential fill 2>&1
$dict = @{}
foreach ($line in $credLines) {
  if ($line -match '^([^=]+)=(.*)$') { $dict[$Matches[1]] = $Matches[2] }
}
$token = $dict['password']
if (-not $token) { throw "No GitHub credentials" }

$pkg = Get-Content "C:\Users\filip\Desktop\Nowy folder\package.json" -Raw | ConvertFrom-Json
$version = [string]$pkg.version
$tag = "v$version"
$owner = "filipspm-cpu"
$repo = "ariespanel"
$curl = "C:\Windows\System32\curl.exe"
$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "User-Agent" = "aries-release-publish"
}

# Ensure tag exists remotely (no force)
$remoteTag = & $git ls-remote --tags origin $tag
if (-not $remoteTag) {
  & $git tag -a $tag -m "ARIES $version"
  & $git push origin $tag
}

$existing = $null
try {
  $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/releases/tags/$tag" -Headers $headers
} catch {
  $existing = $null
}
if ($existing) {
  Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/$owner/$repo/releases/$($existing.id)" -Headers $headers | Out-Null
  Write-Output ("deleted_old_release id=" + $existing.id)
}

$releaseBody = @{
  tag_name   = $tag
  name       = ("ARIES " + $version)
  body       = @"
Szybsze makra, T+Enter po każdej linii, bez kroków Jeśli / funkcja, logo ARIES.
"@
  draft      = $false
  prerelease = $false
} | ConvertTo-Json

$release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$owner/$repo/releases" -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $releaseBody
Write-Output ("created_release id=" + $release.id)

$files = @(
  @{ path = "C:\Users\filip\Desktop\Nowy folder\release\ARIES-Setup-$version.exe"; name = "ARIES-Setup-$version.exe" },
  @{ path = "C:\Users\filip\Desktop\Nowy folder\release\ARIES-Setup-$version.exe.blockmap"; name = "ARIES-Setup-$version.exe.blockmap" },
  @{ path = "C:\Users\filip\Desktop\Nowy folder\release\latest.yml"; name = "latest.yml" }
)

foreach ($f in $files) {
  if (-not (Test-Path $f.path)) { throw ("Missing " + $f.path) }
  Write-Output ("uploading " + $f.name)
  & $curl -sS -X POST `
    -H "Authorization: Bearer $token" `
    -H "Accept: application/vnd.github+json" `
    -H "Content-Type: application/octet-stream" `
    --data-binary "@$($f.path)" `
    "https://uploads.github.com/repos/$owner/$repo/releases/$($release.id)/assets?name=$([uri]::EscapeDataString($f.name))" | Out-Null
  Write-Output ("uploaded " + $f.name)
}

$latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/releases/latest" -Headers $headers
Write-Output ("latest=" + $latest.tag_name + " assets=" + ((@($latest.assets.name) -join ", ")))
$token = $null
$dict.Clear()
[GC]::Collect()
Write-Output "DONE"
