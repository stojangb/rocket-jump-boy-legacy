# Builds the Windows app-image (self-contained .exe + private Java runtime).
#
# Requirements: JDK 17 or newer on JAVA_HOME (or pass -Jdk "C:\path\to\jdk").
# Usage from PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
#
# Output: .\dist\Jump Boy\Jump Boy.exe
param(
    [string]$Jdk = $env:JAVA_HOME,
    [string]$Output = (Join-Path $PSScriptRoot "dist")
)

$ErrorActionPreference = "Stop"

if (-not $Jdk -or -not (Test-Path (Join-Path $Jdk "bin\javac.exe"))) {
    throw "JDK not found. Set JAVA_HOME or pass -Jdk 'C:\path\to\jdk-17'."
}

$src = Join-Path $PSScriptRoot "src"
$res = Join-Path $PSScriptRoot "res"
$icon = Join-Path $PSScriptRoot "icon.ico"
$work = Join-Path $PSScriptRoot "build"
$classes = Join-Path $work "classes"
$input = Join-Path $work "appinput"
$jar = Join-Path $work "JumpBoy.jar"

Write-Host "==> Cleaning" -ForegroundColor Cyan
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $classes, $input | Out-Null

Write-Host "==> Compiling" -ForegroundColor Cyan
$sources = Get-ChildItem -Path $src -Recurse -Filter *.java | ForEach-Object { $_.FullName }
& (Join-Path $Jdk "bin\javac.exe") -encoding UTF-8 -d $classes $sources
if ($LASTEXITCODE -ne 0) { throw "javac failed with exit code $LASTEXITCODE" }

Write-Host "==> Packaging jar" -ForegroundColor Cyan
& (Join-Path $Jdk "bin\jar.exe") --create --file $jar --main-class rocket -C $classes .
if ($LASTEXITCODE -ne 0) { throw "jar failed with exit code $LASTEXITCODE" }

Copy-Item $jar $input
Copy-Item $res (Join-Path $input "res") -Recurse
Remove-Item (Join-Path $input "res\data\data.bin") -Force -ErrorAction SilentlyContinue

Write-Host "==> Building app-image" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Output | Out-Null
Remove-Item (Join-Path $Output "Jump Boy") -Recurse -Force -ErrorAction SilentlyContinue
& (Join-Path $Jdk "bin\jpackage.exe") `
    --type app-image `
    --name "Jump Boy" `
    --app-version 1.1.0 `
    --vendor "SteamHouse - port by OmkarDev" `
    --description "Jump Boy - Rocket Edited" `
    --input $input `
    --main-jar "JumpBoy.jar" `
    --main-class rocket `
    --icon $icon `
    --dest $Output `
    --add-modules "java.desktop" `
    --java-options "-Xmx256m"
if ($LASTEXITCODE -ne 0) { throw "jpackage failed with exit code $LASTEXITCODE" }

Write-Host ""
Write-Host "Done: $(Join-Path $Output 'Jump Boy\Jump Boy.exe')" -ForegroundColor Green
