# CID Registry (Polygon)

This contract stores:
- `ownerId` (your app user ID)
- `cid` (IPFS CID)
- `submittedBy` (backend wallet address)
- `timestamp`

Use this for a custodial flow where end users do not need wallets/MetaMask.

## Deploy with Remix (fastest)

1. Open https://remix.ethereum.org
2. Create a new file named `CIDRegistry.sol` and paste the contents from this folder.
3. Compile with Solidity `0.8.20` or newer.
4. Deploy using your MetaMask wallet on Polygon (mainnet or testnet).

## Backend config (custodial mode)

Set these in `backend/.env`:

```
BLOCKCHAIN_RPC_URL=https://your-rpc-endpoint
BLOCKCHAIN_PRIVATE_KEY=0xYourBackendWalletPrivateKey
CID_REGISTRY_CONTRACT_ADDRESS=0xYourDeployedContract
BLOCKCHAIN_CHAIN_ID=137
```

Use `137` for Polygon mainnet or `80002` for Polygon Amoy testnet.

Do not expose `BLOCKCHAIN_PRIVATE_KEY` to frontend code or commit it to git.

## Frontend config

After deployment, set the contract address in a Vite env file:

```
VITE_CID_CONTRACT_ADDRESS=0xYourDeployedContract
VITE_CHAIN_ID=137
```

Use `137` for Polygon mainnet or `80002` for Polygon Amoy testnet.

Restart the frontend dev server after updating env variables.

## Small local blockchain

For an offline demo chain, the repository also includes a Besu-based local network.

Run this from the repository root:

```powershell
./start-local-chain.ps1
```

That script starts the mini chain, deploys `CIDRegistry.sol`, and writes the deployed address into `backend/.env.local` and `frontend/.env.local`.
