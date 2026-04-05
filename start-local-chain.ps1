$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Output "Starting the local Besu demo chain..."
& (Join-Path $projectRoot "start-demo-network.ps1")

$deployScript = Join-Path $projectRoot "backend\scripts\deploy-local-cid-registry.mjs"
if (-not (Test-Path $deployScript)) {
  throw "Deployment script not found at $deployScript"
}

if (-not (Test-Path (Join-Path $projectRoot "backend\node_modules\solc"))) {
  throw "Install backend dependencies first: cd backend; npm install"
}

Write-Output "Deploying CIDRegistry to the local chain..."
node $deployScript

Write-Output "Local blockchain is ready."
Write-Output "Backend env: backend\.env.local"
Write-Output "Frontend env: frontend\.env.local"