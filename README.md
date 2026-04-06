# Care Connect Chain

A comprehensive care coordination platform leveraging blockchain technology and AI-powered insights for secure student support networks.

## Project Structure

```
├── backend/          # Node.js Express backend API
├── frontend/         # React TypeScript frontend (Vite)
├── contracts/        # Solidity smart contracts
├── demo-chain/       # Local blockchain network configuration
└── exports/          # CSV exports for blockchain data
```

## Features

- **User Management**: Students, guardians, counsellors, and institutions
- **Chat Integration**: AI-powered chat with Groq and Google Gemini
- **Blockchain Storage**: IPFS integration with blockchain registry
- **Network Connections**: Secure care team coordination
- **Session Management**: Encrypted session handling and summaries

## Prerequisites

- Node.js (v16+)
- npm or yarn
- Git
- PowerShell (for network management scripts)
- Ethereum-compatible blockchain node (for Besu/contract deployment)

## Installation

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Smart Contracts

```bash
cd contracts
# Configure your blockchain connection in truffle-config.js or hardhat.config.js
# Deploy using your blockchain framework
```

## Configuration

### Backend Environment Variables (.env)

```
PORT=5000
GROQ_API_KEY=your_groq_key
PINATA_JWT=your_pinata_jwt
# or
PINATA_API_KEY=your_api_key
PINATA_API_SECRET=your_api_secret
```

### Frontend Environment Variables (.env)

Configure blockchain and service endpoints as needed.

## Running the Network

```powershell
# Start demo network
./start-demo-network.ps1

# Stop demo network
./stop-demo-network.ps1
```

## Railway Deployment (Single Service)

This repository is configured for one Railway service that:
- Builds `frontend/dist`
- Starts `backend/server.js`
- Serves the frontend from the backend process

Files used by Railway:
- `railway.json` for build command
- `Procfile` for start command

### Steps

1. Push this repository to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Add environment variables in Railway service settings:

Required:
- `GROQ_API_KEY`
- `HOST=0.0.0.0`
- `PORT` (Railway can inject this automatically)

IPFS for cloud deployment:
- `IPFS_PROVIDER=pinata`
- `PINATA_JWT` (or `PINATA_API_KEY` + `PINATA_API_SECRET`)
- Optional: `IPFS_GATEWAY_BASE=https://gateway.pinata.cloud/ipfs`
- Optional: `IPFS_READ_GATEWAYS=https://gateway.pinata.cloud/ipfs,https://ipfs.io/ipfs`

Blockchain proof (optional but recommended):
- `BLOCKCHAIN_RPC_URL` (public testnet RPC)
- `BLOCKCHAIN_PRIVATE_KEY`
- `CID_REGISTRY_CONTRACT_ADDRESS`
- `BLOCKCHAIN_CHAIN_ID`
- `BLOCKCHAIN_OPTIONAL=true`

4. Deploy. Railway will run the configured build and start commands automatically.

### Important Notes

- Do not use local-only values (for example `127.0.0.1:8545` or local IPFS daemon URLs) in Railway.
- If local override files exist from demo scripts (`backend/.env.local`, `frontend/.env.local`), do not commit them.
- Frontend defaults to same-origin API in production, so `VITE_API_BASE_URL` is optional for single-service deployment.

### Free Blockchain On Railway (Polygon Amoy)

Use this when you want public internet demo with no real-money gas.

1. Create free RPC endpoint (Alchemy/Infura/Ankr) for Polygon Amoy.
2. Create a fresh test wallet (do not reuse your personal wallet).
3. Request Amoy faucet tokens to that wallet address.
4. In `backend`, install deps if needed:

```powershell
cd backend
npm install
```

5. Set local env for deploy command (PowerShell example):

```powershell
$env:BLOCKCHAIN_RPC_URL="https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY"
$env:BLOCKCHAIN_PRIVATE_KEY="0xYOUR_TEST_WALLET_PRIVATE_KEY"
$env:BLOCKCHAIN_CHAIN_ID="80002"
```

6. Deploy contract:

```powershell
npm run deploy:amoy
```

7. Copy printed values into Railway service variables:
- `BLOCKCHAIN_RPC_URL`
- `BLOCKCHAIN_PRIVATE_KEY`
- `CID_REGISTRY_CONTRACT_ADDRESS`
- `BLOCKCHAIN_CHAIN_ID=80002`
- `BLOCKCHAIN_OPTIONAL=true`

8. Redeploy Railway service.

Notes:
- This is free for testing because Amoy uses test tokens.
- Mainnet deployment always needs real gas fees.
- Use `backend/.env.amoy.example` as template for local setup.

## Distributed IPFS Behavior (Per Laptop)

The frontend now stores each session in two places during active chat flow:
- Device-local replica: browser storage on that laptop (persistent local copy)
- Local laptop IPFS node replica: app tries local Kubo daemon first (`http://127.0.0.1:5001/api/v0` by default)
- Browser IPFS node replica fallback: Helia + IndexedDB blockstore (when Kubo is not running)
- Remote pinned replica: backend pinning flow (Pinata) for shared availability

This gives each participating laptop its own local data replica and attempts local IPFS-node behavior, while still keeping a remote pinned copy.

### Do users need external download?

- If users only open the web app in browser: no external download is required, but this is not full always-on IPFS node behavior.
- If users must act as real local IPFS peers: yes, each laptop should run Kubo (external install) or use a packaged desktop app that bundles a node.

### Companion Node Setup Per Laptop (Recommended)

1. Install Kubo once: https://docs.ipfs.tech/install/command-line/
2. From repo root, run:

```powershell
./start-ipfs-companion.ps1
```

3. Keep that terminal open while the user chats.

Optional custom frontend origin allowlist:

```powershell
./start-ipfs-companion.ps1 -AllowedOrigins @('http://localhost:5173','https://your-frontend-domain')
```

Important practical limits for browsers:
- Browser IPFS peers are not always reachable like always-on server nodes.
- Peer discovery and relay quality depends on browser/network restrictions.
- If browser IPFS is limited, the app still keeps a device-local copy and continues remote pinning.

## Small Local Blockchain

If you want a tiny private chain for testing or demos, use the bundled Besu network:

```powershell
./start-local-chain.ps1
```

This will:
- Start a 4-node local blockchain with chain ID `1337`
- Deploy `contracts/CIDRegistry.sol`
- Write the deployed contract address into `backend/.env.local` and `frontend/.env.local`
- Keep the app talking to the local chain without public-network fees

Stop it with:

```powershell
./stop-demo-network.ps1
```

If you want to use Polygon again, remove or rename the `.env.local` files and restore your Polygon RPC and contract settings in `backend/.env`.

## Exhibition Startup (Same College Wi-Fi)

Use this one command from the repository root:

```powershell
./start-exhibition.ps1
```

What it does:
- Starts local IPFS daemon (if installed and not already running)
- Starts backend on `0.0.0.0:5000`
- Starts frontend on `0.0.0.0:5173`
- Prints your laptop LAN URL for other devices on the same Wi-Fi

Requirements:
- `ipfs` CLI (Kubo) installed for local IPFS mode
- Firewall allows inbound ports `5000` and `5173`

## Development

- **Backend**: Runs on `http://localhost:5000`
- **Frontend**: Runs on `http://localhost:5173` (with Vite)

## Database

SQLite database (`care-connect.db`) is automatically created and initialized on first run.

## License

[Specify your license here]

## Contributing

[Add contribution guidelines]
