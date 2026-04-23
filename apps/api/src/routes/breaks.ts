import { Hono } from 'hono'
import type { Bindings, Variables, Break } from '../types'
import { authMiddleware } from '../middleware/auth'

const breaks = new Hono<{ Bindings: Bindings; Variables: Variables }>()

breaks.use('*', authMiddleware)

// Helper: get today's date in MYT (UTC+8)
function todayMYT(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// POST /api/breaks/start — start a break
breaks.post('/start', async (c) => {
  const userId = c.get('userId')
  const today = todayMYT()

  // Must be clocked in today
  const lastAttendance = await c.env.DB.prepare(
    `SELECT type FROM attendance
     WHERE user_id = ? AND date(timestamp, '+8 hours') = ?
     ORDER BY timestamp DESC LIMIT 1`
  ).bind(userId, today).first<{ type: string }>()

  if (lastAttendance?.type !== 'check-in') {
    return c.json({ error: 'Anda perlu check-in dahulu sebelum mula rehat' }, 400)
  }

  // Must not have an open break
  const openBreak = await c.env.DB.prepare(
    `SELECT id FROM breaks
     WHERE user_id = ? AND attendance_date = ? AND end_time IS NULL`
  ).bind(userId, today).first()

  if (openBreak) {
    return c.json({ error: 'Anda sudah dalam rehat. Tamatkan rehat semasa dahulu.' }, 409)
  }

  const now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO breaks (user_id, attendance_date, start_time) VALUES (?, ?, ?)'
  ).bind(userId, today, now).run()

  return c.json({ success: true, message: 'Rehat bermula ⏸️', started_at: now })
})

// POST /api/breaks/end — end the current break
breaks.post('/end', async (c) => {
  const userId = c.get('userId')
  const today = todayMYT()

  const openBreak = await c.env.DB.prepare(
    `SELECT id, start_time FROM breaks
     WHERE user_id = ? AND attendance_date = ? AND end_time IS NULL`
  ).bind(userId, today).first<{ id: string; start_time: string }>()

  if (!openBreak) {
    return c.json({ error: 'Tiada rehat aktif' }, 400)
  }

  const now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  const durationMs = new Date(now).getTime() - new Date(openBreak.start_time).getTime()
  const durationMinutes = Math.round(durationMs / 60000)

  await c.env.DB.prepare(
    'UPDATE breaks SET end_time = ? WHERE id = ?'
  ).bind(now, openBreak.id).run()

  return c.json({
    success: true,
    message: 'Rehat tamat ▶️',
    ended_at: now,
    duration_minutes: durationMinutes,
  })
})

// GET /api/breaks/today — get today's breaks for current user
breaks.get('/today', async (c) => {
  const userId = c.get('userId')
  const today = todayMYT()

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM breaks WHERE user_id = ? AND attendance_date = ? ORDER BY start_time ASC`
  ).bind(userId, today).all<Break>()

  // Compute total break minutes
  const totalMinutes = (results ?? []).reduce((sum, b) => {
    if (!b.end_time) return sum
    return sum + Math.round((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000)
  }, 0)

  return c.json({ breaks: results ?? [], total_minutes: totalMinutes })
})

// GET /api/breaks/history?date=YYYY-MM-DD — get breaks for a specific date
breaks.get('/history', async (c) => {
  const userId = c.get('userId')
  const date = c.req.query('date') ?? todayMYT()

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM breaks WHERE user_id = ? AND attendance_date = ? ORDER BY start_time ASC`
  ).bind(userId, date).all<Break>()

  return c.json(results ?? [])
})

export default breaks
