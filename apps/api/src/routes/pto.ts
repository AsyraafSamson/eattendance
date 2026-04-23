import { Hono } from 'hono'
import type { Bindings, Variables, PTORequest, User } from '../types'
import { authMiddleware, managerOrAdmin } from '../middleware/auth'

const pto = new Hono<{ Bindings: Bindings; Variables: Variables }>()

pto.use('*', authMiddleware)

// GET /api/pto/balance — get own PTO balance
pto.get('/balance', async (c) => {
  const userId = c.get('userId')

  const user = await c.env.DB.prepare(
    'SELECT pto_balance FROM users WHERE id = ?'
  ).bind(userId).first<{ pto_balance: number }>()

  return c.json({ balance: user?.pto_balance ?? 0 })
})

// GET /api/pto/my — list own PTO requests
pto.get('/my', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM pto_requests WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(userId).all<PTORequest>()

  return c.json(results ?? [])
})

// POST /api/pto — submit new PTO request
pto.post('/', async (c) => {
  const userId = c.get('userId')
  const { type, start_date, end_date, reason } = await c.req.json<{
    type: string
    start_date: string
    end_date: string
    reason?: string
  }>()

  if (!type || !start_date || !end_date) {
    return c.json({ error: 'type, start_date dan end_date diperlukan' }, 400)
  }
  if (!['annual', 'sick', 'emergency'].includes(type)) {
    return c.json({ error: 'type mestilah annual, sick atau emergency' }, 400)
  }

  // Calculate business days requested
  const days = calcBusinessDays(start_date, end_date)
  const hoursRequested = days * 8

  // Check balance for annual leave
  if (type === 'annual') {
    const user = await c.env.DB.prepare(
      'SELECT pto_balance FROM users WHERE id = ?'
    ).bind(userId).first<{ pto_balance: number }>()

    if ((user?.pto_balance ?? 0) < hoursRequested) {
      return c.json({
        error: `Baki cuti tahunan tidak mencukupi. Diperlukan: ${hoursRequested}j, Ada: ${user?.pto_balance ?? 0}j`,
      }, 400)
    }
  }

  // Check for overlapping approved/pending requests
  const overlap = await c.env.DB.prepare(
    `SELECT id FROM pto_requests
     WHERE user_id = ? AND status != 'rejected'
       AND NOT (end_date < ? OR start_date > ?)`
  ).bind(userId, start_date, end_date).first()

  if (overlap) {
    return c.json({ error: 'Permohonan cuti bertindih dengan cuti sedia ada' }, 409)
  }

  await c.env.DB.prepare(
    `INSERT INTO pto_requests (user_id, type, start_date, end_date, days_requested, hours_deducted, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(userId, type, start_date, end_date, days, hoursRequested, reason ?? null).run()

  // Notify manager
  const manager = await c.env.DB.prepare(
    'SELECT manager_id FROM users WHERE id = ?'
  ).bind(userId).first<{ manager_id: string | null }>()

  if (manager?.manager_id) {
    const emp = await c.env.DB.prepare(
      'SELECT name, employee_id FROM users WHERE id = ?'
    ).bind(userId).first<{ name: string; employee_id: string }>()

    await c.env.DB.prepare(
      `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'pto_submitted', ?, ?)`
    ).bind(
      manager.manager_id,
      'Permohonan Cuti Baharu',
      `${emp?.name} memohon cuti ${type} dari ${start_date} hingga ${end_date} (${days} hari).`
    ).run()
  }

  return c.json({ success: true, days_requested: days, hours_deducted: hoursRequested }, 201)
})

// POST /api/pto/:id/approve — manager/admin approves
pto.post('/:id/approve', managerOrAdmin, async (c) => {
  const reviewerId = c.get('userId')
  const id = c.req.param('id')
  const { notes } = await c.req.json<{ notes?: string }>().catch(() => ({ notes: undefined }))

  const req = await c.env.DB.prepare('SELECT * FROM pto_requests WHERE id = ?').bind(id).first<PTORequest>()
  if (!req) return c.json({ error: 'Permohonan tidak dijumpai' }, 404)
  if (req.status !== 'pending') return c.json({ error: 'Hanya permohonan pending boleh diluluskan' }, 400)

  const now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    `UPDATE pto_requests SET status='approved', reviewed_by=?, reviewed_at=?, review_notes=? WHERE id=?`
  ).bind(reviewerId, now, notes ?? null, id).run()

  // Deduct PTO balance for annual leave
  if (req.type === 'annual') {
    await c.env.DB.prepare(
      'UPDATE users SET pto_balance = MAX(0, pto_balance - ?) WHERE id = ?'
    ).bind(req.hours_deducted, req.user_id).run()
  }

  await c.env.DB.prepare(
    `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'pto_reviewed', ?, ?)`
  ).bind(
    req.user_id,
    'Permohonan Cuti Diluluskan ✅',
    `Permohonan cuti ${req.type} anda dari ${req.start_date} hingga ${req.end_date} telah diluluskan.`
  ).run()

  return c.json({ success: true, message: 'Permohonan cuti diluluskan' })
})

// POST /api/pto/:id/reject — manager/admin rejects
pto.post('/:id/reject', managerOrAdmin, async (c) => {
  const reviewerId = c.get('userId')
  const id = c.req.param('id')
  const { notes } = await c.req.json<{ notes?: string }>().catch(() => ({ notes: undefined }))

  const req = await c.env.DB.prepare('SELECT * FROM pto_requests WHERE id = ?').bind(id).first<PTORequest>()
  if (!req) return c.json({ error: 'Permohonan tidak dijumpai' }, 404)
  if (req.status !== 'pending') return c.json({ error: 'Hanya permohonan pending boleh ditolak' }, 400)

  const now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    `UPDATE pto_requests SET status='rejected', reviewed_by=?, reviewed_at=?, review_notes=? WHERE id=?`
  ).bind(reviewerId, now, notes ?? null, id).run()

  await c.env.DB.prepare(
    `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'pto_reviewed', ?, ?)`
  ).bind(
    req.user_id,
    'Permohonan Cuti Ditolak ❌',
    `Permohonan cuti ${req.type} anda dari ${req.start_date} hingga ${req.end_date} telah ditolak.${notes ? ` Nota: ${notes}` : ''}`
  ).run()

  return c.json({ success: true, message: 'Permohonan cuti ditolak' })
})

// GET /api/pto/pending — manager/admin: list pending requests
pto.get('/pending', managerOrAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, u.name, u.employee_id, u.department, u.pto_balance
     FROM pto_requests p JOIN users u ON p.user_id = u.id
     WHERE p.status = 'pending'
     ORDER BY p.created_at ASC`
  ).all()

  return c.json(results ?? [])
})

// GET /api/pto/all — admin: list all requests with optional filters
pto.get('/all', managerOrAdmin, async (c) => {
  const status = c.req.query('status')
  const query = status
    ? `SELECT p.*, u.name, u.employee_id, u.department FROM pto_requests p JOIN users u ON p.user_id = u.id WHERE p.status = ? ORDER BY p.created_at DESC`
    : `SELECT p.*, u.name, u.employee_id, u.department FROM pto_requests p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`

  const { results } = status
    ? await c.env.DB.prepare(query).bind(status).all()
    : await c.env.DB.prepare(query).all()

  return c.json(results ?? [])
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcBusinessDays(start: string, end: string): number {
  let count = 0
  const startDate = new Date(start)
  const endDate = new Date(end)
  const current = new Date(startDate)

  while (current <= endDate) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++ // skip Saturday & Sunday
    current.setDate(current.getDate() + 1)
  }

  return count
}

export default pto
