# Builds the browser version (GitHub Pages) in .\docs.
#
# Requirements: JDK 17 or newer on JAVA_HOME (or pass -Jdk "C:\path\to\jdk").
# Usage from PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\build-web.ps1
#
# Output: .\docs\jumpboy-web.jar  (the rest of .\docs is static)
#
# The jar embeds res\ so the game works from any URL, including a GitHub
# Pages project page (https://user.github.io/repo/), and extracts the files
# to the browser-persistent /files folder on first run.
param(
    [string]$Jdk = $env:JAVA_HOME,
    [string]$Output = (Join-Path $PSScriptRoot "docs")
)

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSVersion.Major -ge 6) {
    $exeSuffix = if ($IsWindows) { ".exe" } else { "" }
} else {
    $exeSuffix = if ($env:OS -eq "Windows_NT") { ".exe" } else { "" }
}
$bin = if ($Jdk) { Join-Path $Jdk "bin" } else { "" }
$javac = if ($bin) { Join-Path $bin "javac$exeSuffix" } else { "" }
$jarTool = if ($bin) { Join-Path $bin "jar$exeSuffix" } else { "" }

if (-not $Jdk -or -not (Test-Path $javac) -or -not (Test-Path $jarTool)) {
    throw "JDK not found. Set JAVA_HOME or pass -Jdk 'C:\path\to\jdk-17'."
}

$src = Join-Path $PSScriptRoot "src"
$res = Join-Path $PSScriptRoot "res"
$work = Join-Path $PSScriptRoot "build-web"
$classes = Join-Path $work "classes"
$stage = Join-Path $work "stage"
$jar = Join-Path $work "jumpboy-web.jar"

Write-Host "==> Cleaning" -ForegroundColor Cyan
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $classes, $stage | Out-Null

Write-Host "==> Compiling for Java 8 (CheerpJ)" -ForegroundColor Cyan
$sources = Get-ChildItem -Path $src -Recurse -Filter *.java | ForEach-Object { $_.FullName }
Push-Location $src
& $javac --release 8 -encoding UTF-8 -d $classes $sources
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "javac failed with exit code $code" }

Write-Host "==> Packaging web jar" -ForegroundColor Cyan
# List every resource the game loads at runtime (no stale save, no classes).
$files = Get-ChildItem -Path $res -Recurse -File |
    ForEach-Object { $_.FullName.Substring($res.Length + 1).Replace('\', '/') } |
    Where-Object { $_ -notlike 'data/*' -and $_ -notlike 'META-INF/*' -and $_ -notlike '*.class' } |
    Sort-Object
$files | Set-Content -Path (Join-Path $stage "webfiles.txt") -Encoding ASCII

& $jarTool --create --file $jar --main-class rocket `
    -C $classes . -C $PSScriptRoot res -C $stage webfiles.txt
if ($LASTEXITCODE -ne 0) { throw "jar failed with exit code $LASTEXITCODE" }

New-Item -ItemType Directory -Force -Path $Output | Out-Null
Copy-Item $jar (Join-Path $Output "jumpboy-web.jar") -Force

Write-Host ""
Write-Host "Done: $(Join-Path $Output 'jumpboy-web.jar')" -ForegroundColor Green
Write-Host "Publish the .\docs folder with GitHub Pages." -ForegroundColor Green
