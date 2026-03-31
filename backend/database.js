import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "care-connect.db");
const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Initialize database schema
function initDatabase() {
  // Create users table (students)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create guardians table (weak entity - depends on student)
  db.exec(`
    CREATE TABLE IF NOT EXISTS guardians (
      student_id TEXT PRIMARY KEY,
      guardian_name TEXT NOT NULL,
      guardian_email TEXT,
      guardian_password TEXT,
      guardian_phone TEXT,
      relationship TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const guardianColumns = db.prepare("PRAGMA table_info(guardians)").all().map((c) => c.name);
  if (!guardianColumns.includes("guardian_password")) {
    db.exec("ALTER TABLE guardians ADD COLUMN guardian_password TEXT");
  }

  const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!userColumns.includes("institution_access_code")) {
    db.exec("ALTER TABLE users ADD COLUMN institution_access_code TEXT");
  }
  if (!userColumns.includes("institution_college_code")) {
    db.exec("ALTER TABLE users ADD COLUMN institution_college_code TEXT");
  }

  // Create counsellors table
  db.exec(`
    CREATE TABLE IF NOT EXISTS counsellors (
      counsellor_email TEXT NOT NULL,
      student_id TEXT NOT NULL,
      counsellor_password TEXT NOT NULL,
      crr_number TEXT,
      organization TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (counsellor_email, student_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const counsellorColumns = db.prepare("PRAGMA table_info(counsellors)").all().map((c) => c.name);
  if (!counsellorColumns.includes("crr_number")) {
    db.exec("ALTER TABLE counsellors ADD COLUMN crr_number TEXT");
  }
  if (!counsellorColumns.includes("aishe_code")) {
    db.exec("ALTER TABLE counsellors ADD COLUMN aishe_code TEXT");
  }
  if (!counsellorColumns.includes("udise_code")) {
    db.exec("ALTER TABLE counsellors ADD COLUMN udise_code TEXT");
  }

  // Create global counsellors table (not linked to single student)
  db.exec(`
    CREATE TABLE IF NOT EXISTS counsellors_global (
      counsellor_email TEXT PRIMARY KEY,
      counsellor_password TEXT NOT NULL,
      crr_number TEXT,
      organization TEXT,
      aishe_code TEXT,
      udise_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create institutions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS institutions (
      institution_email TEXT NOT NULL,
      student_id TEXT NOT NULL,
      institution_password TEXT NOT NULL,
      institution_name TEXT,
      aishe_code TEXT,
      udise_code TEXT,
      college_code TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (institution_email, student_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const institutionColumns = db.prepare("PRAGMA table_info(institutions)").all().map((c) => c.name);
  if (!institutionColumns.includes("aishe_code")) {
    db.exec("ALTER TABLE institutions ADD COLUMN aishe_code TEXT");
  }
  if (!institutionColumns.includes("udise_code")) {
    db.exec("ALTER TABLE institutions ADD COLUMN udise_code TEXT");
  }
  if (!institutionColumns.includes("college_code")) {
    db.exec("ALTER TABLE institutions ADD COLUMN college_code TEXT");
  }

  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_institutions_college_code ON institutions(college_code)");

  // Create global institutions table (not linked to single student)
  db.exec(`
    CREATE TABLE IF NOT EXISTS institutions_global (
      institution_email TEXT PRIMARY KEY,
      institution_password TEXT NOT NULL,
      institution_name TEXT,
      aishe_code TEXT,
      udise_code TEXT,
      college_code TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_institutions_global_college_code ON institutions_global(college_code)");

  // Create care network links (student-centered graph of connected actors)
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_connections (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      relation_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (student_id, actor_id, actor_role)
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_network_student_id ON network_connections(student_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_network_actor ON network_connections(actor_id, actor_role)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_network_status ON network_connections(status)");

  // Create counsellor escalation requests from guardians/institutions
  db.exec(`
    CREATE TABLE IF NOT EXISTS counsellor_requests (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      session_id TEXT,
      session_emotion TEXT,
      urgency TEXT NOT NULL,
      reason TEXT,
      requested_by_role TEXT NOT NULL,
      requested_by_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      handled_by TEXT,
      handled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_counsellor_requests_student ON counsellor_requests(student_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_counsellor_requests_status ON counsellor_requests(status)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_counsellor_requests_created_at ON counsellor_requests(created_at DESC)");

  // Create counsellor schedule entries for follow-up/support sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS counsellor_schedules (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      counsellor_email TEXT NOT NULL,
      scheduled_for DATETIME NOT NULL,
      urgency TEXT NOT NULL,
      notes TEXT,
      source_request_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (source_request_id) REFERENCES counsellor_requests(id) ON DELETE SET NULL
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_counsellor_schedules_student ON counsellor_schedules(student_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_counsellor_schedules_counsellor ON counsellor_schedules(counsellor_email)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_counsellor_schedules_when ON counsellor_schedules(scheduled_for DESC)");

  const counsellorScheduleColumns = db.prepare("PRAGMA table_info(counsellor_schedules)").all().map((c) => c.name);
  if (!counsellorScheduleColumns.includes("student_read_at")) {
    db.exec("ALTER TABLE counsellor_schedules ADD COLUMN student_read_at DATETIME");
  }

  // Create session archive table for non-IPFS fallback retrieval
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_archives (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      history_json TEXT NOT NULL,
      cid TEXT,
      pinned_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_session_archives_student ON session_archives(student_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_session_archives_created ON session_archives(created_at DESC)");

  console.log("✅ Database initialized successfully");
}

// Initialize on import
initDatabase();

export default db;
