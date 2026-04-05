import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registerUser, loginUser, addGuardian, getGuardian, getUserById, getUserByEmail, appendIpfsCsv, appendBlockchainCsv, registerGuardian, loginGuardian, readIpfsEntriesByStudent, readBlockchainEntriesByStudent, registerCounsellor, loginCounsellor, registerInstitution, loginInstitution, getInstitutionByCollegeCode, getGuardiansByEmail, readAllIpfsEntries, getCounsellorByEmail, getUsersByInstitutionCollegeCode, getUsersByCounsellorInstitution, createNetworkConnectionRequest, getNetworkConnectionById, updateNetworkConnectionStatus, listNetworkConnectionsForStudent, listNetworkConnectionsForActor, deleteNetworkConnection, createCounsellorRequest, listCounsellorRequestsForCounsellor, updateCounsellorRequestStatus, createCounsellorSchedule, listCounsellorSchedules, listCounsellorSchedulesForStudent, markCounsellorScheduleReadByStudent, saveSessionArchive, getSessionArchivesByStudent } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

const FRONTEND_DIST_DIR = path.resolve(__dirname, "../frontend/dist");
const FRONTEND_INDEX_FILE = path.join(FRONTEND_DIST_DIR, "index.html");
const PINATA_BASE_URL = "https://api.pinata.cloud";
const PINATA_GATEWAY_BASE = "https://gateway.pinata.cloud/ipfs";
const IPFS_PROVIDER = String(process.env.IPFS_PROVIDER || "local").trim().toLowerCase();
const IPFS_API_BASE = String(process.env.IPFS_API_BASE || "http://127.0.0.1:5001/api/v0").trim().replace(/\/$/, "");
const IPFS_GATEWAY_BASE = String(process.env.IPFS_GATEWAY_BASE || "http://127.0.0.1:8080/ipfs").trim().replace(/\/$/, "");
const IPFS_READ_GATEWAYS = String(process.env.IPFS_READ_GATEWAYS || `${IPFS_GATEWAY_BASE},${PINATA_GATEWAY_BASE}`)
  .split(",")
  .map((item) => item.trim().replace(/\/$/, ""))
  .filter(Boolean);
const CID_REGISTRY_ABI = [
  "function storeCidForOwner(string ownerId, string cid) external",
  "function storeCid(string cid) external"
];
const BLOCKCHAIN_RPC_URL = String(process.env.BLOCKCHAIN_RPC_URL || "").trim();
const BLOCKCHAIN_PRIVATE_KEY = String(process.env.BLOCKCHAIN_PRIVATE_KEY || "").trim();
const CID_REGISTRY_CONTRACT_ADDRESS = String(process.env.CID_REGISTRY_CONTRACT_ADDRESS || process.env.CID_CONTRACT_ADDRESS || "").trim();
const BLOCKCHAIN_CHAIN_ID = parsePositiveInt(process.env.BLOCKCHAIN_CHAIN_ID, 0);
const BLOCKCHAIN_OPTIONAL = String(process.env.BLOCKCHAIN_OPTIONAL || "true").trim().toLowerCase() !== "false";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const IPFS_FETCH_TIMEOUT_MS = parsePositiveInt(process.env.IPFS_FETCH_TIMEOUT_MS, 2500);
const IPFS_FETCH_CONCURRENCY = parsePositiveInt(process.env.IPFS_FETCH_CONCURRENCY, 6);

let blockchainClient = null;

app.use(cors());
app.use(express.json());

function getPinataAuthHeaders() {
  const jwt = process.env.PINATA_JWT;
  if (jwt) {
    return { Authorization: `Bearer ${jwt}` };
  }

  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;
  if (apiKey && apiSecret) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret
    };
  }

  return null;
}

function resolveGatewayUrl(cid, base = IPFS_GATEWAY_BASE) {
  return `${base.replace(/\/$/, "")}/${cid}`;
}

function parseIpfsAddResponse(rawText) {
  const lines = String(rawText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed?.Hash) {
        return parsed;
      }
    } catch {
      // ignore malformed lines
    }
  }

  return null;
}

async function pinJsonWithLocalIpfs(data, name = "care-connect-session") {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([JSON.stringify(data)], { type: "application/json" }),
    `${name}.json`
  );

  const endpoint = new URL(`${IPFS_API_BASE}/add`);
  endpoint.searchParams.set("pin", "true");
  endpoint.searchParams.set("cid-version", "1");

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Local IPFS add failed");
  }

  const rawText = await response.text();
  const parsed = parseIpfsAddResponse(rawText);
  if (!parsed?.Hash) {
    throw new Error("Local IPFS response did not contain a CID");
  }

  return {
    cid: parsed.Hash,
    pinSize: Number(parsed.Size) || undefined,
    timestamp: new Date().toISOString(),
    gatewayUrl: resolveGatewayUrl(parsed.Hash)
  };
}

