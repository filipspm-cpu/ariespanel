[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
function Wait-Async($op) {
  if ($null -eq $op) { return $null }
  $n = 0
  while ($op.Status -eq 0) {
    Start-Sleep -Milliseconds 15
    $n++
    if ($n -gt 120) { return $null }
  }
  Write-Output ("STATUS=" + $op.Status)
  if ($op.Status -ne 1) { return $null }
  try { return $op.GetResults() } catch { Write-Output ("GETRESULTS=" + $_.Exception.Message); return $null }
}
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mgr = Wait-Async ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync())
if (-not $mgr) { Write-Output "NO_MGR"; exit 0 }
$i = 0
foreach ($s in @($mgr.GetSessions())) {
  $i++
  $props = Wait-Async ($s.TryGetMediaPropertiesAsync())
  $aumid = [string]$s.SourceAppUserModelId
  $title = if ($props) { [string]$props.Title } else { "(no props)" }
  $artist = if ($props) { [string]$props.Artist } else { "" }
  Write-Output ("SESSION $i aumid=$aumid title=$title artist=$artist")
}
if ($i -eq 0) { Write-Output "NO_SESSIONS" }
Get-Process | Where-Object { $_.ProcessName -match "Spotify" } | ForEach-Object {
  Write-Output ("PROC " + $_.ProcessName + " title=[" + $_.MainWindowTitle + "]")
}
