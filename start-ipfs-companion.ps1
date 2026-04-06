param(
  [string[]]$AllowedOrigins = @('http://localhost:5173', 'http://127.0.0.1:5173'),
  [switch]$SkipCorsConfig
)

$ErrorActionPreference = 'Stop'

function Test-IpfsInstalled {
  return [bool](Get-Command ipfs -ErrorAction SilentlyContinue)
}

function Test-IpfsDaemonRunning {
  try {
    ipfs id | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function To-JsonArrayLiteral {
  param([string[]]$Items)

  $escaped = @($Items | ForEach-Object {
    '"' + ($_ -replace '"', '\\"') + '"'
  })

  return '[' + ($escaped -join ',') + ']'
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

$daemonRunning = Test-IpfsDaemonRunning

if ($daemonRunning) {
  Write-Host 'IPFS daemon is already running.' -ForegroundColor Green
  if (-not $SkipCorsConfig) {
    Write-Host 'Skipping automatic CORS update while daemon is already active.' -ForegroundColor Yellow
    $SkipCorsConfig = $true
  }
}

if (-not $SkipCorsConfig) {
  $origins = @($AllowedOrigins | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($origins.Count -eq 0) {
    $origins = @('http://localhost:5173', 'http://127.0.0.1:5173')
  }

  $originsJson = To-JsonArrayLiteral -Items $origins
  $methodsJson = To-JsonArrayLiteral -Items @('GET', 'POST', 'PUT', 'OPTIONS')
  $headersJson = To-JsonArrayLiteral -Items @('Authorization', 'Content-Type', 'X-Requested-With')

  Write-Host 'Applying API CORS settings for browser access...' -ForegroundColor Cyan
  $corsApplied = $true

  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin $originsJson 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { $corsApplied = $false }

  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods $methodsJson 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { $corsApplied = $false }

  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers $headersJson 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { $corsApplied = $false }

  if ($corsApplied) {
    Write-Host 'IPFS API CORS configured.' -ForegroundColor Green
  } else {
    Write-Host 'Could not auto-configure IPFS CORS on this shell. App will continue with fallback mode when needed.' -ForegroundColor Yellow
  }
}

if ($daemonRunning) {
  Write-Host 'Companion node is ready. You can keep using your app now.' -ForegroundColor Green
  exit 0
}

Write-Host 'Starting local IPFS daemon (companion node)...' -ForegroundColor Green
Write-Host 'Keep this window open while using the app on this laptop.' -ForegroundColor Yellow
ipfs daemon
