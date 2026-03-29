$ErrorActionPreference = "SilentlyContinue"
$dockerExe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
& $dockerExe rm -f node1 node2 node3 node4 | Out-Null
& $dockerExe network rm besu-demo | Out-Null
Write-Output "Demo network stopped"
