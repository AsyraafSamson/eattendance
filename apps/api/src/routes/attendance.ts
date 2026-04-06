import { Hono } from 'hono'
import QRCode from 'qrcode'
import type { Bindings, Variables, AttendanceRecord, QrSession } from '../types'
import { authMiddleware, adminOnly } from '../middleware/auth'

const attendance = new Hono<{ Bindings: Bindings; Variables: Variables }>()

attendance.use('*', authMiddleware)

// POST /api/attendance/generate-qr
// Generate QR code for the current user (valid for 10 seconds)
attendance.post('/generate-qr', async (c) => {
  const userId = c.get('userId')
  const code = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 10_000).toISOString()

  // Clean up old sessions for this user
  await c.env.DB.prepare(
    'DELETE FROM qr_sessions WHERE user_id = ?'
  ).bind(userId).run()

  await c.env.DB.prepare(
    'INSERT INTO qr_sessions (user_id, code, expires_at) VALUES (?, ?, ?)'
  ).bind(userId, code, expiresAt).run()

  const qrSvg = await QRCode.toString(code, { type: 'svg' })

  return c.json({ code, qr: qrSvg, expiresAt })
})

// POST /api/attendance/scan
// Scan QR code and record attendance
attendance.post('/scan', async (c) => {
  const { code, type } = await c.req.json<{ code: string; type: 'check-in' | 'check-out' }>()

  if (!code || !type) {
    return c.json({ error: 'code and type required' }, 400)
  }
  if (!['check-in', 'check-out'].includes(type)) {
    return c.json({ error: 'type must be check-in or check-out' }, 400)
  }

  const session = await c.env.DB.prepare(
    'SELECT * FROM qr_sessions WHERE code = ?'
  ).bind(code).first<QrSession>()

  if (!session) return c.json({ error: 'Invalid QR code' }, 400)

  if (new Date(session.expires_at) < new Date()) {
    await c.env.DB.prepare('DELETE FROM qr_sessions WHERE id = ?').bind(session.id).run()
    return c.json({ error: 'QR code expired' }, 400)
  }

  const scannedBy = c.get('userId')

  await c.env.DB.prepare(
    'INSERT INTO attendance (user_id, type, source, verified_by) VALUES (?, ?, ?, ?)'
  ).bind(session.user_id, type, 'qr', scannedBy).run()

  // Invalidate QR session after use
  await c.env.DB.prepare('DELETE FROM qr_sessions WHERE id = ?').bind(session.id).run()

  return c.json({ success: true, userId: session.user_id, type })
})

// GET /api/attendance/today
attendance.get('/today', async (c) => {
  const userId = c.get('userId')
  const todayMY = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM attendance WHERE user_id = ? AND date(timestamp, '+8 hours') = ? ORDER BY timestamp ASC`
  ).bind(userId, todayMY).all<AttendanceRecord>()

  return c.json(results)
})

// GET /api/attendance/history?limit=30
attendance.get('/history', async (c) => {
  const userId = c.get('userId')
  const limit = Math.min(Number(c.req.query('limit') ?? 30), 100)

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM attendance WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?'
  ).bind(userId, limit).all<AttendanceRecord>()

  return c.json(results)
})

// GET /api/attendance/all (admin only)
attendance.get('/all', adminOnly, async (c) => {
  // Use Malaysia date (UTC+8). Default to today MYT if no date param.
  const dateMY = c.req.query('date') ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { results } = await c.env.DB.prepare(`
    SELECT a.*, u.name, u.employee_id
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE date(a.timestamp, '+8 hours') = ?
    ORDER BY a.timestamp DESC
  `).bind(dateMY).all()

  return c.json(results)
})

export default attendance
