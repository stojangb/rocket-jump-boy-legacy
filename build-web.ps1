# Builds the static HTML/JavaScript browser port in .\docs.
#
# Requirements: Node.js 20 or newer.
# Usage from PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\build-web.ps1
#
# The Windows Java build is independent and remains in build-windows.ps1.
param(
    [string]$Output = (Join-Path $PSScriptRoot "docs")
)

$ErrorActionPreference = "Stop"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw "Node.js 20 or newer is required to export the original level tables."
}
$nodeVersion = & $node.Source --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(?<major>\d+)\.') {
    throw "Could not determine the installed Node.js version."
}
if ([int]$Matches.major -lt 20) {
    throw "Node.js 20 or newer is required; found $nodeVersion."
}

$assets = Join-Path $Output "assets"
New-Item -ItemType Directory -Force -Path $Output, $assets | Out-Null

Write-Host "==> Copying original game graphics" -ForegroundColor Cyan
Get-ChildItem -Path (Join-Path $PSScriptRoot "res") -Recurse -File -Filter *.png |
    ForEach-Object {
        $relative = $_.FullName.Substring((Join-Path $PSScriptRoot "res").Length + 1)
        $destination = Join-Path $assets $relative
        $directory = Split-Path -Parent $destination
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
        Copy-Item $_.FullName $destination -Force
    }

Write-Host "==> Exporting original level tables" -ForegroundColor Cyan
& $node.Source (Join-Path (Join-Path $PSScriptRoot "tools") "export-levels.mjs") `
    (Join-Path (Join-Path $PSScriptRoot "src") "b.java") (Join-Path $Output "levels.json")
if ($LASTEXITCODE -ne 0) {
    throw "Level table export failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Done: $(Join-Path $Output 'index.html')" -ForegroundColor Green
Write-Host "The browser version runs locally and does not download a Java runtime." -ForegroundColor Green
