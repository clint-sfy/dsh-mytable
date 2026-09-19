# prepare-changes-fixture.ps1 -- recreate the git fixture that tests/verify-changes-pane.js needs.
#
# The probe mutates the repository (stage / commit / discard), so it is not idempotent:
# run this first before every probe run. ASCII-only content on purpose (Windows
# PowerShell 5.1 reads BOM-less UTF-8 as ANSI; the probe only asserts paths/statuses).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tests\prepare-changes-fixture.ps1
#
# Shape produced:
#   notes.md       tracked, one line near the top and one near the bottom changed, then STAGED
#                  -> gives the staged section + a two-hunk diff with a gap in the middle
#   src/app.ts     tracked, modified but NOT staged
#   brand-new.txt  untracked
param([string]$Dir = "$PSScriptRoot\..\.tmp\chg-fixture")

$ErrorActionPreference = 'Stop'
if (Test-Path $Dir) { Remove-Item $Dir -Recurse -Force }
New-Item -ItemType Directory -Force (Join-Path $Dir 'src') | Out-Null

Set-Content (Join-Path $Dir 'src\app.ts') "export const version = 1`nexport function greet(name: string) {`n  return 'hi ' + name`n}`n" -Encoding UTF8
Set-Content (Join-Path $Dir 'README.md') "# chg-fixture`nfixture for the changes-pane probe.`n" -Encoding UTF8
$lines = 1..30 | ForEach-Object { "line $_" }
Set-Content (Join-Path $Dir 'notes.md') ($lines -join "`n") -Encoding UTF8

Push-Location $Dir
try {
  git init -q
  git config user.email 'probe@example.com'
  git config user.name 'probe'
  # 夹具里关掉 CRLF 转换：否则 git 会往 stderr 写 warning，而 5.1 把原生 stderr 当错误记录，
  # 配合上面的 'Stop' 会直接把脚本打断（曾导致「夹具没准备好」）
  git config core.autocrlf false
  git add -A 2>$null
  git commit -q -m 'init' 2>$null

  # staged change with two hunks (line 2 and line 28)
  $changed = 1..30 | ForEach-Object {
    if ($_ -eq 2) { 'line 2 CHANGED' } elseif ($_ -eq 28) { 'line 28 CHANGED' } else { "line $_" }
  }
  Set-Content (Join-Path $Dir 'notes.md') ($changed -join "`n") -Encoding UTF8
  git add notes.md 2>$null

  # unstaged change + untracked file
  Set-Content (Join-Path $Dir 'src\app.ts') "export const version = 2`nexport function greet(name: string) {`n  return 'hello ' + name`n}`nexport const extra = true`n" -Encoding UTF8
  Set-Content (Join-Path $Dir 'brand-new.txt') "brand new untracked file`nsecond line`n" -Encoding UTF8

  Write-Output '--- fixture status ---'
  git status --porcelain

  # 第二条本地分支：分支下拉 / 切分支验收用（只在夹具里切，绝不碰用户的真仓库）
  git branch probe-branch 2>$null
  Write-Output '--- fixture branches ---'
  git for-each-ref --format='%(refname:short)' refs/heads
} finally {
  Pop-Location
}
Write-Output ('fixture ready: ' + (Resolve-Path $Dir))
