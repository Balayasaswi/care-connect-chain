const mode = String(process.argv[2] || 'skip')
  .trim()
  .toLowerCase();

function printLines(lines) {
  for (const line of lines) {
    console.log(line);
  }
}

if (mode === 'skip') {
  printLines([
    '# Railway variables (skip mode)',
    'GROQ_API_KEY=your_groq_key',
    'HOST=0.0.0.0',
    'PORT=5000',
    'IPFS_PROVIDER=pinata',
    'PINATA_JWT=your_pinata_jwt',
    'IPFS_GATEWAY_BASE=https://gateway.pinata.cloud/ipfs',
    'IPFS_READ_GATEWAYS=https://gateway.pinata.cloud/ipfs,https://ipfs.io/ipfs',
    'BLOCKCHAIN_OPTIONAL=true',
    '# Keep blockchain vars empty/unset in skip mode',
  ]);
  process.exit(0);
}

if (mode === 'amoy') {
  const rpcUrl = String(
    process.env.BLOCKCHAIN_RPC_URL || 'https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY',
  ).trim();
  const privateKey = String(
    process.env.BLOCKCHAIN_PRIVATE_KEY || '0xYOUR_TEST_WALLET_PRIVATE_KEY',
  ).trim();
  const contract = String(
    process.env.CID_REGISTRY_CONTRACT_ADDRESS || '0xYOUR_DEPLOYED_CONTRACT',
  ).trim();

  printLines([
    '# Railway variables (amoy mode)',
    'GROQ_API_KEY=your_groq_key',
    'HOST=0.0.0.0',
    'PORT=5000',
    'IPFS_PROVIDER=pinata',
    'PINATA_JWT=your_pinata_jwt',
    'IPFS_GATEWAY_BASE=https://gateway.pinata.cloud/ipfs',
    'IPFS_READ_GATEWAYS=https://gateway.pinata.cloud/ipfs,https://ipfs.io/ipfs',
    'BLOCKCHAIN_OPTIONAL=true',
    `BLOCKCHAIN_RPC_URL=${rpcUrl}`,
    `BLOCKCHAIN_PRIVATE_KEY=${privateKey}`,
    `CID_REGISTRY_CONTRACT_ADDRESS=${contract}`,
    'BLOCKCHAIN_CHAIN_ID=80002',
  ]);
  process.exit(0);
}

console.error('Unknown mode. Use: node scripts/print-railway-env.mjs skip|amoy');
process.exit(1);
