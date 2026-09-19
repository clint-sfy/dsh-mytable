<#
  Restart the DSH web instance listening on a given port.
  (Needed after `dsh plugin add/remove`: plugin packages are loaded at boot, so a page
   refresh alone never picks up a new bundle. A running instance cannot restart itself,
   hence this standalone script, safe to launch from a detached process.)

  Usage:
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\restart-dsh-web.ps1 [-Port 3080] [-DelaySec 0] [-NoOpen] [-DryRun]

  Steps:
    1. find the listener by PORT (never a hard-coded pid) and verify its command line really is `dsh web`
       -- abort without killing anything if it is not
    2. stop the old instance, wait for the port to free up
    3. start a fresh instance in a hidden window: node <dsh>/lib/bin.js web --port <port>
       (direct node call, bypassing the dsh.ps1 shim; browser auto-open left ON unless -NoOpen)
    4. poll the log for the readiness line and write the token URL to <DSH_HOME>\web-restart-url.txt
    5. everything is appended to <DSH_HOME>\web-restart.log

  NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads BOM-less UTF-8 scripts as ANSI,
  which corrupts non-ASCII string literals and breaks parsing.
#>
param(
  [int]$Port = 3080,
  [int]$DelaySec = 0,
  [switch]$NoOpen,
  [switch]$DryRun,
  # When launched by Task Scheduler, pass the task name so this script removes it on exit.
  [string]$TaskName = ''
)

$ErrorActionPreference = 'Continue'
$DSH_HOME = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$LOG = Join-Path $DSH_HOME 'web-restart.log'
$URL_FILE = Join-Path $DSH_HOME 'web-restart-url.txt'
$BIN = 'C:\MySoftware\nodejs\node_global\node_modules\@deepseek-ai\dsh\lib\bin.js'
$NODE = 'C:\nvm4w\nodejs\node.exe'

function Log([string]$m) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $m
  Write-Host $line
  try { Add-Content -LiteralPath $LOG -Value $line -Encoding UTF8 } catch {}
}

Log "restart-dsh-web: port=$Port delay=${DelaySec}s noOpen=$($NoOpen.IsPresent) dryRun=$($DryRun.IsPresent)"

if ($DelaySec -gt 0) {
  Log "sleeping $DelaySec s before touching the server ..."
  Start-Sleep -Seconds $DelaySec
}

# -- 1) locate the listener and verify identity ------------------------------
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $conn) {
  Log "no listener on port $Port -- will just start a fresh instance"
  $oldPid = $null
} else {
  $oldPid = $conn.OwningProcess
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$oldPid" -ErrorAction SilentlyContinue
  $cl = if ($proc) { [string]$proc.CommandLine } else { '' }
  Log "port $Port listener pid=$oldPid"
  Log "  command line: $cl"
  if ($cl -notmatch 'dsh' -or $cl -notmatch 'web') {
    Log "ABORT: that process does not look like 'dsh web'; refusing to kill it. Handle manually."
    exit 3
  }
}

if ($DryRun) {
  Log "DRY-RUN: would stop pid=$oldPid, then start '$NODE $BIN web --port $Port'"
  exit 0
}

# -- 2) stop the old instance ------------------------------------------------
if ($oldPid) {
  try { Stop-Process -Id $oldPid -Force -ErrorAction Stop; Log "stopped pid=$oldPid" }
  catch { Log "failed to stop pid=$oldPid : $($_.Exception.Message)" }
  foreach ($p in Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue) {
    if ($p.CommandLine -and $p.CommandLine -match 'npx-cli\.js' -and $p.CommandLine -match 'dsh') {
      try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Log "stopped npx wrapper pid=$($p.ProcessId)" } catch {}
    }
  }
}

# -- 3) wait for the port to be released ------------------------------------
for ($i = 0; $i -lt 40; $i++) {
  $busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $busy) { break }
  Start-Sleep -Milliseconds 500
}
Log "port $Port released (or wait timed out; continuing)"

# -- 4) start the new instance (hidden window, survives this script) --------
Remove-Item -LiteralPath $URL_FILE -Force -ErrorAction SilentlyContinue
$cliArgs = @($BIN, 'web', '--port', "$Port")
if ($NoOpen) { $cliArgs += '--no-open' }
try {
  $newProc = Start-Process -FilePath $NODE -ArgumentList $cliArgs -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $DSH_HOME 'web-restart.out.log') `
    -RedirectStandardError  (Join-Path $DSH_HOME 'web-restart.err.log')
  Log "started: $NODE $($cliArgs -join ' ') (pid $($newProc.Id))"
} catch {
  Log "start failed: $($_.Exception.Message)"
  exit 4
}

# -- 5) wait for readiness, persist the token URL ---------------------------
# NOTE: the health probe must NOT end this loop -- readiness and URL capture are
# different things (the instance can answer HTTP before node flushes the banner
# line into the redirect file, which used to leave the URL file unwritten).
$url = $null
$healthy = $false
for ($i = 0; $i -lt 120; $i++) {
  Start-Sleep -Milliseconds 1000
  foreach ($f in @((Join-Path $DSH_HOME 'web-restart.out.log'), (Join-Path $DSH_HOME 'web-restart.err.log'))) {
    if (Test-Path $f) {
      $m = Select-String -Path $f -Pattern 'dsh web:\s*(http://[^\s]+)' -Encoding UTF8 -ErrorAction SilentlyContinue | Select-Object -Last 1
      if ($m) { $url = $m.Matches[0].Groups[1].Value; break }
    }
  }
  if ($url) { break }
  if (-not $healthy) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/api/worktable/health" -TimeoutSec 2
      if ($r.StatusCode -eq 200) { $healthy = $true; Log "instance answers HTTP; still waiting for the token URL line ..." }
    } catch {}
  }
}
if ($url) {
  try { Set-Content -LiteralPath $URL_FILE -Value $url -Encoding UTF8 } catch {}
  Log "READY: $url"
  Log "(URL also written to $URL_FILE)"
} else {
  Log "no readiness URL within 120s -- check web-restart.out.log / web-restart.err.log"
}
if ($TaskName) {
  try { schtasks /delete /tn $TaskName /f | Out-Null; Log "scheduled task removed: $TaskName" } catch {}
}
Log 'restart-dsh-web: done'
