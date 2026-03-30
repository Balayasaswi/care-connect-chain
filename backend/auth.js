import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "./database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exportsDir = path.join(__dirname, "exports");
const usersCsvPath = path.join(exportsDir, "users.csv");
const guardiansCsvPath = path.join(exportsDir, "guardians.csv");
const ipfsCsvPath = path.join(exportsDir, "ipfs.csv");
const blockchainCsvPath = path.join(exportsDir, "blockchain_ids.csv");
const counsellorsCsvPath = path.join(exportsDir, "counsellors.csv");
const institutionsCsvPath = path.join(exportsDir, "institutions.csv");

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportUsersCsv() {
  fs.mkdirSync(exportsDir, { recursive: true });
  const rows = db
    .prepare("SELECT id, username, email, institution_access_code, institution_college_code, created_at FROM users ORDER BY created_at DESC")
    .all();
  const header = ["id", "username", "email", "institution_access_code", "institution_college_code", "created_at"].join(",");
  const lines = rows.map((r) => [
    r.id,
    r.username,
    r.email,
    r.institution_access_code,
    r.institution_college_code,
    r.created_at
  ].map(csvEscape).join(","));
  fs.writeFileSync(usersCsvPath, [header, ...lines].join("\n"), "utf-8");
}

export function exportGuardiansCsv() {
  fs.mkdirSync(exportsDir, { recursive: true });
  const rows = db.prepare(
    "SELECT student_id, guardian_name, guardian_email, guardian_phone, relationship, created_at FROM guardians ORDER BY created_at DESC"
  ).all();
  const header = ["student_id", "guardian_name", "guardian_email", "guardian_phone", "relationship", "created_at"].join(",");
  const lines = rows.map((r) => [
    r.student_id,
    r.guardian_name,
    r.guardian_email,
    r.guardian_phone,
    r.relationship,
    r.created_at
  ].map(csvEscape).join(","));
  fs.writeFileSync(guardiansCsvPath, [header, ...lines].join("\n"), "utf-8");
}

export function appendIpfsCsv(studentId, username, cid, timestamp) {
  fs.mkdirSync(exportsDir, { recursive: true });
  const header = ["student_id", "username", "cid", "timestamp"].join(",");

  if (!fs.existsSync(ipfsCsvPath)) {
    fs.writeFileSync(ipfsCsvPath, `${header}\n`, "utf-8");
  }

  const row = [studentId, username, cid, timestamp].map(csvEscape).join(",");
  fs.appendFileSync(ipfsCsvPath, `${row}\n`, "utf-8");
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

export function readIpfsEntriesByStudent(studentId) {
  if (!fs.existsSync(ipfsCsvPath)) {
    return [];
  }

  const content = fs.readFileSync(ipfsCsvPath, "utf-8").trim();
  if (!content) return [];

  const lines = content.split("\n");
  if (lines.length <= 1) return [];

  const entries = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const [sid, _username, cid, timestamp] = parseCsvLine(line);
    if (!sid || !cid) continue;
    if (String(sid) !== String(studentId)) continue;
    entries.push({ cid, timestamp });
  }

  return entries;
}

export function readAllIpfsEntries() {
  if (!fs.existsSync(ipfsCsvPath)) {
    return [];
  }

  const content = fs.readFileSync(ipfsCsvPath, "utf-8").trim();
  if (!content) return [];

  const lines = content.split("\n");
  if (lines.length <= 1) return [];

  const entries = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const [studentId, _username, cid, timestamp] = parseCsvLine(line);
    if (!studentId || !cid) continue;
    entries.push({ studentId, cid, timestamp });
  }

  return entries;
}

