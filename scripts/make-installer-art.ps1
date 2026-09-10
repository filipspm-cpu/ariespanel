Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$logoPath = Join-Path $root "src\assets\aries-logo.png"
$outDir = Join-Path $root "build"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$logoImg = [System.Drawing.Image]::FromFile($logoPath)
$logo = New-Object System.Drawing.Bitmap $logoImg
$logoImg.Dispose()

function Save-Bmp24([System.Drawing.Bitmap]$bitmap, [string]$path) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bitmap.Width, $bitmap.Height
  $clone = $bitmap.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $clone.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $clone.Dispose()
}

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  return @{ Bmp = $bmp; G = $g }
}

$cTop = [System.Drawing.Color]::FromArgb(255, 9, 9, 11)
$cBottom = [System.Drawing.Color]::FromArgb(255, 28, 16, 52)
$accent = [System.Drawing.Color]::FromArgb(255, 139, 92, 246)
$white = [System.Drawing.Color]::FromArgb(255, 250, 250, 250)
$muted = [System.Drawing.Color]::FromArgb(255, 161, 161, 170)

# --- sidebar 164x314 ---
$side = New-Canvas 164 314
$g = $side.G
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
  (New-Object System.Drawing.Point 0, 0),
  (New-Object System.Drawing.Point 0, 314),
  $cTop, $cBottom)
$g.FillRectangle($grad, 0, 0, 164, 314)
$g.FillRectangle((New-Object System.Drawing.SolidBrush $accent), 161, 0, 3, 314)

$logoSize = 118
$logoX = [int]((164 - $logoSize) / 2)
$g.DrawImage($logo, $logoX, 48, $logoSize, $logoSize)

$titleFont = New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font "Segoe UI", 8
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("ARIES", $titleFont, (New-Object System.Drawing.SolidBrush $white), (New-Object System.Drawing.RectangleF 0, 182, 161, 32), $sf)
$g.DrawString("PANEL", $subFont, (New-Object System.Drawing.SolidBrush $muted), (New-Object System.Drawing.RectangleF 0, 214, 161, 18), $sf)

Save-Bmp24 $side.Bmp (Join-Path $outDir "installerSidebar.bmp")
$g.Dispose()
$side.Bmp.Dispose()

# --- header 150x57 ---
$head = New-Canvas 150 57
$hg = $head.G
$hgrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
  (New-Object System.Drawing.Point 0, 0),
  (New-Object System.Drawing.Point 150, 0),
  $cTop, $cBottom)
$hg.FillRectangle($hgrad, 0, 0, 150, 57)
$hg.FillRectangle((New-Object System.Drawing.SolidBrush $accent), 0, 54, 150, 3)
$hg.DrawImage($logo, 8, 8, 40, 40)
$hFont = New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)
$hSf = New-Object System.Drawing.StringFormat
$hSf.LineAlignment = [System.Drawing.StringAlignment]::Center
$hg.DrawString("ARIES", $hFont, (New-Object System.Drawing.SolidBrush $white), (New-Object System.Drawing.RectangleF 52, 0, 90, 54), $hSf)

Save-Bmp24 $head.Bmp (Join-Path $outDir "installerHeader.bmp")
$hg.Dispose()
$head.Bmp.Dispose()

# --- ico with embedded 256 PNG ---
$icoPng = Join-Path $env:TEMP "aries-icon-256.png"
$icoBmp = New-Object System.Drawing.Bitmap 256, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ig = [System.Drawing.Graphics]::FromImage($icoBmp)
$ig.Clear([System.Drawing.Color]::Transparent)
$ig.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$ig.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ig.DrawImage($logo, 0, 0, 256, 256)
$ig.Dispose()
$icoBmp.Save($icoPng, [System.Drawing.Imaging.ImageFormat]::Png)
$icoBmp.Dispose()
$logo.Dispose()

$pngBytes = [IO.File]::ReadAllBytes($icoPng)
$ico = New-Object byte[] (22 + $pngBytes.Length)
$ico[0] = 0; $ico[1] = 0
$ico[2] = 1; $ico[3] = 0
$ico[4] = 1; $ico[5] = 0
$ico[6] = 0; $ico[7] = 0; $ico[8] = 0; $ico[9] = 0
$ico[10] = 1; $ico[11] = 0
$ico[12] = 32; $ico[13] = 0
[BitConverter]::GetBytes([int]$pngBytes.Length).CopyTo($ico, 14)
[BitConverter]::GetBytes([int]22).CopyTo($ico, 18)
[Buffer]::BlockCopy($pngBytes, 0, $ico, 22, $pngBytes.Length)
[IO.File]::WriteAllBytes((Join-Path $outDir "installerIcon.ico"), $ico)

Write-Output "Wrote installer art to $outDir"
