param(
  [switch]$NoRestart
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root "backend"

if (-not (Test-Path $backendPath)) {
  throw "backend folder not found. Run this script from repository root."
}

Set-Location $backendPath

while ($true) {
  Write-Host "Starting backend..." -ForegroundColor Cyan
  npm start
  $exitCode = $LASTEXITCODE

  if ($exitCode -eq 0) {
    Write-Host "Backend process ended with exit code 0." -ForegroundColor Yellow
  } else {
    Write-Host "Backend crashed with exit code $exitCode." -ForegroundColor Red
  }

  if ($NoRestart) {
    break
  }

  Write-Host "Press Enter to restart backend, or close this window to stop." -ForegroundColor Gray
  [void](Read-Host)
}
