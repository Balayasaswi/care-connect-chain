import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "./database.js";

// Generate hex UUID (hexadecimal unique ID)
export function generateHexId() {
  return uuidv4().replace(/-/g, ""); // Remove dashes for pure hex
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
export async function registerUser(username, email, password) {
  try {
    const userId = generateHexId();
    const hashedPassword = await hashPassword(password);

    const stmt = db.prepare(
      "INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)"
    );
    
    stmt.run(userId, username, email, hashedPassword);

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
  const stmt = db.prepare("SELECT id, username, email, created_at FROM users WHERE email = ?");
  return stmt.get(email);
}

// Get user by ID
export function getUserById(userId) {
  const stmt = db.prepare("SELECT id, username, email, created_at FROM users WHERE id = ?");
  return stmt.get(userId);
}

// Add or update guardian for a student
export function addGuardian(studentId, guardianData) {
  try {
    const { guardian_name, guardian_email, guardian_phone, relationship } = guardianData;

    const stmt = db.prepare(`
      INSERT INTO guardians (student_id, guardian_name, guardian_email, guardian_phone, relationship)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        guardian_name = excluded.guardian_name,
        guardian_email = excluded.guardian_email,
        guardian_phone = excluded.guardian_phone,
        relationship = excluded.relationship
    `);

    stmt.run(studentId, guardian_name, guardian_email, guardian_phone, relationship);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get guardian for a student
export function getGuardian(studentId) {
  const stmt = db.prepare("SELECT * FROM guardians WHERE student_id = ?");
  return stmt.get(studentId);
}