export function saveSessionArchive({ sessionId, studentId, summary, history, cid, pinnedAt }) {
  const normalizedSessionId = String(sessionId || "").trim();
  const normalizedStudentId = String(studentId || "").trim();

  if (!normalizedSessionId || !normalizedStudentId) {
    return { success: false, error: "sessionId and studentId are required" };
  }

  try {
    db.prepare(
      `INSERT INTO session_archives (id, student_id, summary_json, history_json, cid, pinned_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         student_id = excluded.student_id,
         summary_json = excluded.summary_json,
         history_json = excluded.history_json,
         cid = excluded.cid,
         pinned_at = excluded.pinned_at`
    ).run(
      normalizedSessionId,
      normalizedStudentId,
      JSON.stringify(summary || {}),
      JSON.stringify(Array.isArray(history) ? history : []),
      cid || null,
      pinnedAt || null
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function getSessionArchivesByStudent(studentId) {
  const normalizedStudentId = String(studentId || "").trim();
  if (!normalizedStudentId) return [];

  const rows = db
    .prepare(
      `SELECT id, student_id, summary_json, history_json, cid, pinned_at, created_at
       FROM session_archives
       WHERE student_id = ?
       ORDER BY COALESCE(pinned_at, created_at) DESC`
    )
    .all(normalizedStudentId);

  return rows.map((row) => {
    let summary = {};
    let history = [];

    try {
      summary = JSON.parse(row.summary_json || "{}");
    } catch {
      summary = {};
    }

    try {
      const parsedHistory = JSON.parse(row.history_json || "[]");
      history = Array.isArray(parsedHistory) ? parsedHistory : [];
    } catch {
      history = [];
    }

    return {
      id: row.id,
      studentId: row.student_id,
      summary,
      history,
      cid: row.cid || "",
      pinnedAt: row.pinned_at || row.created_at || "",
      createdAt: row.created_at || ""
    };
  });
}

function ensureBlockchainCsvSchema() {
  fs.mkdirSync(exportsDir, { recursive: true });
  const header = [
    "student_id",
    "session_id",
    "cid",
    "chain_id",
    "address",
    "tx_hash",
    "contract_address",
    "timestamp"
  ].join(",");

  if (!fs.existsSync(blockchainCsvPath)) {
    fs.writeFileSync(blockchainCsvPath, `${header}\n`, "utf-8");
    return;
  }

  const content = fs.readFileSync(blockchainCsvPath, "utf-8");
  const lines = content.split("\n");
  const currentHeader = (lines[0] || "").trim();

  if (currentHeader === header) {
    return;
  }

  const headerColumns = parseCsvLine(currentHeader);
  const migrated = [header];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = {};

    for (let j = 0; j < headerColumns.length; j += 1) {
      row[headerColumns[j]] = values[j] ?? "";
    }

    migrated.push([
      row.student_id || "",
      row.session_id || "",
      row.cid || "",
      row.chain_id || row.chainId || "",
      row.address || "",
      row.tx_hash || row.txHash || "",
      row.contract_address || row.contractAddress || "",
      row.timestamp || ""
    ].map(csvEscape).join(","));
  }

  fs.writeFileSync(blockchainCsvPath, `${migrated.join("\n")}\n`, "utf-8");
}

export function appendBlockchainCsv(payloadOrChainId, address, txHash, timestamp) {
  const payload = typeof payloadOrChainId === "object"
    ? payloadOrChainId
    : {
        chainId: payloadOrChainId,
        address,
        txHash,
        timestamp
      };

  ensureBlockchainCsvSchema();

  const row = [
    payload.studentId || "",
    payload.sessionId || "",
    payload.cid || "",
    payload.chainId || "",
    payload.address || "",
    payload.txHash || "",
    payload.contractAddress || "",
    payload.timestamp || ""
  ].map(csvEscape).join(",");

  fs.appendFileSync(blockchainCsvPath, `${row}\n`, "utf-8");
}

export function readBlockchainEntriesByStudent(studentId) {
  if (!fs.existsSync(blockchainCsvPath)) {
    return [];
  }

  const content = fs.readFileSync(blockchainCsvPath, "utf-8").trim();
  if (!content) return [];

  const lines = content.split("\n");
  if (lines.length <= 1) return [];

  const headerColumns = parseCsvLine(lines[0].trim());
  const indexOf = (name) => headerColumns.indexOf(name);

  const idxStudent = indexOf("student_id");
  if (idxStudent === -1) return [];

  const idxSession = indexOf("session_id");
  const idxCid = indexOf("cid");
  const idxChainId = indexOf("chain_id");
  const idxAddress = indexOf("address");
  const idxTxHash = indexOf("tx_hash");
  const idxContract = indexOf("contract_address");
  const idxTimestamp = indexOf("timestamp");

  const entries = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);

    if (String(values[idxStudent] || "") !== String(studentId)) continue;

    entries.push({
      sessionId: idxSession >= 0 ? values[idxSession] : "",
      cid: idxCid >= 0 ? values[idxCid] : "",
      chainId: idxChainId >= 0 ? values[idxChainId] : "",
      address: idxAddress >= 0 ? values[idxAddress] : "",
      txHash: idxTxHash >= 0 ? values[idxTxHash] : "",
      contractAddress: idxContract >= 0 ? values[idxContract] : "",
      timestamp: idxTimestamp >= 0 ? values[idxTimestamp] : ""
    });
  }

  return entries;
}

// Generate hex UUID (hexadecimal unique ID)
export function generateHexId() {
  return uuidv4().replace(/-/g, ""); // Remove dashes for pure hex
}

