import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'
import { authMiddleware, managerOrAdmin } from '../middleware/auth'

const manager = new Hono<{ Bindings: Bindings; Variables: Variables }>()

manager.use('*', authMiddleware, managerOrAdmin)

// GET /api/manager/team — list employees under this manager (or all for admin)
manager.get('/team', async (c) => {
  const userId = c.get('userId')
  const role = c.get('userRole')

  const query = role === 'admin'
    ? `SELECT id, employee_id, name, email, role, department, pto_balance, is_active, created_at
       FROM users WHERE role != 'admin' ORDER BY name ASC`
    : `SELECT id, employee_id, name, email, role, department, pto_balance, is_active, created_at
       FROM users WHERE manager_id = ? ORDER BY name ASC`

  const { results } = role === 'admin'
    ? await c.env.DB.prepare(query).all()
    : await c.env.DB.prepare(query).bind(userId).all()

  return c.json(results ?? [])
})

// GET /api/manager/attendance?date=YYYY-MM-DD — team attendance for a given day
manager.get('/attendance', async (c) => {
  const userId = c.get('userId')
  const role = c.get('userRole')
  const dateMY = c.req.query('date') ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]

  const teamQuery = role === 'admin'
    ? `SELECT id FROM users WHERE role != 'admin' AND is_active = 1`
    : `SELECT id FROM users WHERE manager_id = ? AND is_active = 1`

  const { results: teamMembers } = role === 'admin'
    ? await c.env.DB.prepare(teamQuery).all<{ id: string }>()
    : await c.env.DB.prepare(teamQuery).bind(userId).all<{ id: string }>()

  if (!teamMembers?.length) return c.json([])

  // Build the attendance overview for each team member
  const { results } = await c.env.DB.prepare(
    `SELECT
       u.id, u.employee_id, u.name, u.department,
       MIN(CASE WHEN a.type = 'check-in'  THEN a.timestamp END) as check_in,
       MAX(CASE WHEN a.type = 'check-out' THEN a.timestamp END) as check_out,
       COUNT(DISTINCT a.id) as punch_count
     FROM users u
     LEFT JOIN attendance a ON a.user_id = u.id
       AND date(a.timestamp, '+8 hours') = ?
     WHERE u.id IN (${teamMembers.map(() => '?').join(',')})
     GROUP BY u.id, u.employee_id, u.name, u.department
     ORDER BY u.name ASC`
  ).bind(dateMY, ...teamMembers.map(m => m.id)).all()

  return c.json(results ?? [])
})

// GET /api/manager/timesheets/pending — list submitted timesheets for approval
manager.get('/timesheets/pending', async (c) => {
  const userId = c.get('userId')
  const role = c.get('userRole')

  const query = role === 'admin'
    ? `SELECT t.*, u.name, u.employee_id, u.department
       FROM timesheets t JOIN users u ON t.user_id = u.id
       WHERE t.status = 'submitted'
       ORDER BY t.submitted_at ASC`
    : `SELECT t.*, u.name, u.employee_id, u.department
       FROM timesheets t JOIN users u ON t.user_id = u.id
       WHERE t.status = 'submitted' AND u.manager_id = ?
       ORDER BY t.submitted_at ASC`

  const { results } = role === 'admin'
    ? await c.env.DB.prepare(query).all()
    : await c.env.DB.prepare(query).bind(userId).all()

  return c.json(results ?? [])
})

// GET /api/manager/pto/pending — list pending PTO requests for approval
manager.get('/pto/pending', async (c) => {
  const userId = c.get('userId')
  const role = c.get('userRole')

  const query = role === 'admin'
    ? `SELECT p.*, u.name, u.employee_id, u.department, u.pto_balance
       FROM pto_requests p JOIN users u ON p.user_id = u.id
       WHERE p.status = 'pending'
       ORDER BY p.created_at ASC`
    : `SELECT p.*, u.name, u.employee_id, u.department, u.pto_balance
       FROM pto_requests p JOIN users u ON p.user_id = u.id
       WHERE p.status = 'pending' AND u.manager_id = ?
       ORDER BY p.created_at ASC`

  const { results } = role === 'admin'
    ? await c.env.DB.prepare(query).all()
    : await c.env.DB.prepare(query).bind(userId).all()

  return c.json(results ?? [])
})

export default manager
