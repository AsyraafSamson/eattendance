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
  role TEXT DEFAULT 'employee',       -- employee | manager | admin
  department TEXT,
  manager_id TEXT REFERENCES users(id),
  pto_balance REAL DEFAULT 0,         -- remaining PTO hours
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                 -- check-in | check-out
  timestamp TEXT DEFAULT (datetime('now')),
  source TEXT DEFAULT 'qr',          -- qr | gps | manual
  lat REAL,
  lng REAL,
  notes TEXT,
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

-- Break records
CREATE TABLE IF NOT EXISTS breaks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  attendance_date TEXT NOT NULL,      -- date of work day (MYT YYYY-MM-DD)
  start_time TEXT NOT NULL,
  end_time TEXT,
  is_paid INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Timesheets (one per pay period per employee)
CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  period_start TEXT NOT NULL,         -- YYYY-MM-DD
  period_end TEXT NOT NULL,           -- YYYY-MM-DD
  status TEXT DEFAULT 'draft',        -- draft | submitted | approved | rejected
  regular_hours REAL DEFAULT 0,
  overtime_hours REAL DEFAULT 0,
  break_hours REAL DEFAULT 0,
  total_hours REAL DEFAULT 0,
  submitted_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- Employee shift schedules
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,           -- YYYY-MM-DD
  start_time TEXT NOT NULL,           -- HH:MM
  end_time TEXT NOT NULL,             -- HH:MM
  is_off_day INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Overtime rules (applied globally)
CREATE TABLE IF NOT EXISTS overtime_rules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  daily_threshold_hours REAL DEFAULT 8,
  weekly_threshold_hours REAL DEFAULT 40,
  multiplier REAL DEFAULT 1.5,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- PTO / leave requests
CREATE TABLE IF NOT EXISTS pto_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                 -- annual | sick | emergency
  start_date TEXT NOT NULL,           -- YYYY-MM-DD
  end_date TEXT NOT NULL,             -- YYYY-MM-DD
  days_requested REAL NOT NULL,
  hours_deducted REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',      -- pending | approved | rejected
  reason TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                 -- missed_punch | timesheet_reviewed | pto_reviewed
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Application settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default overtime rule
INSERT INTO overtime_rules (name, daily_threshold_hours, weekly_threshold_hours, multiplier)
SELECT 'Standard OT', 8, 40, 1.5
WHERE NOT EXISTS (SELECT 1 FROM overtime_rules);
