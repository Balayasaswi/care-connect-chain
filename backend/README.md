# Care Connect Chain - Backend API

SQLite database with authentication for students and guardians.

## Database Schema

### Users Table (Students)
- `id` - Hexadecimal UUID (auto-generated unique identifier)
- `username` - Unique username
- `email` - Unique email address
- `password` - Hashed password (bcrypt)
- `created_at` - Timestamp

### Guardians Table (Weak Entity)
- `student_id` - Primary key & Foreign key to users(id)
- `guardian_name` - Guardian's full name
- `guardian_email` - Guardian's email (optional)
- `guardian_phone` - Guardian's phone (optional)
- `relationship` - Relationship to student (e.g., "parent", "guardian")
- `created_at` - Timestamp

## API Endpoints

### Authentication

#### Register Student
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "a1b2c3d4e5f6...",
  "message": "Registration successful"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "a1b2c3d4e5f6...",
    "username": "john_doe",
    "email": "john@example.com",
    "created_at": "2026-02-05 10:30:00"
  }
}
```

#### Get User Profile
```http
GET /api/user/:userId
```

### Guardian Management

#### Add/Update Guardian
```http
POST /api/guardian/:studentId
Content-Type: application/json

{
  "guardian_name": "Jane Doe",
  "guardian_email": "jane@example.com",
  "guardian_phone": "+1234567890",
  "relationship": "parent"
}
```

#### Get Guardian
```http
GET /api/guardian/:studentId
```

**Response:**
```json
{
  "student_id": "a1b2c3d4e5f6...",
  "guardian_name": "Jane Doe",
  "guardian_email": "jane@example.com",
  "guardian_phone": "+1234567890",
  "relationship": "parent",
  "created_at": "2026-02-05 10:35:00"
}
```

### Chat (Groq AI)

#### Send Chat Message
```http
POST /api/chat
Content-Type: application/json

{
  "history": [],
  "message": "Hello, I need help with my homework",
  "systemInstruction": "You are a helpful tutor..."
}
```

### IPFS

#### Pin JSON to IPFS
```http
POST /api/ipfs/pin-json
Content-Type: application/json

{
  "data": { "type": "session", "userId": "abc123", "payload": { "hello": "world" } },
  "name": "care-connect-session",
  "metadata": { "keyvalues": { "app": "care-connect" } },
  "options": { "cidVersion": 1 }
}
```

### Blockchain

#### Store CID On-Chain
```http
POST /api/blockchain/store-cid
Content-Type: application/json

{
  "cid": "bafy...",
  "userId": "student-id",
  "sessionId": "session-123"
}
```

This route uses a server-held wallet to call the CID registry contract.
The browser does not need MetaMask.
The contract stores ownership as your app `userId` plus the `cid`.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```env
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
HOST=0.0.0.0

# IPFS mode (default: local)
IPFS_PROVIDER=local
IPFS_API_BASE=http://127.0.0.1:5001/api/v0
IPFS_GATEWAY_BASE=http://127.0.0.1:8080/ipfs
# Optional read fallback gateways (comma-separated)
IPFS_READ_GATEWAYS=http://127.0.0.1:8080/ipfs,https://gateway.pinata.cloud/ipfs

# Optional: Pinata mode if needed
# IPFS_PROVIDER=pinata
# PINATA_JWT=your_pinata_jwt_here
# PINATA_API_KEY=your_pinata_api_key_here
# PINATA_API_SECRET=your_pinata_api_secret_here

# Optional: server-side blockchain proof
# BLOCKCHAIN_RPC_URL=https://your-rpc-endpoint
# BLOCKCHAIN_PRIVATE_KEY=0xyourserverwalletprivatekey
# CID_REGISTRY_CONTRACT_ADDRESS=0xyourdeployedcidregistry
# BLOCKCHAIN_CHAIN_ID=80002
```

Security note: never share these secrets with anyone (including chat). Keep them only in `backend/.env` on your server.

3. Start server:
```bash
npm start
```

The database (`care-connect.db`) will be created automatically on first run.

## Local IPFS For Exhibition

Run a local IPFS node (Kubo) on your laptop:

1. Install Kubo from the official IPFS distributions.
2. Initialize the node once:
```bash
ipfs init
```
3. Start daemon:
```bash
ipfs daemon
```
4. Keep daemon running while backend is running.

With this setup, your backend pins and reads CIDs through your laptop node (no paid platform required).

## Tech Stack

- **Express.js** - Web framework
- **better-sqlite3** - SQLite database (file-based, no separate server needed)
- **bcryptjs** - Password hashing
- **uuid** - Hexadecimal ID generation
- **Groq SDK** - LLM API (llama-3.3-70b-versatile)
- **dotenv** - Environment variables
