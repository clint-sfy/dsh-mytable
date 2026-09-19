<#
  One-shot restart + self-verification, meant to be launched by Task Scheduler so it survives
  the very process it replaces (the running dsh web instance hosts the agent that would
  otherwise drive the restart).

  Usage (normally via schtasks, see README section 7):
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\restart-and-verify.ps1 -Port 3080

  Sequence: tools\restart-dsh-web.ps1 (kill + relaunch + capture the readiness URL)
            -> tools\post-restart-verify.ps1 (freshness, /repos route, real browser probe)
  Logs: <DSH_HOME>\web-restart.log and <DSH_HOME>\mytable-verify.log
  NOTE: keep this file ASCII-only -- Windows PowerShell 5.1 reads BOM-less UTF-8 as ANSI.
#>
param(
  [int]$Port = 3080,
  [int]$DelaySec = 0,
  [string]$TaskName = 'dsh-mytable-web-restart',
  [switch]$SkipBrowser
)

$ErrorActionPreference = 'Continue'

& (Join-Path $PSScriptRoot 'restart-dsh-web.ps1') -Port $Port -DelaySec $DelaySec -NoOpen -TaskName $TaskName
& (Join-Path $PSScriptRoot 'post-restart-verify.ps1') -Port $Port -SkipBrowser:$SkipBrowser
