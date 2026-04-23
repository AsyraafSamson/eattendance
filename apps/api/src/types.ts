export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  OFFICE_LAT: string
  OFFICE_LNG: string
  OFFICE_RADIUS_METERS: string
  OFFICE_NAME: string
  DEV_MODE: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  FRONTEND_URL: string
}

export type Variables = {
  userId: string
  userRole: string
}

export type User = {
  id: string
  employee_id: string
  name: string
  email: string
  password_hash: string
  role: string             // employee | manager | admin
  department: string | null
  manager_id: string | null
  pto_balance: number
  is_active: number
  created_at: string
}

export type AttendanceRecord = {
  id: string
  user_id: string
  type: string             // check-in | check-out
  timestamp: string
  source: string           // qr | gps | manual
  lat: number | null
  lng: number | null
  notes: string | null
  verified_by: string | null
}

export type QrSession = {
  id: string
  user_id: string
  code: string
  expires_at: string
  created_at: string
}

export type Break = {
  id: string
  user_id: string
  attendance_date: string
  start_time: string
  end_time: string | null
  is_paid: number
  created_at: string
}

export type Timesheet = {
  id: string
  user_id: string
  period_start: string
  period_end: string
  status: string           // draft | submitted | approved | rejected
  regular_hours: number
  overtime_hours: number
  break_hours: number
  total_hours: number
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
}

export type Shift = {
  id: string
  user_id: string
  shift_date: string
  start_time: string
  end_time: string
  is_off_day: number
  created_at: string
}

export type OvertimeRule = {
  id: string
  name: string
  daily_threshold_hours: number
  weekly_threshold_hours: number
  multiplier: number
  is_active: number
  created_at: string
}

export type PTORequest = {
  id: string
  user_id: string
  type: string             // annual | sick | emergency
  start_date: string
  end_date: string
  days_requested: number
  hours_deducted: number
  status: string           // pending | approved | rejected
  reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  type: string             // missed_punch | timesheet_reviewed | pto_reviewed
  title: string
  message: string
  is_read: number
  created_at: string
}
