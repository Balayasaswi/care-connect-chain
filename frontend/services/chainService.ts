import { BrowserProvider, Contract } from "ethers";

const CID_REGISTRY_ABI = [
  "event CidStored(address indexed user, string cid, uint256 timestamp)",
  "function storeCid(string cid) external"
];

type StoreCidResult = {
  txHash: string;
  chainId: number;
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

const getProvider = () => {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Please install MetaMask.");
  }

  return new BrowserProvider(window.ethereum);
};

const parseChainId = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const connectWallet = async () => {
  const provider = getProvider();
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
};

export const storeCidToChain = async (cid: string, contractAddress: string): Promise<StoreCidResult> => {
  if (!cid) {
    throw new Error("CID is required.");
  }

  const provider = getProvider();
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  const requiredChainId = parseChainId(import.meta.env.VITE_CHAIN_ID);

  if (requiredChainId && Number(network.chainId) !== requiredChainId) {
    throw new Error(`Wrong network. Expected chainId ${requiredChainId}.`);
  }

  const contract = new Contract(contractAddress, CID_REGISTRY_ABI, signer);
  const tx = await contract.storeCid(cid);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    chainId: Number(network.chainId)
  };
};