// Generate unique College Code: CC-XXXXXX (6 uppercase alphanumeric chars)
export function generateCollegeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "CC-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Hash password
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Register new user (student)
function normalizeAccessCode(accessCode) {
  const trimmed = String(accessCode || "").trim();
  if (!trimmed) return "";
  return trimmed.toUpperCase();
}

function normalizeCollegeCode(collegeCode) {
  const trimmed = String(collegeCode || "").trim();
  if (!trimmed) return "";
  return trimmed.toUpperCase();
}

function getInstitutionByAccessCode(accessCode) {
  const normalized = normalizeAccessCode(accessCode);
  if (!normalized) return null;

  return db.prepare(
    `SELECT institution_email, college_code, aishe_code, udise_code
     FROM institutions_global
     WHERE UPPER(COALESCE(aishe_code, '')) = ? OR UPPER(COALESCE(udise_code, '')) = ?`
  ).get(normalized, normalized);
}

function getInstitutionByCollegeCodeRaw(collegeCode) {
  const normalized = normalizeCollegeCode(collegeCode);
  if (!normalized) return null;

  return db.prepare(
    `SELECT institution_email, college_code, aishe_code, udise_code
     FROM institutions_global
     WHERE UPPER(COALESCE(college_code, '')) = ?`
  ).get(normalized);
}

export async function registerUser(username, email, password, { accessCode, collegeCode } = {}) {
  try {
    const normalizedCollegeCode = normalizeCollegeCode(collegeCode);
    let normalizedCode = normalizeAccessCode(accessCode);
    let institution = null;

    if (normalizedCollegeCode) {
      institution = getInstitutionByCollegeCodeRaw(normalizedCollegeCode);
      if (!institution) {
        return { success: false, error: "Invalid college code. Ask your institution for the correct college ID." };
      }

      if (!normalizedCode) {
        normalizedCode = normalizeAccessCode(institution.aishe_code || institution.udise_code);
      }
    }

    if (!institution && normalizedCode) {
      institution = getInstitutionByAccessCode(normalizedCode);
    }

    const resolvedCollegeCode = normalizeCollegeCode(institution?.college_code || normalizedCollegeCode);

    const userId = generateHexId();
    const hashedPassword = await hashPassword(password);

    const stmt = db.prepare(
      "INSERT INTO users (id, username, email, password, institution_access_code, institution_college_code) VALUES (?, ?, ?, ?, ?, ?)"
    );
    
    stmt.run(userId, username, email, hashedPassword, normalizedCode || null, resolvedCollegeCode || null);

    try {
      exportUsersCsv();
    } catch (csvError) {
      console.warn("CSV export failed:", csvError.message);
    }

    return { success: true, userId };
  } catch (error) {
    if (error.message.includes("UNIQUE constraint")) {
      return { success: false, error: "Username or email already exists" };
    }
    return { success: false, error: error.message };
  }
}

