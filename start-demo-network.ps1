$ErrorActionPreference = "Stop"

$dockerExe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $dockerExe)) {
  throw "Docker CLI not found at $dockerExe"
}

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$networkRoot = Join-Path $projectRoot "demo-chain"
$nodeDirs = @(
  Join-Path $networkRoot "Node-1\data",
  Join-Path $networkRoot "Node-2\data",
  Join-Path $networkRoot "Node-3\data",
  Join-Path $networkRoot "Node-4\data"
)

foreach ($dir in $nodeDirs) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

& $dockerExe rm -f node1 node2 node3 node4 2>$null | Out-Null
& $dockerExe network rm besu-demo 2>$null | Out-Null

& $dockerExe run --rm -v "${networkRoot}:/data" hyperledger/besu:latest operator generate-blockchain-config --config-file=/data/ibftConfigFile.json --to=/data/networkFiles --private-key-file-name=key

Copy-Item (Join-Path $networkRoot "networkFiles\genesis.json") (Join-Path $networkRoot "genesis.json") -Force
$keys = Get-ChildItem (Join-Path $networkRoot "networkFiles\keys") | Sort-Object Name
Copy-Item "$($keys[0].FullName)\key*" (Join-Path $networkRoot "Node-1\data") -Force
Copy-Item "$($keys[1].FullName)\key*" (Join-Path $networkRoot "Node-2\data") -Force
Copy-Item "$($keys[2].FullName)\key*" (Join-Path $networkRoot "Node-3\data") -Force
Copy-Item "$($keys[3].FullName)\key*" (Join-Path $networkRoot "Node-4\data") -Force

& $dockerExe network create besu-demo | Out-Null

$pub = (Get-Content (Join-Path $networkRoot "Node-1\data\key.pub") -Raw).Trim()
$boot = "enode://$pub@node1:30303"

& $dockerExe run -d --name node1 --network besu-demo -p 8545:8545 -p 30303:30303 -v "${networkRoot}\Node-1:/opt/besu/node" -v "${networkRoot}\genesis.json:/opt/besu/genesis.json" hyperledger/besu:latest --data-path=/opt/besu/node/data --genesis-file=/opt/besu/genesis.json --rpc-http-enabled --rpc-http-host=0.0.0.0 --rpc-http-port=8545 --rpc-http-api=ETH,NET,WEB3,IBFT,ADMIN --host-allowlist=* --rpc-http-cors-origins=all --p2p-port=30303 --p2p-host=node1 --nat-method=NONE | Out-Null

& $dockerExe run -d --name node2 --network besu-demo -p 8546:8546 -p 30304:30303 -v "${networkRoot}\Node-2:/opt/besu/node" -v "${networkRoot}\genesis.json:/opt/besu/genesis.json" hyperledger/besu:latest --data-path=/opt/besu/node/data --genesis-file=/opt/besu/genesis.json --bootnodes=$boot --rpc-http-enabled --rpc-http-host=0.0.0.0 --rpc-http-port=8546 --rpc-http-api=ETH,NET,WEB3,IBFT,ADMIN --host-allowlist=* --rpc-http-cors-origins=all --p2p-port=30303 --p2p-host=node2 --nat-method=NONE | Out-Null

& $dockerExe run -d --name node3 --network besu-demo -p 8547:8547 -p 30305:30303 -v "${networkRoot}\Node-3:/opt/besu/node" -v "${networkRoot}\genesis.json:/opt/besu/genesis.json" hyperledger/besu:latest --data-path=/opt/besu/node/data --genesis-file=/opt/besu/genesis.json --bootnodes=$boot --rpc-http-enabled --rpc-http-host=0.0.0.0 --rpc-http-port=8547 --rpc-http-api=ETH,NET,WEB3,IBFT,ADMIN --host-allowlist=* --rpc-http-cors-origins=all --p2p-port=30303 --p2p-host=node3 --nat-method=NONE | Out-Null

& $dockerExe run -d --name node4 --network besu-demo -p 8548:8548 -p 30306:30303 -v "${networkRoot}\Node-4:/opt/besu/node" -v "${networkRoot}\genesis.json:/opt/besu/genesis.json" hyperledger/besu:latest --data-path=/opt/besu/node/data --genesis-file=/opt/besu/genesis.json --bootnodes=$boot --rpc-http-enabled --rpc-http-host=0.0.0.0 --rpc-http-port=8548 --rpc-http-api=ETH,NET,WEB3,IBFT,ADMIN --host-allowlist=* --rpc-http-cors-origins=all --p2p-port=30303 --p2p-host=node4 --nat-method=NONE | Out-Null

$peer = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8545" -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
$chain = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8545" -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

Write-Output "Network ready"
Write-Output "Node-1 RPC: http://127.0.0.1:8545"
Write-Output "PeerCount: $($peer.result)"
Write-Output "ChainIdHex: $($chain.result)"
Write-Output "Import this funded private key in MetaMask: 0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63"
