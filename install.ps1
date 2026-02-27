# barf installer for Windows
# Usage: irm <raw-url>/install.ps1 | iex
#   or:  .\install.ps1 [-InstallDir C:\path\to\bin]

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\barf\bin",
    [string]$Repo = "danielstedman/barf-ts"
)

$ErrorActionPreference = "Stop"

$Binary = "barf-windows-x64.exe"

Write-Host "Detecting platform: windows-x64"
Write-Host "Binary: $Binary"

# Prefer gh CLI for private repos
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "Downloading latest release via gh CLI..."
    $Tag = gh release view --repo $Repo --json tagName -q ".tagName"
    gh release download $Tag --repo $Repo --pattern $Binary --dir $env:TEMP --clobber
} elseif ($env:GITHUB_TOKEN) {
    Write-Host "Downloading latest release via Invoke-WebRequest..."
    $Headers = @{ Authorization = "token $env:GITHUB_TOKEN" }
    $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers $Headers
    $Asset = $Release.assets | Where-Object { $_.name -eq $Binary }
    if (-not $Asset) {
        Write-Error "Binary $Binary not found in release $($Release.tag_name)"
        exit 1
    }
    Invoke-WebRequest -Uri $Asset.browser_download_url -Headers $Headers -OutFile "$env:TEMP\$Binary"
} else {
    Write-Error "gh CLI not found and GITHUB_TOKEN not set. Install gh (https://cli.github.com) or set GITHUB_TOKEN."
    exit 1
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Move-Item -Force "$env:TEMP\$Binary" "$InstallDir\barf.exe"

Write-Host ""
Write-Host "Installed barf to $InstallDir\barf.exe"
Write-Host ""

# Check PATH
if ($env:PATH -notlike "*$InstallDir*") {
    Write-Host "NOTE: $InstallDir is not in your PATH."
    Write-Host "Add it:  `$env:PATH += `";$InstallDir`""
    Write-Host "Or permanently: [Environment]::SetEnvironmentVariable('PATH', `$env:PATH + ';$InstallDir', 'User')"
    Write-Host ""
}

Write-Host "Prerequisites:"
Write-Host "  - claude CLI (required): https://claude.ai/download"
Write-Host "  - gh CLI (optional, for GitHub Issues provider): https://cli.github.com"
Write-Host ""
Write-Host "Get started:  cd your-project; barf init"
