param(
  [string[]]$AllowedOrigins = @('http://localhost:5173', 'http://127.0.0.1:5173'),
  [switch]$SkipCorsConfig
)

$ErrorActionPreference = 'Stop'

function Test-IpfsInstalled {
  return [bool](Get-Command ipfs -ErrorAction SilentlyContinue)
}

if (-not (Test-IpfsInstalled)) {
  Write-Host 'IPFS (Kubo) is not installed on this laptop.' -ForegroundColor Red
  Write-Host 'Install Kubo first: https://docs.ipfs.tech/install/command-line/' -ForegroundColor Yellow
  exit 1
}

$ipfsConfigPath = Join-Path $HOME '.ipfs\config'
if (-not (Test-Path $ipfsConfigPath)) {
  Write-Host 'Initializing local IPFS repository...' -ForegroundColor Cyan
  ipfs init | Out-Host
}

if (-not $SkipCorsConfig) {
  $origins = @($AllowedOrigins | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($origins.Count -eq 0) {
    $origins = @('http://localhost:5173', 'http://127.0.0.1:5173')
  }

  $originsJson = $origins | ConvertTo-Json -Compress
  $methodsJson = @('GET', 'POST', 'PUT', 'OPTIONS') | ConvertTo-Json -Compress
  $headersJson = @('Authorization', 'Content-Type', 'X-Requested-With') | ConvertTo-Json -Compress

  Write-Host 'Applying API CORS settings for browser access...' -ForegroundColor Cyan
  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin "$originsJson" | Out-Host
  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods "$methodsJson" | Out-Host
  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers "$headersJson" | Out-Host
}

Write-Host 'Starting local IPFS daemon (companion node)...' -ForegroundColor Green
Write-Host 'Keep this window open while using the app on this laptop.' -ForegroundColor Yellow
ipfs daemon
