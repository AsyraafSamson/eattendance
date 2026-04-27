import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { Bindings, Variables, User, AttendanceRecord } from '../types'
import { getDistanceMeters } from '../lib/geo'
import { getAppSettings } from '../lib/settings'

const attend = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// POST /api/attend
// Public endpoint — employee submits attendance by scanning QR
attend.post('/', async (c) => {
  const { email, password, type, lat, lng } = await c.req.json<{
    email: string
    password: string
    type: 'check-in' | 'check-out'
    lat?: number
    lng?: number
  }>()

  if (!email || !password || !type) {
    return c.json({ error: 'Email, password and type are required' }, 400)
  }
  if (!['check-in', 'check-out'].includes(type)) {
    return c.json({ error: 'type must be check-in or check-out' }, 400)
  }

  const devMode = c.env.DEV_MODE === 'true'
  const settings = await getAppSettings(c.env.DB)

  // GPS check (skip in DEV_MODE)
  if (!devMode) {
    if (lat === undefined || lng === undefined) {
      return c.json({ error: 'Location access required' }, 400)
    }

    const distance = getDistanceMeters(lat, lng, settings.officeLat, settings.officeLng)

    if (distance > settings.officeRadiusMeters) {
      return c.json({
        error: `Anda tidak berada di lokasi pejabat. Jarak: ${Math.round(distance)}m (had: ${settings.officeRadiusMeters}m)`,
        distance: Math.round(distance),
        allowed: false,
      }, 403)
    }
  }

  // Verify credentials
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND is_active = 1'
  ).bind(email).first<User>()

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return c.json({ error: 'Email atau password salah' }, 401)
  }

  // Duplicate punch prevention — check last record today
  const todayMY = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
  const lastRecord = await c.env.DB.prepare(
    `SELECT type FROM attendance
     WHERE user_id = ? AND date(timestamp, '+8 hours') = ?
     ORDER BY timestamp DESC LIMIT 1`
  ).bind(user.id, todayMY).first<{ type: string }>()

  if (lastRecord?.type === type) {
    return c.json({
      error: type === 'check-in'
        ? 'Anda sudah check-in hari ini'
        : 'Anda sudah check-out hari ini',
    }, 409)
  }

  // Record attendance with GPS coords
  await c.env.DB.prepare(
    'INSERT INTO attendance (user_id, type, source, lat, lng) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, type, 'qr', lat ?? null, lng ?? null).run()

  // Fetch today's updated records
  const todayRecords = await c.env.DB.prepare(
    `SELECT type, timestamp FROM attendance
     WHERE user_id = ? AND date(timestamp, '+8 hours') = ?
     ORDER BY timestamp ASC`
  ).bind(user.id, todayMY).all<{ type: string; timestamp: string }>()

  return c.json({
    success: true,
    message: type === 'check-in' ? 'Check-in berjaya! ✅' : 'Check-out berjaya! ✅',
    name: user.name,
    employee_id: user.employee_id,
    type,
    devMode,
    todayRecords: todayRecords.results ?? [],
  })
})

// GET /api/attend/info — returns office info for the attend page
attend.get('/info', async (c) => {
  const settings = await getAppSettings(c.env.DB)
  return c.json({
    officeName: settings.officeName,
    devMode: c.env.DEV_MODE === 'true',
  })
})

export default attend
