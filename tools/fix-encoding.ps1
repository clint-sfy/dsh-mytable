# fix-encoding.ps1 -- one-off repair for PowerShell 5.1 ANSI round-trip damage.
#
# What happened: `Get-Content` (no -Encoding) reads a BOM-less UTF-8 file as the
# system ANSI codepage (936); `Set-Content -Encoding UTF8` then writes that
# mojibake back. Chinese text ends up double encoded.
#
# This script never uses Get-Content/Set-Content: it reads with .NET and an
# EXPLICIT UTF-8 decoder, reverses the damage (mojibake text -> GBK bytes ->
# the ORIGINAL UTF-8 text) and writes back BOM-less UTF-8.
#
# Detection is derived, not hard-coded: take a KNOWN-CLEAN Chinese file, encode
# its text to UTF-8, decode those bytes as GBK -- the result is the "mojibake
# alphabet". Damaged files are dense with those rare forms; clean files are not.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\fix-encoding.ps1 -Scan
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\fix-encoding.ps1 -Repair src\client\split.tsx
#
# Bytes the original ANSI decode already destroyed come back as U+FFFD; the
# script lists them with line numbers for hand repair.

param(
  [switch]$Scan,
  [switch]$Repair,
  [string[]]$Files = @(),
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [string]$Corpus = ''
)

$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.Encoding]::UTF8
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$gbk = [System.Text.Encoding]::GetEncoding(936)

function Read-Utf8([string]$path) {
  return $utf8.GetString([System.IO.File]::ReadAllBytes($path))
}

# --- the mojibake alphabet, derived from a known-clean Chinese file ----------
if ($Corpus -eq '') {
  $candidates = @(
    (Join-Path $Root '..\DSH-better-sidebar\src\client\locales.ts'),
    (Join-Path $Root '..\dsh-worktable\src\client\locales.ts')
  )
  $Corpus = ($candidates | Where-Object { Test-Path $_ } | Select-Object -First 1)
}
if (-not $Corpus -or -not (Test-Path $Corpus)) {
  Write-Error 'need a known-clean Chinese file for -Corpus (none found next to this repo)'
  exit 2
}
$cleanText = Read-Utf8 $Corpus
$alphabet = [System.Collections.Generic.HashSet[char]]::new()
foreach ($ch in $gbk.GetString($utf8.GetBytes($cleanText)).ToCharArray()) {
  if ([int][char]$ch -gt 127) { [void]$alphabet.Add($ch) }
}
Write-Output ("corpus: {0}  (mojibake alphabet: {1} chars)" -f (Split-Path -Leaf $Corpus), $alphabet.Count)

function Get-MojiCount([string]$text) {
  $n = 0
  foreach ($ch in $text.ToCharArray()) { if ($alphabet.Contains($ch)) { $n++ } }
  return $n
}

function Convert-Back([string]$text) {
  return $utf8.GetString($gbk.GetBytes($text))
}

function Get-Targets {
  $out = @()
  foreach ($d in @('src', 'tests', 'tools')) {
    $p = Join-Path $Root $d
    if (Test-Path $p) {
      $out += Get-ChildItem -Path $p -Recurse -File -Include *.ts, *.tsx, *.js, *.mjs, *.md, *.json, *.css, *.yml |
        Where-Object { $_.FullName -notmatch '\\(node_modules|lib|\.tmp)\\' }
    }
  }
  foreach ($f in @('README.md', 'package.json', 'dsh.plugin.json', 'cordis.patch.yml')) {
    $p = Join-Path $Root $f
    if (Test-Path $p) { $out += Get-Item $p }
  }
  return $out
}

if (-not $Repair) {
  $flagged = 0
  foreach ($f in Get-Targets) {
    $text = Read-Utf8 $f.FullName
    $cjk = ([regex]::Matches($text, '[\u4e00-\u9fff]')).Count
    if ($cjk -lt 20) { continue }
    $before = Get-MojiCount $text
    # A genuinely damaged file has almost EVERY hanzi in mojibake form; a clean
    # file only hits the alphabet incidentally (the derived alphabet contains a
    # few common forms because 3-byte UTF-8 sequences shift the GBK pairing).
    $ratio = $before / $cjk
    $afterRatio = (Get-MojiCount (Convert-Back $text)) / $cjk
    if ($ratio -gt 0.5 -and $afterRatio -lt 0.2) {
      $flagged++
      Write-Output ("DAMAGED {0}  mojibake/hanzi={1:P0} ({2}/{3})  after-reverse={4:P0}" -f `
        $f.FullName.Substring($Root.Length + 1), $ratio, $before, $cjk, $afterRatio)
    }
  }
  if ($flagged -eq 0) { Write-Output 'scan: no damaged file found' }
  else { Write-Output ("scan: {0} damaged file(s)" -f $flagged) }
  exit 0
}

if ($Files.Count -eq 0) { Write-Error 'usage: -Repair <file...>'; exit 2 }
foreach ($rel in $Files) {
  $path = if ([System.IO.Path]::IsPathRooted($rel)) { $rel } else { Join-Path $Root $rel }
  $text = Read-Utf8 $path
  $before = Get-MojiCount $text
  $fixed = Convert-Back $text
  [System.IO.File]::WriteAllText($path, $fixed, $utf8NoBom)
  $lossy = 0
  $lines = $fixed -split "`n"
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].IndexOf([char]0xFFFD) -ge 0) {
      $lossy++
      Write-Output ("  line {0}: {1}" -f ($i + 1), $lines[$i].Trim())
    }
  }
  Write-Output ("{0}: mojibake chars {1} -> {2}, unrepairable bytes on {3} line(s)" -f $rel, $before, (Get-MojiCount $fixed), $lossy)
}
