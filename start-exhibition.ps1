param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root "backend"
$frontendPath = Join-Path $root "frontend"

function Get-LanIpAddress {
  try {
    $defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction Stop |
      Sort-Object RouteMetric, ifMetric |
      Select-Object -First 1

    if ($defaultRoute) {
      $ip = Get-NetIPAddress -InterfaceIndex $defaultRoute.InterfaceIndex -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
        Select-Object -First 1 -ExpandProperty IPAddress

      if ($ip) { return $ip }
    }
  } catch {
    # Fall through to generic lookup
  }

  $fallbackIp = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -First 1 -ExpandProperty IPAddress

  return $fallbackIp
}

function Start-ToolTerminal {
  param(
    [string]$Title,
    [string]$Command
  )

  if ($DryRun) {
    Write-Host "[DryRun] $Title => $Command" -ForegroundColor Yellow
    return
  }

  $wrapped = "$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $wrapped | Out-Null
}

Write-Host "Preparing exhibition environment..." -ForegroundColor Cyan

if (-not (Test-Path $backendPath) -or -not (Test-Path $frontendPath)) {
  throw "Run this script from the repository root. Missing backend/ or frontend/."
}

$ipfsInstalled = [bool](Get-Command ipfs -ErrorAction SilentlyContinue)
$ipfsRunning = $false

if ($ipfsInstalled) {
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v0/version" -Method Post -TimeoutSec 2
    $ipfsRunning = $true
  } catch {
    $ipfsRunning = $false
  }
} else {
  Write-Host "IPFS CLI not found. Install Kubo to use local IPFS pinning." -ForegroundColor Yellow
}

if ($ipfsInstalled -and -not $ipfsRunning) {
  Write-Host "Starting IPFS daemon in a new terminal..." -ForegroundColor Green
  Start-ToolTerminal -Title "IPFS Daemon" -Command "ipfs daemon"
} elseif ($ipfsInstalled -and $ipfsRunning) {
  Write-Host "IPFS daemon already running." -ForegroundColor Green
}

Write-Host "Starting backend server in a new terminal..." -ForegroundColor Green
$backendCmd = "Set-Location '$backendPath'; `$env:HOST='0.0.0.0'; npm start"
Start-ToolTerminal -Title "Care Connect Backend" -Command $backendCmd

Write-Host "Starting frontend dev server in a new terminal..." -ForegroundColor Green
$frontendCmd = "Set-Location '$frontendPath'; npm run dev -- --host 0.0.0.0 --port 5173"
Start-ToolTerminal -Title "Care Connect Frontend" -Command $frontendCmd

$lanIp = Get-LanIpAddress
if (-not $lanIp) {
  $lanIp = "<YOUR_LAPTOP_IP>"
}

Write-Host ""
Write-Host "Exhibition startup initiated." -ForegroundColor Cyan
Write-Host "Frontend (same Wi-Fi): http://$lanIp`:5173" -ForegroundColor White
Write-Host "Backend API:            http://$lanIp`:5000" -ForegroundColor White
Write-Host ""
Write-Host "Make sure Windows Firewall allows inbound 5173 and 5000." -ForegroundColor Yellow
