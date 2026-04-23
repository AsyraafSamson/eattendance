import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { Bindings, Variables, User } from '../types'
import { authMiddleware, adminOnly } from '../middleware/auth'

const users = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// All routes require admin
users.use('*', authMiddleware, adminOnly)

// GET /api/users — list all users
users.get('/', async (c) => {
  const list = await c.env.DB.prepare(`
    SELECT u.id, u.employee_id, u.name, u.email, u.role, u.department,
           u.manager_id, u.pto_balance, u.is_active, u.created_at,
           m.name AS manager_name
    FROM users u
    LEFT JOIN users m ON u.manager_id = m.id
    ORDER BY u.role, u.name
  `).all()

  return c.json(list.results ?? [])
})

// POST /api/users — create new user
users.post('/', async (c) => {
  const { employee_id, name, email, password, role, department, manager_id, pto_balance } =
    await c.req.json<{
      employee_id: string; name: string; email: string; password: string
      role?: string; department?: string; manager_id?: string; pto_balance?: number
    }>()

  if (!employee_id || !name || !email || !password) {
    return c.json({ error: 'Semua medan diperlukan' }, 400)
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ? OR employee_id = ?'
  ).bind(email, employee_id).first()

  if (existing) {
    return c.json({ error: 'Email atau ID Pekerja sudah wujud' }, 409)
  }

  const password_hash = await bcrypt.hash(password, 10)

  await c.env.DB.prepare(
    'INSERT INTO users (employee_id, name, email, password_hash, role, department, manager_id, pto_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(employee_id, name, email, password_hash, role ?? 'employee', department ?? null, manager_id ?? null, pto_balance ?? 0).run()

  return c.json({ success: true }, 201)
})

// PATCH /api/users/:id — edit user details
users.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const { name, email, employee_id, role, department, manager_id, pto_balance } =
    await c.req.json<{
      name?: string; email?: string; employee_id?: string; role?: string
      department?: string; manager_id?: string | null; pto_balance?: number
    }>()

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
  if (!user) return c.json({ error: 'Pengguna tidak dijumpai' }, 404)

  // Check email/employee_id uniqueness (excluding self)
  if (email || employee_id) {
    const conflict = await c.env.DB.prepare(
      'SELECT id FROM users WHERE (email = ? OR employee_id = ?) AND id != ?'
    ).bind(email ?? '', employee_id ?? '', id).first()
    if (conflict) return c.json({ error: 'Email atau ID Pekerja sudah digunakan' }, 409)
  }

  await c.env.DB.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      employee_id = COALESCE(?, employee_id),
      role = COALESCE(?, role),
      department = COALESCE(?, department),
      manager_id = ?,
      pto_balance = COALESCE(?, pto_balance)
    WHERE id = ?
  `).bind(name ?? null, email ?? null, employee_id ?? null, role ?? null,
          department ?? null, manager_id ?? null, pto_balance ?? null, id).run()

  return c.json({ success: true })
})

// PATCH /api/users/:id/toggle — toggle is_active
users.patch('/:id/toggle', async (c) => {
  const id = c.req.param('id')
  const currentUser = c.get('userId')

  if (id === currentUser) {
    return c.json({ error: 'Tidak boleh disable akaun sendiri' }, 400)
  }

  const user = await c.env.DB.prepare('SELECT is_active FROM users WHERE id = ?').bind(id).first<{ is_active: number }>()
  if (!user) return c.json({ error: 'Pengguna tidak dijumpai' }, 404)

  await c.env.DB.prepare('UPDATE users SET is_active = ? WHERE id = ?')
    .bind(user.is_active ? 0 : 1, id).run()

  return c.json({ success: true, is_active: !user.is_active })
})

// DELETE /api/users/:id — delete user
users.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const currentUser = c.get('userId')

  if (id === currentUser) {
    return c.json({ error: 'Tidak boleh delete akaun sendiri' }, 400)
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// PATCH /api/users/:id/password — reset password
users.patch('/:id/password', async (c) => {
  const id = c.req.param('id')
  const { password } = await c.req.json<{ password: string }>()

  if (!password || password.length < 6) {
    return c.json({ error: 'Password minimum 6 aksara' }, 400)
  }

  const password_hash = await bcrypt.hash(password, 10)
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(password_hash, id).run()

  return c.json({ success: true })
})

export default users