async function pinJsonWithPinata(data, name, metadata, options) {
  const authHeaders = getPinataAuthHeaders();
  if (!authHeaders) {
    throw new Error("Pinata credentials not configured");
  }

  const pinataMetadata = {
    ...(metadata && typeof metadata === "object" ? metadata : {}),
    ...(name ? { name } : {})
  };

  const payload = {
    pinataContent: data,
    ...(Object.keys(pinataMetadata).length > 0 ? { pinataMetadata } : {}),
    ...(options && typeof options === "object" ? { pinataOptions: options } : {})
  };

  const response = await fetch(`${PINATA_BASE_URL}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Pinata request failed");
  }

  const result = await response.json();
  const cid = result.IpfsHash;

  return {
    cid,
    pinSize: result.PinSize,
    timestamp: result.Timestamp || new Date().toISOString(),
    gatewayUrl: resolveGatewayUrl(cid, PINATA_GATEWAY_BASE)
  };
}

async function pinJsonToIpfs(data, name, metadata, options) {
  if (IPFS_PROVIDER === "pinata") {
    return pinJsonWithPinata(data, name, metadata, options);
  }

  return pinJsonWithLocalIpfs(data, name || "care-connect-session");
}

async function fetchIpfsJson(cid) {
  let lastError = null;
  for (const gateway of IPFS_READ_GATEWAYS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IPFS_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(resolveGatewayUrl(cid, gateway), {
        signal: controller.signal
      });
      if (!response.ok) {
        lastError = new Error(`Gateway ${gateway} returned ${response.status}`);
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError) {
    throw new Error(`Unable to fetch CID ${cid}: ${lastError.message || lastError}`);
  }

  throw new Error("Unable to fetch CID from configured gateways");
}

async function mapWithConcurrency(items, concurrency, worker) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let currentIndex = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (true) {
      const index = currentIndex;
      currentIndex += 1;
      if (index >= items.length) break;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

async function fetchIpfsEntries(entries) {
  return mapWithConcurrency(entries, IPFS_FETCH_CONCURRENCY, async (entry) => {
    try {
      const payload = await fetchIpfsJson(entry.cid);
      return { entry, payload, error: null };
    } catch (error) {
      return { entry, payload: null, error };
    }
  });
}

function getBlockchainClient() {
  if (blockchainClient) {
    return blockchainClient;
  }

  if (!BLOCKCHAIN_RPC_URL || !BLOCKCHAIN_PRIVATE_KEY || !CID_REGISTRY_CONTRACT_ADDRESS) {
    return null;
  }

  const provider = new JsonRpcProvider(BLOCKCHAIN_RPC_URL);
  const wallet = new Wallet(BLOCKCHAIN_PRIVATE_KEY, provider);
  const contract = new Contract(CID_REGISTRY_CONTRACT_ADDRESS, CID_REGISTRY_ABI, wallet);

  blockchainClient = { provider, wallet, contract };
  return blockchainClient;
}

async function storeCidOnChain({ cid, studentId = "", sessionId = "" }) {
  const client = getBlockchainClient();
  if (!client) {
    if (BLOCKCHAIN_OPTIONAL) {
      return {
        success: true,
        skipped: true,
        error: "Blockchain storage is not configured"
      };
    }

    return {
      success: false,
      error: "Blockchain storage is not configured"
    };
  }

  if (!cid) {
    return {
      success: false,
      error: "CID is required"
    };
  }

  if (BLOCKCHAIN_CHAIN_ID) {
    const network = await client.provider.getNetwork();
    if (Number(network.chainId) !== BLOCKCHAIN_CHAIN_ID) {
      return {
        success: false,
        error: `Blockchain RPC chainId ${Number(network.chainId)} does not match configured chainId ${BLOCKCHAIN_CHAIN_ID}`
      };
    }
  }

  const existingEntries = String(studentId || "").trim()
    ? readBlockchainEntriesByStudent(studentId).filter((entry) => String(entry.cid || "") === String(cid))
    : [];

  if (existingEntries.length) {
    return {
      success: true,
      skipped: true,
      record: existingEntries[0]
    };
  }

  const normalizedStudentId = String(studentId || "").trim();
  const ownerId = normalizedStudentId || await client.wallet.getAddress();

  let transaction;
  if (typeof client.contract.storeCidForOwner === "function") {
    transaction = await client.contract.storeCidForOwner(ownerId, cid);
  } else {
    transaction = await client.contract.storeCid(cid);
  }
  const receipt = await transaction.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Blockchain transaction failed");
  }

  const network = await client.provider.getNetwork();
  const block = receipt.blockNumber ? await client.provider.getBlock(receipt.blockNumber) : null;
  const address = await client.wallet.getAddress();
  const timestamp = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : new Date().toISOString();
  const record = {
    chainId: Number(network.chainId) || BLOCKCHAIN_CHAIN_ID || 0,
    address,
    txHash: receipt.hash,
    timestamp,
    studentId: String(studentId || ""),
    sessionId: String(sessionId || ""),
    cid: String(cid || ""),
    contractAddress: CID_REGISTRY_CONTRACT_ADDRESS
  };

  appendBlockchainCsv(record);

  return {
    success: true,
    record
  };
}

let groqClient = null;

function getGroqClient() {
  if (groqClient) {
    return groqClient;
  }

  const apiKey = String(process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing");
  }

  groqClient = new Groq({ apiKey });
  return groqClient;
}

function buildSummaryPrompt(userId, history) {
  const transcript = history
    .map((h) => `${h.role?.toUpperCase?.() || "USER"}: ${h.content}`)
    .join("\n");

  return `Generate a session summary for user ${userId}.
Return ONLY valid JSON. No markdown. No explanations. No extra text.

JSON FORMAT:
{
  "userid": "${userId}",
  "start_time_stamp": "<ISO-8601>",
  "end_time_stamp": "<ISO-8601>",
  "keywords": ["3-8 emotionally relevant terms"],
  "emotion": "CRITICAL | BAD | NEUTRAL | GOOD | HAPPY",
  "summary": "One short sentence (max 18 words)"
}

Keywords must have no stopwords or punctuation.
Emotion: Choose the most fitting one. If uncertain, choose NEUTRAL.
Summary: Keep it brief, plain, and specific. Do not exceed 18 words.

TRANSCRIPT:
${transcript}`;
}

function safeParseSummaryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function shortenSummaryText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Summary unavailable.";

  const firstSentence = text.split(/[.!?]/).map((part) => part.trim()).find(Boolean) || text;
  const words = firstSentence.split(" ").filter(Boolean);
  const limited = words.slice(0, 18).join(" ").trim();
  return limited || "Summary unavailable.";
}

// Encryption removed for now; payloads are stored in IPFS as plain JSON.

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "Care Connect backend running" });
});

// ==================== AUTH ENDPOINTS ====================

// Register new student
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, access_code, college_code } = req.body;

    if (!username || !email || !password || (!access_code && !college_code)) {
      return res.status(400).json({ error: "username, email, password, and college_code (or access_code) are required" });
    }

    const result = await registerUser(username, email, password, {
      accessCode: access_code,
      collegeCode: college_code
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, userId: result.userId, message: "Registration successful" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const result = await loginUser(username, password);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get user profile
app.get("/api/user/:userId", (req, res) => {
  try {
    const user = getUserById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// Get user by email (for guardian access checks)
app.get("/api/user", (req, res) => {
  try {
    const email = (req.query.email || "").toString().toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user by email error:", error);
    res.status(500).json({ error: "Failed to get user by email" });
  }
});

// ==================== NETWORK ENDPOINTS ====================

function parseStatusList(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  return text
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

app.post("/api/network/connect-request", (req, res) => {
  try {
    const { student_id, actor_id, actor_role, relation_type } = req.body || {};
    const studentId = String(student_id || "").trim();
    const actorId = String(actor_id || "").trim();
    const actorRole = String(actor_role || "").trim().toLowerCase();

    if (!studentId || !actorId || !actorRole) {
      return res.status(400).json({ error: "student_id, actor_id and actor_role are required" });
    }

    const student = getUserById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (actorRole === "guardian") {
      const guardians = getGuardiansByEmail(actorId.toLowerCase());
      if (!guardians.length) return res.status(404).json({ error: "Guardian not found" });
    } else if (actorRole === "counsellor") {
      const counsellor = getCounsellorByEmail(actorId.toLowerCase());
      if (!counsellor) return res.status(404).json({ error: "Counsellor not found" });
    } else if (actorRole === "student") {
      const linkedStudent = getUserById(actorId);
      if (!linkedStudent) return res.status(404).json({ error: "Actor student not found" });
    }

    const result = createNetworkConnectionRequest(studentId, actorId, actorRole, relation_type);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, connection: result.connection });
  } catch (error) {
    console.error("Network connect-request error:", error);
    res.status(500).json({ error: "Failed to create network connection request" });
  }
});

app.post("/api/network/approve", (req, res) => {
  try {
    const { connection_id, student_id, status } = req.body || {};
    const connectionId = String(connection_id || "").trim();
    const studentId = String(student_id || "").trim();
    const requestedStatus = String(status || "active").trim().toLowerCase();

    if (!connectionId || !studentId) {
      return res.status(400).json({ error: "connection_id and student_id are required" });
    }

    if (!["active", "rejected", "blocked"].includes(requestedStatus)) {
      return res.status(400).json({ error: "status must be active, rejected, or blocked" });
    }

    const existing = getNetworkConnectionById(connectionId);
    if (!existing) {
      return res.status(404).json({ error: "Connection not found" });
    }

    if (String(existing.student_id) !== studentId) {
      return res.status(403).json({ error: "Only the linked student can approve this connection" });
    }

    const result = updateNetworkConnectionStatus(connectionId, requestedStatus);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, connection: result.connection });
  } catch (error) {
    console.error("Network approve error:", error);
    res.status(500).json({ error: "Failed to update network connection" });
  }
});

app.get("/api/network/my-connections", (req, res) => {
  try {
    const studentId = String(req.query.student_id || "").trim();
    const actorId = String(req.query.actor_id || "").trim();
    const actorRole = String(req.query.actor_role || "").trim().toLowerCase();
    const statuses = parseStatusList(req.query.statuses);

    if (studentId) {
      const connections = listNetworkConnectionsForStudent(studentId, statuses);
      return res.json({ connections });
    }

    if (actorId && actorRole) {
      const connections = listNetworkConnectionsForActor(actorId, actorRole, statuses);
      return res.json({ connections });
    }

    return res.status(400).json({ error: "Provide either student_id OR actor_id + actor_role" });
  } catch (error) {
    console.error("Network my-connections error:", error);
    res.status(500).json({ error: "Failed to fetch network connections" });
  }
});

app.get("/api/network/student/:studentId/network", (req, res) => {
  try {
    const studentId = String(req.params.studentId || "").trim();
    if (!studentId) return res.status(400).json({ error: "studentId is required" });

    const student = getUserById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const activeConnections = listNetworkConnectionsForStudent(studentId, ["active"]);
    res.json({ student, connections: activeConnections });
  } catch (error) {
    console.error("Student network fetch error:", error);
    res.status(500).json({ error: "Failed to fetch student network" });
  }
});

app.delete("/api/network/disconnect", (req, res) => {
  try {
    const { connection_id } = req.body || {};
    const connectionId = String(connection_id || "").trim();
    if (!connectionId) {
      return res.status(400).json({ error: "connection_id is required" });
    }

    const result = deleteNetworkConnection(connectionId);
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Network disconnect error:", error);
    res.status(500).json({ error: "Failed to disconnect network link" });
  }
});

// ==================== GUARDIAN ENDPOINTS ====================

app.post("/api/guardian/register", async (req, res) => {
  try {
    const { guardian_email, guardian_password, student_email, relationship } = req.body || {};

    if (!guardian_email || !guardian_password || !student_email || !relationship) {
      return res.status(400).json({ error: "guardian_email, guardian_password, student_email, and relationship are required" });
    }

    const student = getUserByEmail(String(student_email).toLowerCase().trim());
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const result = await registerGuardian(
      student.id,
      String(guardian_email).toLowerCase().trim(),
      String(guardian_password),
      String(relationship)
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, studentId: student.id });
  } catch (error) {
    console.error("Guardian registration error:", error);
    res.status(500).json({ error: "Guardian registration failed" });
  }
});

app.post("/api/guardian/login", async (req, res) => {
  try {
    const { guardian_email, guardian_password } = req.body || {};

    if (!guardian_email || !guardian_password) {
      return res.status(400).json({ error: "guardian_email and guardian_password are required" });
    }

    const normalizedGuardianEmail = String(guardian_email).toLowerCase().trim();

    const guardians = getGuardiansByEmail(normalizedGuardianEmail);
    if (!guardians.length) {
      return res.status(404).json({ error: "Guardian not found" });
    }
    if (guardians.length > 1) {
      return res.status(409).json({ error: "Guardian email is linked to multiple students. Contact admin support." });
    }

    const studentId = guardians[0].student_id;
    const student = getUserById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Linked student not found" });
    }
    const studentEmail = student.email;

    const result = await loginGuardian(
      studentId,
      normalizedGuardianEmail,
      String(guardian_password)
    );

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({ success: true, guardian: result.guardian, studentId, studentEmail });
  } catch (error) {
    console.error("Guardian login error:", error);
    res.status(500).json({ error: "Guardian login failed" });
  }
});

app.get("/api/guardian/summaries", async (req, res) => {
  try {
    const studentId = String(req.query.student_id || "").trim();
    const guardianEmail = String(req.query.guardian_email || "").toLowerCase().trim();

    if (!studentId || !guardianEmail) {
      return res.status(400).json({ error: "student_id and guardian_email are required" });
    }

    const guardianLinks = getGuardiansByEmail(guardianEmail);
    const hasAccess = guardianLinks.some((record) => String(record.student_id) === studentId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Guardian email mismatch" });
    }

    const entries = readIpfsEntriesByStudent(studentId);
    const archivedSessions = getSessionArchivesByStudent(studentId);

    const summaries = [];
    if (entries.length) {
      const entryResults = await fetchIpfsEntries(entries);
      for (const result of entryResults) {
        if (result.error) {
          console.warn("Guardian summary read failed:", result.error.message || result.error);
          continue;
        }

        if (result.payload?.summary) {
          summaries.push(result.payload.summary);
        }
      }
    }

    if (!summaries.length && archivedSessions.length) {
      for (const session of archivedSessions) {
        if (session?.summary) {
          summaries.push(session.summary);
        }
      }
    }

    res.json({ summaries });
  } catch (error) {
    console.error("Guardian summaries error:", error);
    res.status(500).json({ error: "Failed to fetch summaries" });
  }
});

app.get("/api/sessions", async (req, res) => {
  try {
    const userId = String(req.query.user_id || "").trim();
    const actorRole = String(req.query.actor_role || "").trim().toLowerCase();
    const guardianEmail = String(req.query.guardian_email || "").toLowerCase().trim();
    const collegeCode = String(req.query.college_code || "").trim().toUpperCase();

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (actorRole === "guardian") {
      if (!guardianEmail) {
        return res.status(400).json({ error: "guardian_email is required for guardian access" });
      }

      const guardianLinks = getGuardiansByEmail(guardianEmail);
      const hasAccess = guardianLinks.some((record) => String(record.student_id) === userId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Guardian is not linked to this student" });
      }
    }

    if (actorRole === "institution") {
      if (!collegeCode) {
        return res.status(400).json({ error: "college_code is required for institution access" });
      }

      const institution = getInstitutionByCollegeCode(collegeCode);
      if (!institution) {
        return res.status(404).json({ error: "Invalid college code" });
      }

      if (String(user.institution_college_code || "").toUpperCase() !== collegeCode) {
        return res.status(403).json({ error: "Student does not belong to this institution" });
      }
    }

    const redactHistory = actorRole === "guardian" || actorRole === "institution";

    const entries = readIpfsEntriesByStudent(userId)
      .filter((entry) => entry?.cid)
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    const archivedSessions = getSessionArchivesByStudent(userId);

    const blockchainEntries = readBlockchainEntriesByStudent(userId);
    const onChainByCid = new Map();
    for (const record of blockchainEntries) {
      if (!record?.cid) continue;
      if (!onChainByCid.has(record.cid)) {
        onChainByCid.set(record.cid, record);
      }
    }

    const sessions = [];
    const failedEntries = [];
    if (entries.length) {
      const entryResults = await fetchIpfsEntries(entries);
      for (const result of entryResults) {
        const entry = result.entry;
        if (result.error) {
          console.warn("Session fetch failed:", result.error.message || result.error);
          failedEntries.push(entry);
          continue;
        }

        const payload = result.payload;
        if (!payload?.summary || !payload?.history) continue;

        const pinnedAt = payload.pinnedAt || entry.timestamp || new Date().toISOString();
        const onChain = onChainByCid.get(entry.cid);
        sessions.push({
          id: payload.sessionId || `ipfs_${entry.cid}`,
          summary: payload.summary,
          history: redactHistory ? [] : payload.history,
          status: "completed",
          ipfs: {
            cid: entry.cid,
            uri: `ipfs://${entry.cid}`,
            gatewayUrl: resolveGatewayUrl(entry.cid),
            pinnedAt
          },
          ...(onChain && onChain.txHash ? {
            onChain: {
              txHash: onChain.txHash,
              chainId: Number(onChain.chainId) || 0,
              contractAddress: onChain.contractAddress || "",
              storedAt: onChain.timestamp || pinnedAt
            }
          } : {})
        });
      }
    }

    const sessionIds = new Set(sessions.map((session) => String(session.id || "").trim()).filter(Boolean));
    const cidsInSessions = new Set(
      sessions
        .map((session) => String(session?.ipfs?.cid || "").trim())
        .filter(Boolean)
    );

    for (const archived of archivedSessions) {
      const archivedId = String(archived.id || "").trim();
      const cid = String(archived.cid || "").trim();
      if (archivedId && sessionIds.has(archivedId)) continue;
      if (cid && cidsInSessions.has(cid)) continue;

      const onChain = cid ? onChainByCid.get(cid) : null;
      sessions.push({
        id: archived.id,
        summary: archived.summary,
        history: redactHistory ? [] : archived.history,
        status: "completed",
        ...(cid ? {
          ipfs: {
            cid,
            uri: `ipfs://${cid}`,
            gatewayUrl: resolveGatewayUrl(cid),
            pinnedAt: archived.pinnedAt || new Date().toISOString()
          }
        } : {}),
        ...(onChain && onChain.txHash ? {
          onChain: {
            txHash: onChain.txHash,
            chainId: Number(onChain.chainId) || 0,
            contractAddress: onChain.contractAddress || "",
            storedAt: onChain.timestamp || archived.pinnedAt || new Date().toISOString()
          }
        } : {})
      });

      if (archivedId) sessionIds.add(archivedId);
      if (cid) cidsInSessions.add(cid);
    }

    for (const failedEntry of failedEntries) {
      const cid = String(failedEntry?.cid || "").trim();
      if (!cid || cidsInSessions.has(cid)) continue;

      const timestamp = failedEntry.timestamp || new Date().toISOString();
      const onChain = onChainByCid.get(cid);
      sessions.push({
        id: `ipfs_${cid}`,
        summary: {
          userid: userId,
          start_time_stamp: timestamp,
          end_time_stamp: timestamp,
          keywords: [],
          emotion: "NEUTRAL",
          summary: "Session saved, but its IPFS content is currently unavailable from configured gateways."
        },
        history: [],
        status: "completed",
        ipfs: {
          cid,
          uri: `ipfs://${cid}`,
          gatewayUrl: resolveGatewayUrl(cid),
          pinnedAt: timestamp
        },
        ...(onChain && onChain.txHash ? {
          onChain: {
            txHash: onChain.txHash,
            chainId: Number(onChain.chainId) || 0,
            contractAddress: onChain.contractAddress || "",
            storedAt: onChain.timestamp || timestamp
          }
        } : {})
      });

      cidsInSessions.add(cid);
    }

    sessions.sort((a, b) => {
      const aTime = new Date(a?.summary?.start_time_stamp || a?.ipfs?.pinnedAt || 0).getTime();
      const bTime = new Date(b?.summary?.start_time_stamp || b?.ipfs?.pinnedAt || 0).getTime();
      return bTime - aTime;
    });

    res.json({ sessions });
  } catch (error) {
    console.error("Session list error:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// Add/update guardian for a student
app.post("/api/guardian/:studentId", (req, res) => {
  try {
    const { studentId } = req.params;
    const guardianData = req.body;

    if (!guardianData.guardian_name) {
      guardianData.guardian_name = guardianData.guardian_email || "Guardian";
    }

    const result = addGuardian(studentId, guardianData);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: "Guardian added successfully" });
  } catch (error) {
    console.error("Add guardian error:", error);
    res.status(500).json({ error: "Failed to add guardian" });
  }
});

