<#
.SYNOPSIS
  Draws the app icons (snare drum with crossed sticks) into icons/. Run from the repo root:
  powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
#>
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$outDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $outDir | Out-Null

function New-Icon([int]$size, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $s = $size / 512.0
  # Full-bleed background so the icon also works as a maskable icon; content stays in the central safe zone.
  $g.Clear([System.Drawing.Color]::FromArgb(180, 35, 44))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $cream = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 236, 214))
  $dark = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 20, 28)), (10 * $s)
  # Drum body
  $g.FillRectangle($white, 136 * $s, 250 * $s, 240 * $s, 110 * $s)
  $g.FillEllipse($white, 136 * $s, 320 * $s, 240 * $s, 80 * $s)
  # Lugs
  foreach ($x in 170, 223, 289, 342) {
    $g.DrawLine($dark, $x * $s, 268 * $s, $x * $s, 352 * $s)
  }
  # Drum head
  $g.FillEllipse($cream, 136 * $s, 210 * $s, 240 * $s, 80 * $s)
  $g.DrawEllipse($dark, 136 * $s, 210 * $s, 240 * $s, 80 * $s)
  # Sticks
  $stick = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (18 * $s)
  $stick.StartCap = 'Round'
  $stick.EndCap = 'Round'
  $g.DrawLine($stick, 150 * $s, 110 * $s, 262 * $s, 236 * $s)
  $g.DrawLine($stick, 362 * $s, 110 * $s, 250 * $s, 236 * $s)
  $g.FillEllipse($white, 244 * $s, 222 * $s, 24 * $s, 24 * $s)
  $g.Dispose()
  $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-Icon 512 'icon-512.png'
New-Icon 192 'icon-192.png'
New-Icon 180 'apple-touch-icon.png'
Write-Output "Icons written to $((Resolve-Path $outDir).Path)"
