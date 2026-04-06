import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';
import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendDir, '..');

const contractPath = path.join(projectRoot, 'contracts', 'CIDRegistry.sol');
const backendEnvLocalPath = path.join(backendDir, '.env.local');
const frontendEnvLocalPath = path.join(projectRoot, 'frontend', '.env.local');

const DEFAULT_RPC_URL = 'http://127.0.0.1:8545';
const DEFAULT_PRIVATE_KEY = '0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63';
const DEFAULT_CHAIN_ID = 1337;

function loadValue(name, fallback) {
  const value = String(process.env[name] || '').trim();
  return value || fallback;
}

function compileContract(source, contractFileName, contractName) {
  const input = {
    language: 'Solidity',
    sources: {
      [contractFileName]: {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (Array.isArray(output.errors) && output.errors.length) {
    const fatalErrors = output.errors.filter((entry) => entry.severity === 'error');
    if (fatalErrors.length) {
      const message = fatalErrors
        .map((entry) => entry.formattedMessage || entry.message)
        .join('\n');
      throw new Error(message);
    }
  }

  const artifact = output.contracts?.[contractFileName]?.[contractName];
  if (!artifact) {
    throw new Error(`Unable to compile ${contractName}`);
  }

  const bytecode = artifact.evm?.bytecode?.object;
  if (!bytecode) {
    throw new Error(`Missing bytecode for ${contractName}`);
  }

  return {
    abi: artifact.abi,
    bytecode: `0x${bytecode}`,
  };
}

function upsertEnvFile(filePath, values) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

  const lines = existing
    .split(/\r?\n/)
    .filter((line, index, array) => !(line === '' && index === array.length - 1));

  const updatedKeys = new Set();
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match) {
      return line;
    }

    const key = match[1];
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      updatedKeys.add(key);
      return `${key}=${values[key]}`;
    }

    return line;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!updatedKeys.has(key)) {
      nextLines.push(`${key}=${value}`);
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${nextLines.join('\n')}\n`, 'utf8');
}

async function main() {
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract file not found: ${contractPath}`);
  }

  const rpcUrl = loadValue('BLOCKCHAIN_RPC_URL', DEFAULT_RPC_URL);
  const privateKey = loadValue('BLOCKCHAIN_PRIVATE_KEY', DEFAULT_PRIVATE_KEY);
  const chainId =
    Number.parseInt(loadValue('BLOCKCHAIN_CHAIN_ID', String(DEFAULT_CHAIN_ID)), 10) ||
    DEFAULT_CHAIN_ID;

  const source = fs.readFileSync(contractPath, 'utf8');
  const { abi, bytecode } = compileContract(source, 'CIDRegistry.sol', 'CIDRegistry');

  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chainId) {
    throw new Error(
      `RPC chainId ${Number(network.chainId)} does not match expected chainId ${chainId}`,
    );
  }

  const wallet = new Wallet(privateKey, provider);
  const address = await wallet.getAddress();
  const factory = new ContractFactory(abi, bytecode, wallet);

  console.log(`Deploying CIDRegistry from ${address} to ${rpcUrl}...`);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const deployedAddress = await contract.getAddress();

  upsertEnvFile(backendEnvLocalPath, {
    BLOCKCHAIN_RPC_URL: rpcUrl,
    BLOCKCHAIN_PRIVATE_KEY: privateKey,
    CID_REGISTRY_CONTRACT_ADDRESS: deployedAddress,
    BLOCKCHAIN_CHAIN_ID: String(chainId),
  });

  upsertEnvFile(frontendEnvLocalPath, {
    VITE_CID_CONTRACT_ADDRESS: deployedAddress,
    VITE_CHAIN_ID: String(chainId),
  });

  console.log(`CIDRegistry deployed at ${deployedAddress}`);
  console.log(`Updated ${path.relative(projectRoot, backendEnvLocalPath)}`);
  console.log(`Updated ${path.relative(projectRoot, frontendEnvLocalPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
