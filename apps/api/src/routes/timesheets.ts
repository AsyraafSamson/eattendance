import { Hono } from 'hono'
import type { Bindings, Variables, Timesheet, AttendanceRecord, Break, OvertimeRule } from '../types'
import { authMiddleware, managerOrAdmin } from '../middleware/auth'

const timesheets = new Hono<{ Bindings: Bindings; Variables: Variables }>()

timesheets.use('*', authMiddleware)

// ─── Hour Calculation Engine ────────────────────────────────────────────────

type HourSummary = {
  regular_hours: number
  overtime_hours: number
  break_hours: number
  total_hours: number
}

async function calculateHours(
  db: D1Database,
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<HourSummary> {
  // Fetch all attendance records in period
  const { results: records } = await db.prepare(
    `SELECT * FROM attendance
     WHERE user_id = ?
       AND date(timestamp, '+8 hours') >= ?
       AND date(timestamp, '+8 hours') <= ?
     ORDER BY timestamp ASC`
  ).bind(userId, periodStart, periodEnd).all<AttendanceRecord>()

  // Fetch all breaks in period
  const { results: breakRecords } = await db.prepare(
    `SELECT * FROM breaks
     WHERE user_id = ?
       AND attendance_date >= ?
       AND attendance_date <= ?
       AND end_time IS NOT NULL`
  ).bind(userId, periodStart, periodEnd).all<Break>()

  // Fetch active overtime rule
  const otRule = await db.prepare(
    'SELECT * FROM overtime_rules WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
  ).first<OvertimeRule>()

  const dailyThreshold = otRule?.daily_threshold_hours ?? 8

  // Group records by date
  const byDate: Record<string, AttendanceRecord[]> = {}
  for (const r of records ?? []) {
    const d = new Date(r.timestamp.replace(' ', 'T') + 'Z')
    const dateStr = new Date(d.getTime() + 8 * 3600000).toISOString().split('T')[0]
    ;(byDate[dateStr] ??= []).push(r)
  }

  // Group breaks by date
  const breaksByDate: Record<string, Break[]> = {}
  for (const b of breakRecords ?? []) {
    ;(breaksByDate[b.attendance_date] ??= []).push(b)
  }

  let totalWorkedMs = 0
  let totalBreakMs = 0
  let totalOtMs = 0

  for (const [date, dayRecords] of Object.entries(byDate)) {
    const checkIn = dayRecords.find(r => r.type === 'check-in')
    const checkOut = dayRecords.findLast(r => r.type === 'check-out')
    if (!checkIn || !checkOut) continue

    const workedMs = new Date(checkOut.timestamp.replace(' ', 'T') + 'Z').getTime()
      - new Date(checkIn.timestamp.replace(' ', 'T') + 'Z').getTime()

    // Subtract break time for this day
    const dayBreaks = breaksByDate[date] ?? []
    const breakMs = dayBreaks.reduce((sum, b) => {
      if (!b.end_time) return sum
      return sum + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime())
    }, 0)

    const netWorkedMs = Math.max(0, workedMs - breakMs)
    const thresholdMs = dailyThreshold * 3600000
    const otMs = Math.max(0, netWorkedMs - thresholdMs)

    totalWorkedMs += netWorkedMs
    totalBreakMs += breakMs
    totalOtMs += otMs
  }

  const regularMs = Math.max(0, totalWorkedMs - totalOtMs)
  const round2 = (n: number) => Math.round(n * 100) / 100

  return {
    regular_hours: round2(regularMs / 3600000),
    overtime_hours: round2(totalOtMs / 3600000),
    break_hours: round2(totalBreakMs / 3600000),
    total_hours: round2(totalWorkedMs / 3600000),
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/timesheets/my — list current user's timesheets
timesheets.get('/my', async (c) => {
  const userId = c.get('userId')
  const limit = Math.min(Number(c.req.query('limit') ?? 12), 50)

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM timesheets WHERE user_id = ? ORDER BY period_start DESC LIMIT ?`
  ).bind(userId, limit).all<Timesheet>()

  return c.json(results ?? [])
})

// POST /api/timesheets/generate — generate (or recalculate) a timesheet for a period
timesheets.post('/generate', async (c) => {
  const userId = c.get('userId')
  const { period_start, period_end } = await c.req.json<{
    period_start: string
    period_end: string
  }>()

  if (!period_start || !period_end) {
    return c.json({ error: 'period_start and period_end are required (YYYY-MM-DD)' }, 400)
  }

  const hours = await calculateHours(c.env.DB, userId, period_start, period_end)

  // Upsert timesheet (update if exists and is still draft)
  const existing = await c.env.DB.prepare(
    `SELECT id, status FROM timesheets WHERE user_id = ? AND period_start = ? AND period_end = ?`
  ).bind(userId, period_start, period_end).first<{ id: string; status: string }>()

  if (existing) {
    if (existing.status !== 'draft') {
      return c.json({ error: 'Timesheet sudah dihantar atau diluluskan, tidak boleh dijana semula' }, 409)
    }
    await c.env.DB.prepare(
      `UPDATE timesheets SET regular_hours=?, overtime_hours=?, break_hours=?, total_hours=? WHERE id=?`
    ).bind(hours.regular_hours, hours.overtime_hours, hours.break_hours, hours.total_hours, existing.id).run()

    return c.json({ success: true, id: existing.id, ...hours })
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO timesheets (user_id, period_start, period_end, regular_hours, overtime_hours, break_hours, total_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(userId, period_start, period_end, hours.regular_hours, hours.overtime_hours, hours.break_hours, hours.total_hours).first<{ id: string }>()

  return c.json({ success: true, id: result?.id, ...hours }, 201)
})

// POST /api/timesheets/:id/submit — employee submits for approval
timesheets.post('/:id/submit', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const ts = await c.env.DB.prepare(
    'SELECT * FROM timesheets WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<Timesheet>()

  if (!ts) return c.json({ error: 'Timesheet tidak dijumpai' }, 404)
  if (ts.status !== 'draft') return c.json({ error: 'Hanya timesheet draft boleh dihantar' }, 400)

  const now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    `UPDATE timesheets SET status = 'submitted', submitted_at = ? WHERE id = ?`
  ).bind(now, id).run()

  // Notify the employee's manager
  const manager = await c.env.DB.prepare(
    `SELECT manager_id FROM users WHERE id = ?`
  ).bind(userId).first<{ manager_id: string | null }>()

  if (manager?.manager_id) {
    const employee = await c.env.DB.prepare(
      'SELECT name, employee_id FROM users WHERE id = ?'
    ).bind(userId).first<{ name: string; employee_id: string }>()

    await c.env.DB.prepare(
      `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'timesheet_submitted', ?, ?)`
    ).bind(
      manager.manager_id,
      'Timesheet Menunggu Kelulusan',
      `${employee?.name} (${employee?.employee_id}) telah menghantar timesheet ${ts.period_start} – ${ts.period_end}.`
    ).run()
  }

  return c.json({ success: true, message: 'Timesheet dihantar untuk kelulusan' })
})

// POST /api/timesheets/:id/approve — manager/admin approves
timesheets.post('/:id/approve', managerOrAdmin, async (c) => {
  const reviewerId = c.get('userId')
  const id = c.req.param('id')
  const { notes } = await c.req.json<{ notes?: string }>().catch(() => ({ notes: undefined }))

  const ts = await c.env.DB.prepare('SELECT * FROM timesheets WHERE id = ?').bind(id).first<Timesheet>()
  if (!ts) return c.json({ error: 'Timesheet tidak dijumpai' }, 404)
  if (ts.status !== 'submitted') return c.json({ error: 'Hanya timesheet yang dihantar boleh diluluskan' }, 400)

  const now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    `UPDATE timesheets SET status='approved', reviewed_by=?, reviewed_at=?, review_notes=? WHERE id=?`
  ).bind(reviewerId, now, notes ?? null, id).run()

  await c.env.DB.prepare(
    `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'timesheet_reviewed', ?, ?)`
  ).bind(
    ts.user_id,
    'Timesheet Diluluskan ✅',
    `Timesheet ${ts.period_start} – ${ts.period_end} anda telah diluluskan.`
  ).run()

  return c.json({ success: true, message: 'Timesheet diluluskan' })
})

// POST /api/timesheets/:id/reject — manager/admin rejects
timesheets.post('/:id/reject', managerOrAdmin, async (c) => {
  const reviewerId = c.get('userId')
  const id = c.req.param('id')
  const { notes } = await c.req.json<{ notes?: string }>().catch(() => ({ notes: undefined }))

  const ts = await c.env.DB.prepare('SELECT * FROM timesheets WHERE id = ?').bind(id).first<Timesheet>()
  if (!ts) return c.json({ error: 'Timesheet tidak dijumpai' }, 404)
  if (ts.status !== 'submitted') return c.json({ error: 'Hanya timesheet yang dihantar boleh ditolak' }, 400)

  const now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    `UPDATE timesheets SET status='rejected', reviewed_by=?, reviewed_at=?, review_notes=? WHERE id=?`
  ).bind(reviewerId, now, notes ?? null, id).run()

  await c.env.DB.prepare(
    `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'timesheet_reviewed', ?, ?)`
  ).bind(
    ts.user_id,
    'Timesheet Ditolak ❌',
    `Timesheet ${ts.period_start} – ${ts.period_end} anda telah ditolak.${notes ? ` Nota: ${notes}` : ''}`
  ).run()

  return c.json({ success: true, message: 'Timesheet ditolak' })
})

// GET /api/timesheets/pending — manager/admin: list all submitted timesheets
timesheets.get('/pending', managerOrAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, u.name, u.employee_id, u.department
     FROM timesheets t JOIN users u ON t.user_id = u.id
     WHERE t.status = 'submitted'
     ORDER BY t.submitted_at ASC`
  ).all()

  return c.json(results ?? [])
})

// GET /api/timesheets/:id — get single timesheet detail
timesheets.get('/:id', async (c) => {
  const userId = c.get('userId')
  const role = c.get('userRole')
  const id = c.req.param('id')

  const ts = await c.env.DB.prepare(
    `SELECT t.*, u.name, u.employee_id, u.department
     FROM timesheets t JOIN users u ON t.user_id = u.id
     WHERE t.id = ?`
  ).bind(id).first()

  if (!ts) return c.json({ error: 'Timesheet tidak dijumpai' }, 404)

  // Employees can only view their own
  if (role === 'employee' && (ts as any).user_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return c.json(ts)
})

export default timesheets
