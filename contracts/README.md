# CID Registry (Polygon)

This contract stores only the IPFS CID plus the sender address and timestamp.

## Deploy with Remix (fastest)

1. Open https://remix.ethereum.org
2. Create a new file named `CIDRegistry.sol` and paste the contents from this folder.
3. Compile with Solidity `0.8.20` or newer.
4. Deploy using your MetaMask wallet on Polygon (mainnet or testnet).

## Frontend config

After deployment, set the contract address in a Vite env file:

```
VITE_CID_CONTRACT_ADDRESS=0xYourDeployedContract
VITE_CHAIN_ID=137
```

Use `137` for Polygon mainnet or `80002` for Polygon Amoy testnet.

Restart the frontend dev server after updating env variables.