// ==================== COUNSELLOR ENDPOINTS ====================

app.post("/api/counsellor/register", async (req, res) => {
  try {
    const { counsellor_email, counsellor_password, crr_number, organization, access_code, aishe_code, udise_code } = req.body || {};
    const resolvedCode = String(access_code || aishe_code || udise_code || "").trim();
    if (!counsellor_email || !counsellor_password || !crr_number) {
      return res.status(400).json({ error: "counsellor_email, counsellor_password, and crr_number are required" });
    }
    if (!resolvedCode) {
      return res.status(400).json({ error: "access_code is required" });
    }

    const result = await registerCounsellor(
      String(counsellor_email).toLowerCase().trim(),
      String(counsellor_password),
      String(crr_number).trim(),
      organization ? String(organization).trim() : null,
      resolvedCode
    );
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch (error) {
    console.error("Counsellor registration error:", error);
    res.status(500).json({ error: "Counsellor registration failed" });
  }
});

app.post("/api/counsellor/login", async (req, res) => {
  try {
    const { login_id, counsellor_password, access_code, aishe_code, udise_code } = req.body || {};
    const resolvedCode = String(access_code || aishe_code || udise_code || "").trim();
    if (!login_id || !counsellor_password) {
      return res.status(400).json({ error: "login_id and counsellor_password are required" });
    }
    if (!resolvedCode) {
      return res.status(400).json({ error: "access_code is required" });
    }
    const result = await loginCounsellor(
      String(login_id).trim(),
      String(counsellor_password),
      resolvedCode
    );
    if (!result.success) return res.status(401).json({ error: result.error });
    res.json({ success: true, counsellor: result.counsellor });
  } catch (error) {
    console.error("Counsellor login error:", error);
    res.status(500).json({ error: "Counsellor login failed" });
  }
});

app.get("/api/counsellor/students", (req, res) => {
  try {
    const counsellorEmail = String(req.query.counsellor_email || "").toLowerCase().trim();
    if (!counsellorEmail) {
      return res.status(400).json({ error: "counsellor_email is required" });
    }

    const counsellor = getCounsellorByEmail(counsellorEmail);
    if (!counsellor) {
      return res.status(404).json({ error: "Counsellor not found" });
    }

    const students = getUsersByCounsellorInstitution(counsellor.aishe_code, counsellor.udise_code);
    res.json({ students });
  } catch (error) {
    console.error("Counsellor students error:", error);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

app.get("/api/counsellor/summaries", async (req, res) => {
  try {
    const counsellorEmail = String(req.query.counsellor_email || "").toLowerCase().trim();
    if (!counsellorEmail) {
      return res.status(400).json({ error: "counsellor_email is required" });
    }

    const counsellor = getCounsellorByEmail(counsellorEmail);
    if (!counsellor) {
      return res.status(404).json({ error: "Counsellor not found" });
    }

    const linkedStudents = getUsersByCounsellorInstitution(counsellor.aishe_code, counsellor.udise_code);
    if (!linkedStudents.length) return res.json({ summaries: [] });
    const allowedStudentIds = new Set(linkedStudents.map((student) => String(student.id)));

    const entries = readAllIpfsEntries();
    if (!entries.length) return res.json({ summaries: [] });

    const seenCids = new Set();
    const filteredEntries = [];
    for (const entry of entries) {
      if (!allowedStudentIds.has(String(entry.studentId || ""))) continue;
      if (!entry.cid || seenCids.has(entry.cid)) continue;
      seenCids.add(entry.cid);
      filteredEntries.push(entry);
    }

    const summaries = [];
    const entryResults = await fetchIpfsEntries(filteredEntries);
    for (const result of entryResults) {
      if (result.error) {
        console.warn("Counsellor summary read failed:", result.error.message || result.error);
        continue;
      }

      if (result.payload?.summary) summaries.push(result.payload.summary);
    }
    res.json({ summaries });
  } catch (error) {
    console.error("Counsellor summaries error:", error);
    res.status(500).json({ error: "Failed to fetch summaries" });
  }
});

app.post("/api/counsellor/requests", (req, res) => {
  try {
    const { student_id, session_id, session_emotion, urgency, reason, requested_by_role, requested_by_email } = req.body || {};

    const result = createCounsellorRequest({
      studentId: student_id,
      sessionId: session_id,
      sessionEmotion: session_emotion,
      urgency,
      reason,
      requestedByRole: requested_by_role,
      requestedByEmail: requested_by_email
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, request: result.request });
  } catch (error) {
    console.error("Counsellor request create error:", error);
    res.status(500).json({ error: "Failed to create counsellor request" });
  }
});

app.get("/api/counsellor/requests", (req, res) => {
  try {
    const counsellorEmail = String(req.query.counsellor_email || "").toLowerCase().trim();
    if (!counsellorEmail) {
      return res.status(400).json({ error: "counsellor_email is required" });
    }

    const result = listCounsellorRequestsForCounsellor(counsellorEmail);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ requests: result.requests || [] });
  } catch (error) {
    console.error("Counsellor request list error:", error);
    res.status(500).json({ error: "Failed to fetch counsellor requests" });
  }
});

app.post("/api/counsellor/requests/:requestId/create-session", (req, res) => {
  try {
    const requestId = String(req.params.requestId || "").trim();
    const counsellorEmail = String(req.body?.counsellor_email || "").toLowerCase().trim();

    if (!requestId || !counsellorEmail) {
      return res.status(400).json({ error: "requestId and counsellor_email are required" });
    }

    const counsellor = getCounsellorByEmail(counsellorEmail);
    if (!counsellor) {
      return res.status(404).json({ error: "Counsellor not found" });
    }

    const listResult = listCounsellorRequestsForCounsellor(counsellorEmail);
    if (!listResult.success) {
      return res.status(400).json({ error: listResult.error });
    }

    const request = (listResult.requests || []).find((item) => item.id === requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.status === "session_created") {
      return res.status(200).json({ success: true, request });
    }

    const updateResult = updateCounsellorRequestStatus(requestId, "session_created", counsellorEmail);
    if (!updateResult.success) {
      return res.status(400).json({ error: updateResult.error });
    }

    res.json({ success: true, request: updateResult.request });
  } catch (error) {
    console.error("Counsellor create-session error:", error);
    res.status(500).json({ error: "Failed to update request status" });
  }
});

app.post("/api/counsellor/schedules", (req, res) => {
  try {
    const { student_id, counsellor_email, scheduled_for, urgency, notes, source_request_id } = req.body || {};

    const result = createCounsellorSchedule({
      studentId: student_id,
      counsellorEmail: counsellor_email,
      scheduledFor: scheduled_for,
      urgency,
      notes,
      sourceRequestId: source_request_id
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, schedule: result.schedule });
  } catch (error) {
    console.error("Counsellor schedule create error:", error);
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

app.get("/api/counsellor/schedules", (req, res) => {
  try {
    const counsellorEmail = String(req.query.counsellor_email || "").toLowerCase().trim();
    const studentId = String(req.query.student_id || "").trim();
    if (!counsellorEmail) {
      return res.status(400).json({ error: "counsellor_email is required" });
    }

    const result = listCounsellorSchedules(counsellorEmail, studentId || null);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ schedules: result.schedules || [] });
  } catch (error) {
    console.error("Counsellor schedule list error:", error);
    res.status(500).json({ error: "Failed to fetch schedules" });
  }
});

app.get("/api/student/notifications", (req, res) => {
  try {
    const studentId = String(req.query.student_id || "").trim();
    if (!studentId) {
      return res.status(400).json({ error: "student_id is required" });
    }

    const result = listCounsellorSchedulesForStudent(studentId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ notifications: result.schedules || [] });
  } catch (error) {
    console.error("Student notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

app.post("/api/student/notifications/:scheduleId/read", (req, res) => {
  try {
    const scheduleId = String(req.params.scheduleId || "").trim();
    const studentId = String(req.body?.student_id || "").trim();

    if (!scheduleId || !studentId) {
      return res.status(400).json({ error: "scheduleId and student_id are required" });
    }

    const result = markCounsellorScheduleReadByStudent(scheduleId, studentId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, notification: result.schedule });
  } catch (error) {
    console.error("Student notification read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// ==================== INSTITUTION ENDPOINTS ====================

app.post("/api/institution/register", async (req, res) => {
  try {
    const { institution_email, institution_password, institution_name, access_code, aishe_code, udise_code } = req.body || {};
    const resolvedCode = String(access_code || aishe_code || udise_code || "").trim();
    if (!institution_email || !institution_password) {
      return res.status(400).json({ error: "institution_email and institution_password are required" });
    }
    if (!resolvedCode) {
      return res.status(400).json({ error: "access_code is required" });
    }
    const result = await registerInstitution(
      String(institution_email).toLowerCase().trim(),
      String(institution_password),
      institution_name ? String(institution_name).trim() : null,
      resolvedCode
    );
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, college_code: result.collegeCode, institution: result.institution });
  } catch (error) {
    console.error("Institution registration error:", error);
    res.status(500).json({ error: "Institution registration failed" });
  }
});

app.post("/api/institution/login", async (req, res) => {
  try {
    const { college_code, institution_password } = req.body || {};
    if (!college_code || !institution_password) {
      return res.status(400).json({ error: "college_code and institution_password are required" });
    }
    const result = await loginInstitution(
      String(college_code).trim().toUpperCase(),
      String(institution_password)
    );
    if (!result.success) return res.status(401).json({ error: result.error });
    res.json({ success: true, institution: result.institution });
  } catch (error) {
    console.error("Institution login error:", error);
    res.status(500).json({ error: "Institution login failed" });
  }
});

app.get("/api/institution/summaries", async (req, res) => {
  try {
    const collegeCode = String(req.query.college_code || "").trim().toUpperCase();
    if (!collegeCode) {
      return res.status(400).json({ error: "college_code is required" });
    }
    const institution = getInstitutionByCollegeCode(collegeCode);
    if (!institution) return res.status(404).json({ error: "Invalid college code" });

    const linkedStudents = getUsersByInstitutionCollegeCode(collegeCode);
    if (!linkedStudents.length) return res.json({ summaries: [] });
    const allowedStudentIds = new Set(linkedStudents.map((student) => String(student.id)));

    const entries = readAllIpfsEntries();
    const seenCids = new Set();
    const filteredEntries = [];

    if (entries.length) {
      for (const entry of entries) {
        if (!allowedStudentIds.has(String(entry.studentId || ""))) continue;
        if (!entry.cid || seenCids.has(entry.cid)) continue;
        seenCids.add(entry.cid);
        filteredEntries.push(entry);
      }
    }

    const summaries = [];
    if (filteredEntries.length) {
      const entryResults = await fetchIpfsEntries(filteredEntries);
      for (const result of entryResults) {
        if (result.error) {
          console.warn("Institution summary read failed:", result.error.message || result.error);
          continue;
        }

        if (result.payload?.summary) summaries.push(result.payload.summary);
      }
    }

    if (!summaries.length) {
      for (const studentId of allowedStudentIds) {
        const archivedSessions = getSessionArchivesByStudent(studentId);
        for (const session of archivedSessions) {
          if (session?.summary) {
            summaries.push(session.summary);
          }
        }
      }
    }

    res.json({ summaries });
  } catch (error) {
    console.error("Institution summaries error:", error);
    res.status(500).json({ error: "Failed to fetch summaries" });
  }
});

app.get("/api/institution/students", (req, res) => {
  try {
    const collegeCode = String(req.query.college_code || "").trim().toUpperCase();
    if (!collegeCode) {
      return res.status(400).json({ error: "college_code is required" });
    }

    const institution = getInstitutionByCollegeCode(collegeCode);
    if (!institution) {
      return res.status(404).json({ error: "Invalid college code" });
    }

    const students = getUsersByInstitutionCollegeCode(collegeCode);
    res.json({ students });
  } catch (error) {
    console.error("Institution students error:", error);
    res.status(500).json({ error: "Failed to fetch institution students" });
  }
});
// Get guardian for a student
app.get("/api/guardian/:studentId", (req, res) => {
  try {
    const guardian = getGuardian(req.params.studentId);
    
    if (!guardian) {
      return res.status(404).json({ error: "Guardian not found" });
    }
    const { guardian_password: _, ...guardianWithoutPassword } = guardian;
    res.json(guardianWithoutPassword);
  } catch (error) {
    console.error("Get guardian error:", error);
    res.status(500).json({ error: "Failed to get guardian" });
  }
});

// ==================== CHAT ENDPOINT ====================

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { history = [], message, systemInstruction } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    let groq;
    try {
      groq = getGroqClient();
    } catch (clientError) {
      if (String(clientError?.message || "").includes("GROQ_API_KEY is missing")) {
        return res.json({
          text: "I can still support you in local mode. Tell me what you are feeling right now, and I will help you break it down into small next steps."
        });
      }
      throw clientError;
    }

    // Build conversation text safely
    const conversation = [
      `SYSTEM:\n${systemInstruction}`,
      ...history.map(h => `${h.role.toUpperCase()}: ${h.content}`),
      `USER: ${message}`
    ].join("\n\n");

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",  // ✅ Current Groq production model
      messages: [
        {
          role: "user",
          content: conversation,
        },
      ],
      temperature: 0.7,
    });

    res.json({
      text: response.choices[0]?.message?.content ?? "",
    });

  } catch (error) {
    console.error("🔥 GROQ GENERATE FAILED:", error);
    if (String(error?.message || "").includes("GROQ_API_KEY is missing")) {
      return res.status(503).json({ error: "GROQ_API_KEY is missing on backend" });
    }
    res.status(500).json({ error: "Groq service failed" });
  }
});

// ==================== SUMMARY ENDPOINT ====================

app.post("/api/summary", async (req, res) => {
  try {
    const groq = getGroqClient();
    const { history = [], userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (!Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: "history is required" });
    }

    const prompt = buildSummaryPrompt(userId, history);
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const parsed = safeParseSummaryJson(raw);

    if (!parsed) {
      return res.status(502).json({ error: "Failed to parse summary JSON" });
    }

    parsed.summary = shortenSummaryText(parsed.summary);

    res.json(parsed);
  } catch (error) {
    console.error("Summary error:", error);
    if (String(error?.message || "").includes("GROQ_API_KEY is missing")) {
      return res.status(503).json({ error: "GROQ_API_KEY is missing on backend" });
    }
    res.status(500).json({ error: "Summary generation failed" });
  }
});

// ==================== IPFS ENDPOINTS ====================

app.post("/api/ipfs/pin-json", async (req, res) => {
  try {
    const { data, name, metadata, options } = req.body || {};

    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Request must include JSON 'data'" });
    }

    const pinResult = await pinJsonToIpfs(data, name, metadata, options);
    const cid = pinResult.cid;

    if (data?.userId) {
      const user = getUserById(data.userId);
      const username = user?.username || "";
      const timestamp = data?.pinnedAt || pinResult.timestamp || new Date().toISOString();
      try {
        appendIpfsCsv(data.userId, username, cid, timestamp);
      } catch (csvError) {
        console.warn("IPFS CSV append failed:", csvError.message);
      }
    }

    res.json({
      cid,
      uri: `ipfs://${cid}`,
      gatewayUrl: pinResult.gatewayUrl,
      pinSize: pinResult.pinSize,
      timestamp: pinResult.timestamp
    });
  } catch (error) {
    console.error("IPFS pin-json error:", error);
    res.status(500).json({ error: "Failed to pin JSON to IPFS" });
  }
});

