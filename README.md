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

## Development

- **Backend**: Runs on `http://localhost:5000`
- **Frontend**: Runs on `http://localhost:5173` (with Vite)

## Database

SQLite database (`care-connect.db`) is automatically created and initialized on first run.

## License

[Specify your license here]

## Contributing

[Add contribution guidelines]
