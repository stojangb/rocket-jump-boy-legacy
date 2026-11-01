# Prepares the self-contained JavaScript/Canvas browser game for GitHub Pages.
# The Java sources and Windows build are left unchanged.

$ErrorActionPreference = "Stop"

$res = Join-Path $PSScriptRoot "res"
$output = Join-Path $PSScriptRoot "docs"
$assetOutput = Join-Path $output "assets"

if (-not (Test-Path $res)) {
    throw "Resource folder not found: $res"
}

Write-Host "==> Preparing browser assets" -ForegroundColor Cyan
if (Test-Path $assetOutput) {
    Remove-Item $assetOutput -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $assetOutput | Out-Null

$assets = Get-ChildItem -Path $res -File -Filter "*.png" | Sort-Object Name
if ($assets.Count -eq 0) {
    throw "No PNG game assets found in $res"
}
foreach ($asset in $assets) {
    Copy-Item $asset.FullName (Join-Path $assetOutput $asset.Name)
}

$manifest = ConvertTo-Json -InputObject @($assets | ForEach-Object { $_.Name }) -Compress
[System.IO.File]::WriteAllText(
    (Join-Path $assetOutput "manifest.json"),
    $manifest,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Done: copied $($assets.Count) PNG assets to $assetOutput" -ForegroundColor Green
Write-Host "The browser game needs no JDK or external Java runtime." -ForegroundColor Green