// Login user
export async function loginUser(username, password) {
  try {
    const stmt = db.prepare("SELECT * FROM users WHERE username = ? OR email = ?");
    const user = stmt.get(username, username);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return { success: false, error: "Invalid password" };
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get user by email
export function getUserByEmail(email) {
  const stmt = db.prepare("SELECT id, username, email, institution_access_code, institution_college_code, created_at FROM users WHERE email = ?");
  return stmt.get(email);
}

// Get user by ID
export function getUserById(userId) {
  const stmt = db.prepare("SELECT id, username, email, institution_access_code, institution_college_code, created_at FROM users WHERE id = ?");
  return stmt.get(userId);
}

export function getUsersByInstitutionCollegeCode(collegeCode) {
  const normalized = String(collegeCode || "").trim().toUpperCase();
  if (!normalized) return [];

  return db
    .prepare("SELECT id, username, email FROM users WHERE UPPER(COALESCE(institution_college_code, '')) = ?")
    .all(normalized);
}

function getInstitutionCollegeCodeByCounsellorScope(aisheCode, udiseCode) {
  const normalizedAishe = String(aisheCode || "").trim().toUpperCase();
  const normalizedUdise = String(udiseCode || "").trim().toUpperCase();

  if (normalizedAishe) {
    const byAishe = db
      .prepare("SELECT college_code FROM institutions_global WHERE UPPER(COALESCE(aishe_code, '')) = ? LIMIT 1")
      .get(normalizedAishe);
    if (byAishe?.college_code) {
      return String(byAishe.college_code).trim().toUpperCase();
    }
  }

  if (normalizedUdise) {
    const byUdise = db
      .prepare("SELECT college_code FROM institutions_global WHERE UPPER(COALESCE(udise_code, '')) = ? LIMIT 1")
      .get(normalizedUdise);
    if (byUdise?.college_code) {
      return String(byUdise.college_code).trim().toUpperCase();
    }
  }

  return null;
}

export function getUsersByCounsellorInstitution(aisheCode, udiseCode) {
  const normalizedAishe = String(aisheCode || "").trim().toUpperCase();
  const normalizedUdise = String(udiseCode || "").trim().toUpperCase();

  const byId = new Map();

  const collegeCode = getInstitutionCollegeCodeByCounsellorScope(normalizedAishe, normalizedUdise);
  if (collegeCode) {
    const scopedByCollege = getUsersByInstitutionCollegeCode(collegeCode);
    for (const student of scopedByCollege) {
      byId.set(String(student.id), student);
    }
  }

  const directCodes = [normalizedAishe, normalizedUdise].filter(Boolean);
  if (directCodes.length) {
    const placeholders = directCodes.map(() => "?").join(", ");
    const scopedByAccessCode = db
      .prepare(`SELECT id, username, email FROM users WHERE UPPER(COALESCE(institution_access_code, '')) IN (${placeholders})`)
      .all(...directCodes);
    for (const student of scopedByAccessCode) {
      byId.set(String(student.id), student);
    }
  }

  return Array.from(byId.values());
}

// Add or update guardian for a student
export function addGuardian(studentId, guardianData) {
  try {
    const { guardian_name, guardian_email, guardian_phone, relationship, guardian_password } = guardianData;

    const stmt = db.prepare(`
      INSERT INTO guardians (student_id, guardian_name, guardian_email, guardian_password, guardian_phone, relationship)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        guardian_name = excluded.guardian_name,
        guardian_email = excluded.guardian_email,
        guardian_password = excluded.guardian_password,
        guardian_phone = excluded.guardian_phone,
        relationship = excluded.relationship
    `);

    stmt.run(studentId, guardian_name, guardian_email, guardian_password || null, guardian_phone, relationship);

    try {
      exportGuardiansCsv();
    } catch (csvError) {
      console.warn("Guardians CSV export failed:", csvError.message);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function registerGuardian(studentId, guardianEmail, guardianPassword, relationship) {
  try {
    const existingLinks = getGuardiansByEmail(guardianEmail);
    const linkedToOtherStudent = existingLinks.find(
      (record) => String(record.student_id) !== String(studentId)
    );

    if (linkedToOtherStudent) {
      return { success: false, error: "Guardian email is already linked to another student" };
    }

    const hashedPassword = await hashPassword(guardianPassword);
    const guardianName = guardianEmail;

    const stmt = db.prepare(`
      INSERT INTO guardians (student_id, guardian_name, guardian_email, guardian_password, relationship)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        guardian_name = excluded.guardian_name,
        guardian_email = excluded.guardian_email,
        guardian_password = excluded.guardian_password,
        relationship = excluded.relationship
    `);

    stmt.run(studentId, guardianName, guardianEmail, hashedPassword, relationship);

    try {
      exportGuardiansCsv();
    } catch (csvError) {
      console.warn("Guardians CSV export failed:", csvError.message);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function loginGuardian(studentId, guardianEmail, guardianPassword) {
  try {
    const stmt = db.prepare("SELECT * FROM guardians WHERE student_id = ?");
    const guardian = stmt.get(studentId);

    if (!guardian) {
      return { success: false, error: "Guardian not found" };
    }

    if ((guardian.guardian_email || "").toLowerCase() !== guardianEmail.toLowerCase()) {
      return { success: false, error: "Guardian email does not match our records" };
    }

    if (!guardian.guardian_password) {
      return { success: false, error: "Guardian password not set" };
    }

    const isValid = await verifyPassword(guardianPassword, guardian.guardian_password);
    if (!isValid) {
      return { success: false, error: "Invalid password" };
    }

    const { guardian_password: _, ...guardianWithoutPassword } = guardian;
    return { success: true, guardian: guardianWithoutPassword };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get guardian for a student
export function getGuardian(studentId) {
  const stmt = db.prepare("SELECT * FROM guardians WHERE student_id = ?");
  return stmt.get(studentId);
}

export function getGuardiansByEmail(guardianEmail) {
  const stmt = db.prepare("SELECT * FROM guardians WHERE LOWER(guardian_email) = LOWER(?)");
  return stmt.all(guardianEmail);
}

// ==================== COUNSELLOR AUTH ====================

export function exportCounsellorsCsv() {
  fs.mkdirSync(exportsDir, { recursive: true });
  const rows = db.prepare(
    "SELECT counsellor_email, crr_number, aishe_code, udise_code, organization, created_at FROM counsellors_global ORDER BY created_at DESC"
  ).all();
  const header = ["counsellor_email", "crr_number", "aishe_code", "udise_code", "organization", "created_at"].join(",");
  const lines = rows.map((r) =>
    [r.counsellor_email, r.crr_number, r.aishe_code, r.udise_code, r.organization, r.created_at].map(csvEscape).join(",")
  );
  fs.writeFileSync(counsellorsCsvPath, [header, ...lines].join("\n"), "utf-8");
}

function mapAccessCode(accessCode) {
  const trimmed = String(accessCode || "").trim();
  if (!trimmed) {
    return { aisheCode: null, udiseCode: null };
  }

  const upper = trimmed.toUpperCase();
  if (upper.startsWith("UDISE")) {
    return { aisheCode: null, udiseCode: trimmed };
  }

  return { aisheCode: trimmed, udiseCode: null };
}

export async function registerCounsellor(counsellorEmail, counsellorPassword, crrNumber, organization, accessCode) {
  try {
    const normalized = mapAccessCode(accessCode);
    const normalizedCrr = String(crrNumber || "").trim();

    if (normalizedCrr) {
      const existingByCrr = db
        .prepare("SELECT counsellor_email FROM counsellors_global WHERE crr_number = ?")
        .get(normalizedCrr);

      if (
        existingByCrr &&
        String(existingByCrr.counsellor_email || "").toLowerCase() !== String(counsellorEmail || "").toLowerCase()
      ) {
        return { success: false, error: "CRR Number is already registered with another counsellor" };
      }
    }

    const hashedPassword = await hashPassword(counsellorPassword);
    const stmt = db.prepare(`
      INSERT INTO counsellors_global (counsellor_email, counsellor_password, crr_number, organization, aishe_code, udise_code)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(counsellor_email) DO UPDATE SET
        counsellor_password = excluded.counsellor_password,
        crr_number = excluded.crr_number,
        organization = excluded.organization,
        aishe_code = excluded.aishe_code,
        udise_code = excluded.udise_code
    `);
    stmt.run(counsellorEmail, hashedPassword, normalizedCrr || null, organization || null, normalized.aisheCode, normalized.udiseCode);
    try { exportCounsellorsCsv(); } catch (e) { console.warn("Counsellors CSV export failed:", e.message); }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function loginCounsellor(loginId, counsellorPassword, accessCode) {
  try {
    const normalized = mapAccessCode(accessCode);
    const rawLoginId = String(loginId || "").trim();
    const byEmail = rawLoginId.includes("@");

    const records = byEmail
      ? db.prepare("SELECT * FROM counsellors_global WHERE LOWER(counsellor_email) = LOWER(?)").all(rawLoginId)
      : db.prepare("SELECT * FROM counsellors_global WHERE crr_number = ?").all(rawLoginId);

    if (!records.length) {
      return { success: false, error: "Counsellor record not found" };
    }

    const filtered = records.filter((record) => {
      const aisheMatches = normalized.aisheCode && String(record.aishe_code || "").trim() === String(normalized.aisheCode).trim();
      const udiseMatches = normalized.udiseCode && String(record.udise_code || "").trim() === String(normalized.udiseCode).trim();
      return Boolean(aisheMatches || udiseMatches);
    });

    if (!filtered.length) {
      return { success: false, error: "AISHE/UDISE details do not match our records" };
    }

    if (filtered.length > 1) {
      return { success: false, error: "Multiple counsellor records match this CRR. Please login with email." };
    }

    const record = filtered[0];

    const isValid = await verifyPassword(counsellorPassword, record.counsellor_password);
    if (!isValid) return { success: false, error: "Invalid password" };
    const { counsellor_password: _, ...safe } = record;
    return { success: true, counsellor: safe };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function getCounsellorByEmail(counsellorEmail) {
  const stmt = db.prepare("SELECT * FROM counsellors_global WHERE counsellor_email = ?");
  const record = stmt.get(counsellorEmail);
  if (!record) return null;
  const { counsellor_password: _, ...safe } = record;
  return safe;
}

// ==================== INSTITUTION AUTH ====================

export function exportInstitutionsCsv() {
  fs.mkdirSync(exportsDir, { recursive: true });
  const rows = db.prepare(
    "SELECT institution_email, institution_name, aishe_code, udise_code, college_code, created_at FROM institutions_global ORDER BY created_at DESC"
  ).all();
  const header = ["institution_email", "institution_name", "aishe_code", "udise_code", "college_code", "created_at"].join(",");
  const lines = rows.map((r) =>
    [r.institution_email, r.institution_name, r.aishe_code, r.udise_code, r.college_code, r.created_at].map(csvEscape).join(",")
  );
  fs.writeFileSync(institutionsCsvPath, [header, ...lines].join("\n"), "utf-8");
}

export async function registerInstitution(institutionEmail, institutionPassword, institutionName, accessCode) {
  try {
    const normalized = mapAccessCode(accessCode);
    const hashedPassword = await hashPassword(institutionPassword);

    // Generate a unique college code (retry up to 5 times on collision)
    let collegeCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCollegeCode();
      const existing = db.prepare("SELECT 1 FROM institutions_global WHERE college_code = ?").get(candidate);
      if (!existing) { collegeCode = candidate; break; }
    }
    if (!collegeCode) return { success: false, error: "Could not generate unique college code, please retry" };

    const stmt = db.prepare(`
      INSERT INTO institutions_global (institution_email, institution_password, institution_name, aishe_code, udise_code, college_code)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(institution_email) DO UPDATE SET
        institution_password = excluded.institution_password,
        institution_name = excluded.institution_name,
        aishe_code = excluded.aishe_code,
        udise_code = excluded.udise_code,
        college_code = excluded.college_code
    `);
    stmt.run(institutionEmail, hashedPassword, institutionName || null, normalized.aisheCode, normalized.udiseCode, collegeCode);
    try { exportInstitutionsCsv(); } catch (e) { console.warn("Institutions CSV export failed:", e.message); }
    return { success: true, collegeCode };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function loginInstitution(collegeCode, institutionPassword) {
  try {
    const stmt = db.prepare("SELECT * FROM institutions_global WHERE college_code = ?");
    const record = stmt.get(String(collegeCode).trim().toUpperCase());
    if (!record) return { success: false, error: "Invalid college code" };
    const isValid = await verifyPassword(institutionPassword, record.institution_password);
    if (!isValid) return { success: false, error: "Invalid password" };
    const { institution_password: _, ...safe } = record;
    return { success: true, institution: safe };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function getInstitutionByCollegeCode(collegeCode) {
  const stmt = db.prepare("SELECT * FROM institutions_global WHERE college_code = ?");
  const record = stmt.get(String(collegeCode).trim().toUpperCase());
  if (!record) return null;
  const { institution_password: _, ...safe } = record;
  return safe;
}

// ==================== NETWORK CONNECTIONS ====================

function normalizeActorRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (["student", "guardian", "counsellor", "institution"].includes(normalized)) {
    return normalized;
  }
  return "";
}

function normalizeConnectionStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["pending", "active", "rejected", "blocked"].includes(normalized)) {
    return normalized;
  }
  return "";
}

export function createNetworkConnectionRequest(studentId, actorId, actorRole, relationType) {
  const normalizedStudentId = String(studentId || "").trim();
  const normalizedActorId = String(actorId || "").trim().toLowerCase();
  const normalizedRole = normalizeActorRole(actorRole);
  const normalizedRelation = String(relationType || "").trim().toLowerCase() || normalizedRole;

  if (!normalizedStudentId || !normalizedActorId || !normalizedRole) {
    return { success: false, error: "student_id, actor_id and actor_role are required" };
  }

  const id = generateHexId();
  try {
    db.prepare(
      `INSERT INTO network_connections (id, student_id, actor_id, actor_role, relation_type, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    ).run(id, normalizedStudentId, normalizedActorId, normalizedRole, normalizedRelation);

    return { success: true, connection: getNetworkConnectionById(id) };
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE constraint")) {
      const existing = db
        .prepare("SELECT * FROM network_connections WHERE student_id = ? AND actor_id = ? AND actor_role = ?")
        .get(normalizedStudentId, normalizedActorId, normalizedRole);
      return { success: true, connection: existing };
    }
    return { success: false, error: error.message };
  }
}

export function getNetworkConnectionById(connectionId) {
  return db.prepare("SELECT * FROM network_connections WHERE id = ?").get(String(connectionId || "").trim());
}

export function updateNetworkConnectionStatus(connectionId, status) {
  const normalizedId = String(connectionId || "").trim();
  const normalizedStatus = normalizeConnectionStatus(status);
  if (!normalizedId || !normalizedStatus) {
    return { success: false, error: "connection_id and valid status are required" };
  }

  const existing = getNetworkConnectionById(normalizedId);
  if (!existing) {
    return { success: false, error: "Connection not found" };
  }

  db.prepare(
    "UPDATE network_connections SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(normalizedStatus, normalizedId);

  return { success: true, connection: getNetworkConnectionById(normalizedId) };
}

export function listNetworkConnectionsForStudent(studentId, statuses = []) {
  const normalizedStudentId = String(studentId || "").trim();
  if (!normalizedStudentId) return [];

  const validStatuses = (Array.isArray(statuses) ? statuses : [])
    .map(normalizeConnectionStatus)
    .filter(Boolean);

  if (!validStatuses.length) {
    return db
      .prepare("SELECT * FROM network_connections WHERE student_id = ? ORDER BY created_at DESC")
      .all(normalizedStudentId);
  }

  const placeholders = validStatuses.map(() => "?").join(", ");
  return db
    .prepare(`SELECT * FROM network_connections WHERE student_id = ? AND status IN (${placeholders}) ORDER BY created_at DESC`)
    .all(normalizedStudentId, ...validStatuses);
}

export function listNetworkConnectionsForActor(actorId, actorRole, statuses = []) {
  const normalizedActorId = String(actorId || "").trim().toLowerCase();
  const normalizedRole = normalizeActorRole(actorRole);
  if (!normalizedActorId || !normalizedRole) return [];

  const validStatuses = (Array.isArray(statuses) ? statuses : [])
    .map(normalizeConnectionStatus)
    .filter(Boolean);

  if (!validStatuses.length) {
    return db
      .prepare("SELECT * FROM network_connections WHERE actor_id = ? AND actor_role = ? ORDER BY created_at DESC")
      .all(normalizedActorId, normalizedRole);
  }

  const placeholders = validStatuses.map(() => "?").join(", ");
  return db
    .prepare(`SELECT * FROM network_connections WHERE actor_id = ? AND actor_role = ? AND status IN (${placeholders}) ORDER BY created_at DESC`)
    .all(normalizedActorId, normalizedRole, ...validStatuses);
}

export function deleteNetworkConnection(connectionId) {
  const normalizedId = String(connectionId || "").trim();
  if (!normalizedId) return { success: false, error: "connection_id is required" };

  const existing = getNetworkConnectionById(normalizedId);
  if (!existing) return { success: false, error: "Connection not found" };

  db.prepare("DELETE FROM network_connections WHERE id = ?").run(normalizedId);
  return { success: true };
}

function normalizeRequestUrgency(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["critical", "bad"].includes(normalized)) {
    return normalized;
  }
  return "";
}

function normalizeRequestStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["pending", "session_created", "resolved"].includes(normalized)) {
    return normalized;
  }
  return "";
}

export function createCounsellorRequest(payload) {
  const studentId = String(payload?.studentId || "").trim();
  const sessionId = String(payload?.sessionId || "").trim();
  const sessionEmotion = String(payload?.sessionEmotion || "").trim().toUpperCase();
  const urgency = normalizeRequestUrgency(payload?.urgency);
  const reason = String(payload?.reason || "").trim();
  const requestedByRole = String(payload?.requestedByRole || "").trim().toLowerCase();
  const requestedByEmail = String(payload?.requestedByEmail || "").trim().toLowerCase();

  if (!studentId || !urgency || !requestedByEmail || !requestedByRole) {
    return { success: false, error: "student_id, urgency, requested_by_role, and requested_by_email are required" };
  }

  if (!["guardian", "institution"].includes(requestedByRole)) {
    return { success: false, error: "requested_by_role must be guardian or institution" };
  }

  const student = getUserById(studentId);
  if (!student) {
    return { success: false, error: "Student not found" };
  }

  const id = generateHexId();

  db.prepare(
    `INSERT INTO counsellor_requests (
      id, student_id, session_id, session_emotion, urgency, reason, requested_by_role, requested_by_email, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(
    id,
    studentId,
    sessionId || null,
    sessionEmotion || null,
    urgency,
    reason || null,
    requestedByRole,
    requestedByEmail
  );

  const created = db
    .prepare(
      `SELECT r.*, u.username AS student_username, u.email AS student_email
       FROM counsellor_requests r
       JOIN users u ON u.id = r.student_id
       WHERE r.id = ?`
    )
    .get(id);

  return { success: true, request: created };
}

export function listCounsellorRequestsForCounsellor(counsellorEmail) {
  const normalizedCounsellorEmail = String(counsellorEmail || "").trim().toLowerCase();
  if (!normalizedCounsellorEmail) {
    return { success: false, error: "counsellor_email is required" };
  }

  const counsellor = getCounsellorByEmail(normalizedCounsellorEmail);
  if (!counsellor) {
    return { success: false, error: "Counsellor not found" };
  }

  const students = getUsersByCounsellorInstitution(counsellor.aishe_code, counsellor.udise_code);
  const studentIds = students.map((student) => String(student.id));

  if (!studentIds.length) {
    return { success: true, requests: [] };
  }

  const placeholders = studentIds.map(() => "?").join(", ");
  const requests = db
    .prepare(
      `SELECT r.*, u.username AS student_username, u.email AS student_email
       FROM counsellor_requests r
       JOIN users u ON u.id = r.student_id
       WHERE r.student_id IN (${placeholders})
       ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'session_created' THEN 1 ELSE 2 END, r.created_at DESC`
    )
    .all(...studentIds);

  return { success: true, requests };
}

export function updateCounsellorRequestStatus(requestId, status, handledBy) {
  const normalizedRequestId = String(requestId || "").trim();
  const normalizedStatus = normalizeRequestStatus(status);
  const normalizedHandledBy = String(handledBy || "").trim().toLowerCase();

  if (!normalizedRequestId || !normalizedStatus || !normalizedHandledBy) {
    return { success: false, error: "request id, status, and handled_by are required" };
  }

  const existing = db.prepare("SELECT * FROM counsellor_requests WHERE id = ?").get(normalizedRequestId);
  if (!existing) {
    return { success: false, error: "Request not found" };
  }

  db.prepare(
    `UPDATE counsellor_requests
     SET status = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(normalizedStatus, normalizedHandledBy, normalizedRequestId);

  const updated = db
    .prepare(
      `SELECT r.*, u.username AS student_username, u.email AS student_email
       FROM counsellor_requests r
       JOIN users u ON u.id = r.student_id
       WHERE r.id = ?`
    )
    .get(normalizedRequestId);

  return { success: true, request: updated };
}

export function createCounsellorSchedule(payload) {
  const studentId = String(payload?.studentId || "").trim();
  const counsellorEmail = String(payload?.counsellorEmail || "").trim().toLowerCase();
  const scheduledFor = String(payload?.scheduledFor || "").trim();
  const urgency = normalizeRequestUrgency(payload?.urgency) || "bad";
  const notes = String(payload?.notes || "").trim();
  const sourceRequestId = String(payload?.sourceRequestId || "").trim();

  if (!studentId || !counsellorEmail || !scheduledFor) {
    return { success: false, error: "student_id, counsellor_email, and scheduled_for are required" };
  }

  const scheduleDate = new Date(scheduledFor);
  if (Number.isNaN(scheduleDate.getTime())) {
    return { success: false, error: "scheduled_for must be a valid datetime" };
  }

  const counsellor = getCounsellorByEmail(counsellorEmail);
  if (!counsellor) {
    return { success: false, error: "Counsellor not found" };
  }

  const allowedStudents = getUsersByCounsellorInstitution(counsellor.aishe_code, counsellor.udise_code);
  const isAllowed = allowedStudents.some((student) => String(student.id) === studentId);
  if (!isAllowed) {
    return { success: false, error: "Counsellor is not linked to this student" };
  }

  const id = generateHexId();
  db.prepare(
    `INSERT INTO counsellor_schedules (
      id, student_id, counsellor_email, scheduled_for, urgency, notes, source_request_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    studentId,
    counsellorEmail,
    scheduleDate.toISOString(),
    urgency,
    notes || null,
    sourceRequestId || null
  );

  if (sourceRequestId) {
    updateCounsellorRequestStatus(sourceRequestId, "session_created", counsellorEmail);
  }

  const created = db
    .prepare(
      `SELECT s.*, u.username AS student_username, u.email AS student_email
       FROM counsellor_schedules s
       JOIN users u ON u.id = s.student_id
       WHERE s.id = ?`
    )
    .get(id);

  return { success: true, schedule: created };
}

export function listCounsellorSchedules(counsellorEmail, studentId = "") {
  const normalizedCounsellorEmail = String(counsellorEmail || "").trim().toLowerCase();
  const normalizedStudentId = String(studentId || "").trim();

  if (!normalizedCounsellorEmail) {
    return { success: false, error: "counsellor_email is required" };
  }

  const counsellor = getCounsellorByEmail(normalizedCounsellorEmail);
  if (!counsellor) {
    return { success: false, error: "Counsellor not found" };
  }

  if (normalizedStudentId) {
    const rows = db
      .prepare(
        `SELECT s.*, u.username AS student_username, u.email AS student_email
         FROM counsellor_schedules s
         JOIN users u ON u.id = s.student_id
         WHERE s.counsellor_email = ? AND s.student_id = ?
         ORDER BY s.scheduled_for DESC`
      )
      .all(normalizedCounsellorEmail, normalizedStudentId);
    return { success: true, schedules: rows };
  }

  const rows = db
    .prepare(
      `SELECT s.*, u.username AS student_username, u.email AS student_email
       FROM counsellor_schedules s
       JOIN users u ON u.id = s.student_id
       WHERE s.counsellor_email = ?
       ORDER BY s.scheduled_for DESC`
    )
    .all(normalizedCounsellorEmail);

  return { success: true, schedules: rows };
}