app.post("/api/ipfs/pin-session", async (req, res) => {
  try {
    const { sessionId, userId, summary, history, pinnedAt } = req.body || {};
    if (!sessionId || !userId || !summary || !Array.isArray(history)) {
      return res.status(400).json({ error: "sessionId, userId, summary, and history are required" });
    }

    const user = getUserById(String(userId));
    const username = user?.username || "";
    const timestamp = pinnedAt || new Date().toISOString();

    // Persist the session archive before pinning so guardians/counsellors can read summaries even if IPFS is unavailable.
    const prePinArchive = saveSessionArchive({
      sessionId,
      studentId: String(userId),
      summary,
      history,
      cid: null,
      pinnedAt: timestamp
    });
    if (!prePinArchive.success) {
      console.warn("Session archive pre-pin save failed:", prePinArchive.error);
    }

    const payload = {
      sessionId,
      userId,
      summary,
      history,
      pinnedAt: timestamp
    };

    const pinResult = await pinJsonToIpfs(payload, `care-connect-${sessionId}`, { name: `care-connect-${sessionId}` });
    const cid = pinResult.cid;

    try {
      appendIpfsCsv(String(userId), username, cid, timestamp);
    } catch (csvError) {
      console.warn("IPFS CSV append failed:", csvError.message);
    }

    const archiveResult = saveSessionArchive({
      sessionId,
      studentId: String(userId),
      summary,
      history,
      cid,
      pinnedAt: timestamp
    });
    if (!archiveResult.success) {
      console.warn("Session archive save failed:", archiveResult.error);
    }

    res.json({
      cid,
      uri: `ipfs://${cid}`,
      gatewayUrl: pinResult.gatewayUrl,
      pinSize: pinResult.pinSize,
      timestamp: pinResult.timestamp
    });
  } catch (error) {
    console.error("IPFS pin-session error:", error);
    const message = error instanceof Error ? error.message : "Failed to pin session to IPFS";
    res.status(500).json({ error: message });
  }
});

