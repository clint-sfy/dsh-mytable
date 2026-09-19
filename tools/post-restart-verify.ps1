<#
  Post-restart verification for a running `dsh web` instance + the dsh-mytable plugin.

  Why a separate script: restarting the instance kills the agent process that would normally
  run these checks, so the checks have to run from OUTSIDE it (scheduled task) and write their
  verdict to a log that survives.

  Usage:
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\post-restart-verify.ps1 [-Port 3080] [-SkipBrowser]

  Checks:
    1. listener identity: which pid owns the port, when it started, vs the installed bundle mtime
       (a stale process is the classic reason a fix "does not show up")
    2. POST /api/worktable/repos against the workspace dir (the parent of this package):
       the route must come back with the discovered repos AND the per-repo branch + changes fields
    3. headless-browser probe (tests\verify-gitlens.js) through tests\cdp-probe.mjs:
       the Git lens must list those repos, default to the dirty one, and open a repo's file list
       (if the page answers with the auth wall, the one-shot token URL is exchanged once via
        tools\cdp-auth.mjs and the probe is retried)

  Everything is appended to <DSH_HOME>\mytable-verify.log.
  NOTE: keep this file ASCII-only -- Windows PowerShell 5.1 reads BOM-less UTF-8 as ANSI.
#>
param(
  [int]$Port = 3080,
  [string]$Profile = 'web',
  [switch]$SkipBrowser
)

$ErrorActionPreference = 'Continue'
$DSH_HOME = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$LOG = Join-Path $DSH_HOME 'mytable-verify.log'
$URL_FILE = Join-Path $DSH_HOME 'web-restart-url.txt'

function Log([string]$m) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $m
  Write-Host $line
  try { Add-Content -LiteralPath $LOG -Value $line -Encoding UTF8 } catch {}
}

$repo = Split-Path $PSScriptRoot -Parent          # ...\<pkg> (dsh-mytable)
$workspace = Split-Path $repo -Parent             # the workspace holding the user's repos
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'node' }

# The CDP helpers need the `ws` module that ships with the host (it is not a dependency of this package).
$ws = $null
try {
  $g = (& npm root -g 2>$null | Select-Object -Last 1)
  if ($g) {
    $cand = Join-Path $g.Trim() '@deepseek-ai\dsh\node_modules\ws\index.js'
    if (Test-Path $cand) { $ws = $cand }
  }
} catch {}
if (-not $ws) { Log 'WARN: ws module not found via `npm root -g` -> browser probe skipped'; $SkipBrowser = $true }

Log ('post-restart-verify: port={0} profile={1} workspace={2}' -f $Port, $Profile, $workspace)

# -- 1) listener identity vs installed bundle ---------------------------------
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $conn) {
  Log "FAIL: nothing is listening on port $Port"
} else {
  $ownerPid = $conn.OwningProcess
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
  $started = if ($proc) { ([datetime]$proc.CreationDate).ToString('yyyy-MM-dd HH:mm:ss') } else { '?' }
  Log "listener pid=$ownerPid started=$started"
  $webBundle = Join-Path $DSH_HOME ('profiles\{0}\node_modules\dsh-mytable\lib\index.js' -f $Profile)
  if (Test-Path $webBundle) {
    $mtime = (Get-Item $webBundle).LastWriteTime
    $fresh = $false
    if ($proc) { $fresh = ([datetime]$proc.CreationDate) -gt $mtime }
    Log ('installed bundle mtime={0} -> process {1} than the bundle' -f $mtime.ToString('yyyy-MM-dd HH:mm:ss'), $(if ($fresh) { 'NEWER' } else { 'OLDER (stale build loaded!)' }))
  } else {
    Log "WARN: $webBundle not found (is dsh-mytable installed in the web profile?)"
  }
}

# -- 2) repos route ----------------------------------------------------------
$reposOk = $false
try {
  $body = @{ cwd = $workspace } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/worktable/repos" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 60
  $list = @($r.repos)
  $withFields = @($list | Where-Object { $_.PSObject.Properties.Name -contains 'branch' -and $_.PSObject.Properties.Name -contains 'changes' })
  $reposOk = $list.Count -gt 0 -and $withFields.Count -eq $list.Count
  Log ('/repos -> root={0} count={1} (with branch+changes: {2})' -f $r.root, $list.Count, $withFields.Count)
  foreach ($x in $list) { Log ('  {0,-24} branch={1,-10} changes={2}' -f $x.name, $x.branch, $x.changes) }
  Log ($(if ($reposOk) { 'PASS' } else { 'FAIL' }) + ': /repos returns discovered repos with branch + changes')
} catch {
  Log "FAIL: /repos request failed: $($_.Exception.Message)"
}

# -- 3) browser probe --------------------------------------------------------
if (-not $SkipBrowser) {
  $probe = Join-Path $repo 'tests\verify-gitlens.js'
  $argsFile = Join-Path $repo '.tmp\chg-args.json'
  $wsArgs = ($ws -replace '\\', '/')
  $root = "http://127.0.0.1:$Port/"
  if (-not (Test-Path $probe)) {
    Log "WARN: $probe not found -> browser probe skipped"
  } else {
    $attempts = 0
    while ($attempts -lt 2) {
      $attempts++
      $raw = & $node (Join-Path $repo 'tests\cdp-probe.mjs') $wsArgs $root $probe (Join-Path $repo '.tmp\shot-gitlens.png') 'reload' $argsFile 2>&1 | Out-String
      if ($raw -notmatch 'splitStore') {
        foreach ($ln in ($raw -split "`r?`n")) {
          if ($ln -match '^\s*"(name|ok|detail)"|RESULT (OK|FAIL)|^\{|^\}|"(fail|repos|files)"') { Log ('  probe| ' + $ln.Trim()) }
        }
        Log ($(if ($raw -match 'RESULT OK') { 'PASS' } else { 'FAIL' }) + ': Git-lens browser probe (step detail is in the probe| lines above)')
        break
      }
      # auth wall: the one-shot token URL has never been exchanged inside this browser profile
      if (Test-Path $URL_FILE) {
        $tokenUrl = ([System.IO.File]::ReadAllText($URL_FILE)).Trim()
        Log "page hit the auth wall -> exchanging the one-shot token URL once (tools\cdp-auth.mjs)"
        & $node (Join-Path $repo 'tools\cdp-auth.mjs') $tokenUrl $wsArgs | ForEach-Object { Log ('  auth| ' + $_) }
      } else {
        Log "page hit the auth wall and $URL_FILE is missing -> open the URL printed by the instance once, then re-run"
        break
      }
    }
  }
}

Log 'post-restart-verify: done'
