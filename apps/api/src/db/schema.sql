-- ============================================
-- E-ATTENDANCE SYSTEM DATABASE SCHEMA
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'employee',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  source TEXT DEFAULT 'qr',
  verified_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- QR sessions (expires in 10 seconds)
CREATE TABLE IF NOT EXISTS qr_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert default admin (password: admin123)
-- Hash: bcrypt.hashSync('admin123', 10)
INSERT INTO users (employee_id, name, email, password_hash, role)
SELECT 'ADMIN001', 'System Admin', 'admin@attendance.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrD7QqD.3sL4Z5NQlLqZvZvZvZvZv', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@attendance.com');
