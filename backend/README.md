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

### IPFS (Pinata)

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

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```env
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
PINATA_JWT=your_pinata_jwt_here
# Or use API key + secret instead of JWT
# PINATA_API_KEY=your_pinata_api_key_here
# PINATA_API_SECRET=your_pinata_api_secret_here
```

3. Start server:
```bash
npm start
```

The database (`care-connect.db`) will be created automatically on first run.

## Tech Stack

- **Express.js** - Web framework
- **better-sqlite3** - SQLite database (file-based, no separate server needed)
- **bcryptjs** - Password hashing
- **uuid** - Hexadecimal ID generation
- **Groq SDK** - LLM API (llama-3.3-70b-versatile)
- **dotenv** - Environment variables