app.post("/api/sessions/archive", (req, res) => {
  try {
    const { sessionId, userId, summary, history, pinnedAt, cid } = req.body || {};
    if (!sessionId || !userId || !summary || !Array.isArray(history)) {
      return res.status(400).json({ error: "sessionId, userId, summary, and history are required" });
    }

    const result = saveSessionArchive({
      sessionId: String(sessionId),
      studentId: String(userId),
      summary,
      history,
      cid: cid ? String(cid) : null,
      pinnedAt: pinnedAt ? String(pinnedAt) : null
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to archive session" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Session archive error:", error);
    res.status(500).json({ error: "Failed to archive session" });
  }
});


// ==================== BLOCKCHAIN CSV ENDPOINT ====================

app.post("/api/blockchain/record", (req, res) => {
  try {
    const { chainId, address, txHash, timestamp, userId, sessionId, cid, contractAddress } = req.body || {};

    if (!chainId || !address || !txHash || !timestamp) {
      return res.status(400).json({ error: "chainId, address, txHash, and timestamp are required" });
    }

    appendBlockchainCsv({
      chainId,
      address,
      txHash,
      timestamp,
      studentId: userId || "",
      sessionId: sessionId || "",
      cid: cid || "",
      contractAddress: contractAddress || ""
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Blockchain CSV append failed:", error);
    res.status(500).json({ error: "Failed to append blockchain CSV" });
  }
});

app.post("/api/blockchain/store-cid", async (req, res) => {
  try {
    const { cid, userId, sessionId } = req.body || {};
    const normalizedCid = String(cid || "").trim();
    const normalizedUserId = String(userId || "").trim();
    const normalizedSessionId = String(sessionId || "").trim();

    if (!normalizedCid) {
      return res.status(400).json({ error: "cid is required" });
    }

    const result = await storeCidOnChain({
      cid: normalizedCid,
      studentId: normalizedUserId,
      sessionId: normalizedSessionId
    });

    if (!result.success) {
      return res.status(result.skipped ? 200 : 400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Blockchain store-cid error:", error);
    res.status(500).json({ error: "Failed to store CID on-chain" });
  }
});

// Serve compiled frontend when available (Railway single-service deployment).
if (fs.existsSync(FRONTEND_DIST_DIR)) {
  app.use(express.static(FRONTEND_DIST_DIR));

  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(FRONTEND_INDEX_FILE);
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      status: "Care Connect backend running",
      frontend: "not built",
      hint: "Build frontend/dist to serve UI from this service"
    });
  });
}




const httpServer = app.listen(PORT, HOST, () => {
  console.log(`✅ Backend listening on http://${HOST}:${PORT}`);
});

// In some Windows terminal/tooling setups, the process can exit early even after listen.
// Keep one ref'ed handle so the API stays alive for interactive testing.
const keepAliveInterval = setInterval(() => {
  // no-op
}, 60 * 1000);

const shutdown = () => {
  clearInterval(keepAliveInterval);
  httpServer.close(() => process.exit(0));
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
