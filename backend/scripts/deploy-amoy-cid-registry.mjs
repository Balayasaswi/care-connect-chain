import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import solc from "solc";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendDir, "..");

const contractPath = path.join(projectRoot, "contracts", "CIDRegistry.sol");
const amoyEnvPath = path.join(backendDir, ".env.amoy");

const DEFAULT_CHAIN_ID = 80002;

function loadRequired(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function loadOptional(name, fallback) {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
}

function compileContract(source, contractFileName, contractName) {
  const input = {
    language: "Solidity",
    sources: {
      [contractFileName]: {
        content: source
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (Array.isArray(output.errors) && output.errors.length) {
    const fatalErrors = output.errors.filter((entry) => entry.severity === "error");
    if (fatalErrors.length) {
      const message = fatalErrors.map((entry) => entry.formattedMessage || entry.message).join("\n");
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
    bytecode: `0x${bytecode}`
  };
}

function upsertEnvFile(filePath, values) {
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";

  const lines = existing
    .split(/\r?\n/)
    .filter((line, index, array) => !(line === "" && index === array.length - 1));

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
  fs.writeFileSync(filePath, `${nextLines.join("\n")}\n`, "utf8");
}

async function main() {
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract file not found: ${contractPath}`);
  }

  const rpcUrl = loadRequired("BLOCKCHAIN_RPC_URL");
  const privateKey = loadRequired("BLOCKCHAIN_PRIVATE_KEY");
  const chainId = Number.parseInt(loadOptional("BLOCKCHAIN_CHAIN_ID", String(DEFAULT_CHAIN_ID)), 10) || DEFAULT_CHAIN_ID;

  const source = fs.readFileSync(contractPath, "utf8");
  const { abi, bytecode } = compileContract(source, "CIDRegistry.sol", "CIDRegistry");

  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chainId) {
    throw new Error(`RPC chainId ${Number(network.chainId)} does not match expected chainId ${chainId}`);
  }

  const wallet = new Wallet(privateKey, provider);
  const deployerAddress = await wallet.getAddress();
  const balance = await provider.getBalance(deployerAddress);
  if (balance === 0n) {
    throw new Error("Wallet balance is zero. Fund with Amoy faucet tokens before deploy.");
  }

  const factory = new ContractFactory(abi, bytecode, wallet);

  console.log(`Deploying CIDRegistry from ${deployerAddress} to ${rpcUrl} (chain ${chainId})...`);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const deployedAddress = await contract.getAddress();

  upsertEnvFile(amoyEnvPath, {
    BLOCKCHAIN_RPC_URL: rpcUrl,
    BLOCKCHAIN_PRIVATE_KEY: privateKey,
    CID_REGISTRY_CONTRACT_ADDRESS: deployedAddress,
    BLOCKCHAIN_CHAIN_ID: String(chainId),
    BLOCKCHAIN_OPTIONAL: "true"
  });

  console.log("\nDeployment successful.");
  console.log(`Contract address: ${deployedAddress}`);
  console.log(`Saved local record: ${path.relative(projectRoot, amoyEnvPath)}`);

  console.log("\nSet these Railway variables:");
  console.log(`BLOCKCHAIN_RPC_URL=${rpcUrl}`);
  console.log("BLOCKCHAIN_PRIVATE_KEY=<same wallet private key>");
  console.log(`CID_REGISTRY_CONTRACT_ADDRESS=${deployedAddress}`);
  console.log(`BLOCKCHAIN_CHAIN_ID=${chainId}`);
  console.log("BLOCKCHAIN_OPTIONAL=true");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
