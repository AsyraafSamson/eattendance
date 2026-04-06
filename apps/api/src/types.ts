export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  OFFICE_LAT: string
  OFFICE_LNG: string
  OFFICE_RADIUS_METERS: string
  OFFICE_NAME: string
  DEV_MODE: string
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
  role: string
  is_active: number
  created_at: string
}

export type AttendanceRecord = {
  id: string
  user_id: string
  type: string
  timestamp: string
  source: string
  verified_by: string | null
}

export type QrSession = {
  id: string
  user_id: string
  code: string
  expires_at: string
  created_at: string
}
