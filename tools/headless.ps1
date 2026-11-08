<#
.SYNOPSIS
  Runs the browser tests (or a JavaScript expression against a page) in headless Edge via the DevTools protocol.

.EXAMPLE
  # Start the local server first:  jwebserver -b 127.0.0.1 -p 8080 -d <repo>
  powershell -File tools\headless.ps1                       # runs tests/index.html, exit code 1 on failures
  powershell -File tools\headless.ps1 -Url 'http://127.0.0.1:8080/#/uebung/2.2' -Expr 'document.title'
#>
param(
  [string]$Url = 'http://127.0.0.1:8080/tests/',
  [string]$Expr = '',
  # Read the expression from a file (avoids quote mangling when passing JavaScript on the command line).
  [string]$ExprFile = '',
  # With -Expr/-ExprFile: save a PNG screenshot after the expression has finished.
  [string]$Screenshot = '',
  [int]$TimeoutSec = 60,
  [int]$Port = 9333,
  [string]$Edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$ErrorActionPreference = 'Stop'
if ($ExprFile) { $Expr = Get-Content -Raw -Encoding UTF8 $ExprFile }
$profileDir = Join-Path $env:TEMP 'drums-headless-edge'
$edgeArgs = @(
  '--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
  "--user-data-dir=$profileDir", "--remote-debugging-port=$Port",
  '--autoplay-policy=no-user-gesture-required', '--window-size=1366,1024', 'about:blank'
)
$proc = Start-Process -FilePath $Edge -ArgumentList $edgeArgs -PassThru
$ws = $null
try {
  $page = $null
  for ($i = 0; $i -lt 100 -and -not $page; $i++) {
    try {
      # Assign first: Windows PowerShell 5.1 does not enumerate a JSON array piped straight from Invoke-RestMethod.
      $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json"
      $page = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  if (-not $page) { throw 'DevTools endpoint not reachable' }

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  $script:nextId = 0

  function Invoke-Cdp([string]$method, [hashtable]$params = @{}) {
    $script:nextId++
    $id = $script:nextId
    $json = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $ws.SendAsync((New-Object 'ArraySegment[byte]' (, $bytes)), 'Text', $true, [Threading.CancellationToken]::None).Wait()
    $buffer = New-Object byte[] 65536
    while ($true) {
      $stream = New-Object System.IO.MemoryStream
      do {
        $res = $ws.ReceiveAsync((New-Object 'ArraySegment[byte]' (, $buffer)), [Threading.CancellationToken]::None).Result
        $stream.Write($buffer, 0, $res.Count)
      } while (-not $res.EndOfMessage)
      $msg = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
      if ($msg.id -eq $id) { return $msg }
    }
  }

  function Invoke-Js([string]$expression) {
    $r = Invoke-Cdp 'Runtime.evaluate' @{ expression = $expression; returnByValue = $true; awaitPromise = $true }
    if ($r.result.exceptionDetails) { throw "JS error: $($r.result.exceptionDetails.exception.description)" }
    return $r.result.result.value
  }

  Invoke-Cdp 'Page.navigate' @{ url = $Url } | Out-Null
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Invoke-Js 'document.readyState') -ne 'complete') {
    if ((Get-Date) -gt $deadline) { throw 'page did not load' }
    Start-Sleep -Milliseconds 100
  }

  if ($Expr) {
    Invoke-Js $Expr
    if ($Screenshot) {
      $shot = Invoke-Cdp 'Page.captureScreenshot' @{ format = 'png' }
      [IO.File]::WriteAllBytes($Screenshot, [Convert]::FromBase64String($shot.result.data))
    }
    exit 0
  }

  while ((Invoke-Js 'document.body.dataset.done') -ne 'true') {
    if ((Get-Date) -gt $deadline) { throw 'tests did not finish in time' }
    Start-Sleep -Milliseconds 200
  }
  Invoke-Js "document.getElementById('out').innerText"
  $summary = Invoke-Js "document.getElementById('summary').textContent"
  Write-Output $summary
  if ((Invoke-Js 'document.title') -like 'FAIL*') { exit 1 }
  exit 0
} finally {
  if ($ws) { $ws.Dispose() }
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
