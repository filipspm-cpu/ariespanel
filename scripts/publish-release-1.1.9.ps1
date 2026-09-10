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

$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "User-Agent" = "aries-release-publish"
}

$owner = "filipspm-cpu"
$repo = "ariespanel"
$tag = "v1.1.9"
$version = "1.1.9"

$visBody = '{"private":false}'
try {
  Invoke-RestMethod -Method Patch -Uri "https://api.github.com/repos/$owner/$repo" -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $visBody | Out-Null
  Write-Output "repo_visibility=public"
} catch {
  Write-Output ("visibility_warn=" + $_.Exception.Message)
}

$existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/releases" -Headers $headers
foreach ($r in @($existing)) {
  if ($r.tag_name -eq $tag) {
    Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/$owner/$repo/releases/$($r.id)" -Headers $headers | Out-Null
    Write-Output ("deleted_old_release id=" + $r.id)
  }
}

$releaseBody = @{
  tag_name         = $tag
  name             = ("ARIES " + $version)
  body             = ("ARIES " + $version + " update: updater fixes, about credits, installer.")
  draft            = $false
  prerelease       = $false
  generate_release_notes = $false
} | ConvertTo-Json

$release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$owner/$repo/releases" -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $releaseBody
Write-Output ("created_release id=" + $release.id)

$uploadHeaders = @{
  Authorization  = "Bearer $token"
  Accept         = "application/vnd.github+json"
  "User-Agent"   = "aries-release-publish"
  "Content-Type" = "application/octet-stream"
}

$files = @(
  @{ path = "C:\Users\filip\Desktop\Nowy folder\release\ARIES-Setup-$version.exe"; name = "ARIES-Setup-$version.exe" },
  @{ path = "C:\Users\filip\Desktop\Nowy folder\release\ARIES-Setup-$version.exe.blockmap"; name = "ARIES-Setup-$version.exe.blockmap" },
  @{ path = "$env:TEMP\aries-installer-$version\latest.yml"; name = "latest.yml" }
)

foreach ($f in $files) {
  if (-not (Test-Path $f.path)) { throw ("Missing " + $f.path) }
  $bytes = [IO.File]::ReadAllBytes($f.path)
  $url = "https://uploads.github.com/repos/$owner/$repo/releases/$($release.id)/assets?name=$([uri]::EscapeDataString($f.name))"
  Invoke-RestMethod -Method Post -Uri $url -Headers $uploadHeaders -Body $bytes | Out-Null
  Write-Output ("uploaded " + $f.name + " size=" + $bytes.Length)
}

Start-Sleep -Seconds 2
try {
  $atom = Invoke-WebRequest -Uri ("https://github.com/$owner/$repo/releases.atom") -Headers @{ "User-Agent" = "aries" } -UseBasicParsing
  Write-Output ("atom_ok status=" + $atom.StatusCode)
} catch {
  Write-Output ("atom_still_fail=" + $_.Exception.Message)
}

$latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/releases/latest" -Headers $headers
$assetNames = @($latest.assets | ForEach-Object { $_.name }) -join ", "
Write-Output ("latest_tag=" + $latest.tag_name + " assets=" + $assetNames)

$token = $null
$dict.Clear()
[GC]::Collect()
