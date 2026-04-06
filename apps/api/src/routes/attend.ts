import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { Bindings, Variables, User } from '../types'
import { getDistanceMeters } from '../lib/geo'

const attend = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// POST /api/attend
// Public endpoint — employee submits attendance by scanning QR
attend.post('/', async (c) => {
  const { email, password, type, lat, lng } = await c.req.json<{
    email: string
    password: string
    type: 'check-in' | 'check-out'
    lat: number
    lng: number
  }>()

  // Validate inputs
  if (!email || !password || !type) {
    return c.json({ error: 'Email, password and type are required' }, 400)
  }
  if (!['check-in', 'check-out'].includes(type)) {
    return c.json({ error: 'type must be check-in or check-out' }, 400)
  }

  // GPS check (skip in DEV_MODE)
  const devMode = c.env.DEV_MODE === 'true'

  if (!devMode) {
    if (lat === undefined || lng === undefined) {
      return c.json({ error: 'Location access required' }, 400)
    }

    const officeLat = parseFloat(c.env.OFFICE_LAT)
    const officeLng = parseFloat(c.env.OFFICE_LNG)
    const radius = parseFloat(c.env.OFFICE_RADIUS_METERS)
    const distance = getDistanceMeters(lat, lng, officeLat, officeLng)

    if (distance > radius) {
      return c.json({
        error: `Anda tidak berada di lokasi pejabat. Jarak: ${Math.round(distance)}m (had: ${radius}m)`,
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

  // Record attendance
  await c.env.DB.prepare(
    'INSERT INTO attendance (user_id, type, source) VALUES (?, ?, ?)'
  ).bind(user.id, type, 'qr').run()

  // Fetch today's records for this user (Malaysia time = UTC+8)
  const todayUTC = new Date(Date.now() - ((Date.now() % 86400000) - 8*3600000 > 86400000 ? 0 : 0))
  const todayMY = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

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
attend.get('/info', (c) => {
  return c.json({
    officeName: c.env.OFFICE_NAME,
    devMode: c.env.DEV_MODE === 'true',
  })
})

export default attend
