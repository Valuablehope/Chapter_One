# Bootstraps whatever this toolkit needs to run, then starts the GUI.
#
# The client's machine normally has no system-wide Node.js - the app bundles
# its own Node runtime inside Electron, which isn't something a shell script
# can invoke directly. Rather than requiring the operator to install Node.js
# by hand, this script:
#   1. Uses a suitable system Node.js if one is already on PATH.
#   2. Otherwise reuses a portable copy already downloaded by a previous run.
#   3. Otherwise downloads the official Windows x64 build straight from
#      nodejs.org, verifies its SHA-256 against nodejs.org's own published
#      checksums, and extracts it locally under .node-portable/ - no
#      installer, no admin rights, no system PATH changes, and it can be
#      deleted afterward with zero trace.
#
# Everything after that (npm install, npm run ui) works exactly the same
# regardless of which Node.js was used.

$ErrorActionPreference = 'Stop'
$MinMajorVersion = 18

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$portableDir = Join-Path $root '.node-portable'

function Get-SystemNodeExe {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $cmd) { return $null }
    try {
        $verOutput = & $cmd.Source --version
        if ($verOutput -match '^v(\d+)\.') {
            if ([int]$Matches[1] -ge $MinMajorVersion) {
                return $cmd.Source
            }
        }
    } catch {}
    return $null
}

function Get-PortableNodeExe {
    if (-not (Test-Path $portableDir)) { return $null }
    $exe = Get-ChildItem -Path $portableDir -Filter 'node.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exe) { return $exe.FullName }
    return $null
}

function Install-PortableNode {
    Write-Host 'No suitable Node.js found on this machine - downloading a portable copy from nodejs.org (one-time, ~30 MB)...'
    New-Item -ItemType Directory -Path $portableDir -Force | Out-Null

    # latest-v20.x always points at the newest 20.x LTS release, so this
    # never goes stale and never risks referencing a yanked version.
    $distUrl = 'https://nodejs.org/dist/latest-v20.x'
    $shasums = (Invoke-WebRequest -Uri "$distUrl/SHASUMS256.txt" -UseBasicParsing).Content
    $line = ($shasums -split "`r?`n") | Where-Object { $_ -match 'node-v[\d\.]+-win-x64\.zip$' } | Select-Object -First 1
    if (-not $line) {
        throw "Could not find a win-x64 build listed at $distUrl/SHASUMS256.txt"
    }

    $parts = $line.Trim() -split '\s+'
    $expectedHash = $parts[0].ToLower()
    $fileName = $parts[1].TrimStart('*')
    $zipPath = Join-Path $portableDir $fileName

    Write-Host "Downloading $distUrl/$fileName ..."
    Invoke-WebRequest -Uri "$distUrl/$fileName" -OutFile $zipPath -UseBasicParsing

    $actualHash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
    if ($actualHash -ne $expectedHash) {
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        throw "Downloaded Node.js archive failed checksum verification (expected $expectedHash, got $actualHash). Aborting - try again, or install Node.js manually from nodejs.org."
    }
    Write-Host 'Checksum verified. Extracting...'

    Expand-Archive -Path $zipPath -DestinationPath $portableDir -Force
    Remove-Item $zipPath -Force

    $exe = Get-ChildItem -Path $portableDir -Filter 'node.exe' -Recurse | Select-Object -First 1
    if (-not $exe) {
        throw "Extraction succeeded but node.exe was not found under $portableDir"
    }
    return $exe.FullName
}

try {
    $nodeExe = Get-SystemNodeExe
    if (-not $nodeExe) { $nodeExe = Get-PortableNodeExe }
    if (-not $nodeExe) { $nodeExe = Install-PortableNode }
} catch {
    Write-Host ''
    Write-Host "Could not set up Node.js automatically: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Install it manually from https://nodejs.org (LTS, default options), then run this script again.' -ForegroundColor Red
    exit 1
}

$nodeDir = Split-Path -Parent $nodeExe
$npmCmd = Join-Path $nodeDir 'npm.cmd'
if (-not (Test-Path $npmCmd)) { $npmCmd = 'npm' }

Write-Host "Using Node.js: $nodeExe"
$env:Path = "$nodeDir;$env:Path"

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host 'Installing dependencies (first run only)...'
    & $npmCmd install
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'npm install failed - see the errors above.' -ForegroundColor Red
        exit 1
    }
}

$Port = if ($env:PORT) { $env:PORT } else { 5757 }
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host ''
    Write-Host "Port $Port is already in use - the toolkit is probably already running in another window." -ForegroundColor Yellow
    Write-Host "Open http://localhost:$Port in your browser to use it, or close that other window first and run this again." -ForegroundColor Yellow
    exit 1
}

& $npmCmd run ui
# Propagate the server's exit code so the .bat wrapper can tell success from
# failure - without this, a crashed server (e.g. port already in use) would
# report a clean PowerShell exit and the console window would just close
# before anyone could read why.
exit $LASTEXITCODE
