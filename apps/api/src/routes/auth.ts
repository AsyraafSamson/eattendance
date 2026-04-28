import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import bcrypt from 'bcryptjs'
import { sign } from 'hono/jwt'
import type { Bindings, Variables, User } from '../types'
import { authMiddleware, adminOnly } from '../middleware/auth'
import { loginRateLimit, recordFailedLogin, clearLoginAttempts } from '../middleware/rate-limit'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

function setAuthCookie(c: { env: Bindings; header: (name: string, value: string) => void }, token: string) {
  const isDevMode = c.env.DEV_MODE === 'true'
  // SameSite=None; Secure required for cross-site cookies (Workers ↔ Pages on different domains)
  // SameSite=Lax used in dev mode (localhost, no HTTPS)
  const cookieValue = [
    `auth_token=${token}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${60 * 60 * 24}`,
    isDevMode ? 'SameSite=Lax' : 'SameSite=None; Secure',
  ].join('; ')
  c.header('Set-Cookie', cookieValue)
}

// POST /api/auth/login
auth.post('/login', loginRateLimit, async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'

  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400)
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND is_active = 1'
  ).bind(email).first<User>()

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    await recordFailedLogin(c.env.DB, ip)
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = await sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    },
    c.env.JWT_SECRET,
    'HS256'
  )

  await clearLoginAttempts(c.env.DB, ip)
  setAuthCookie(c, token)

  return c.json({
    user: {
      id: user.id,
      employee_id: user.employee_id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  })
})

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  const isDevMode = c.env.DEV_MODE === 'true'
  const cookieValue = [
    'auth_token=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    isDevMode ? 'SameSite=Lax' : 'SameSite=None; Secure',
  ].join('; ')
  c.header('Set-Cookie', cookieValue)
  return c.json({ success: true })
})

// POST /api/auth/register (admin only)
auth.post('/register', authMiddleware, adminOnly, async (c) => {
  const { employee_id, name, email, password, role } =
    await c.req.json<{
      employee_id: string
      name: string
      email: string
      password: string
      role?: string
    }>()

  if (!employee_id || !name || !email || !password) {
    return c.json({ error: 'All fields required' }, 400)
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ? OR employee_id = ?'
  ).bind(email, employee_id).first()

  if (existing) {
    return c.json({ error: 'Email or Employee ID already exists' }, 409)
  }

  const password_hash = await bcrypt.hash(password, 10)

  await c.env.DB.prepare(
    'INSERT INTO users (employee_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).bind(employee_id, name, email, password_hash, role ?? 'employee').run()

  return c.json({ success: true, message: 'User registered successfully' }, 201)
})

// GET /api/auth/me
auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')

  const user = await c.env.DB.prepare(
    'SELECT id, employee_id, name, email, role, created_at FROM users WHERE id = ?'
  ).bind(userId).first<Omit<User, 'password_hash' | 'is_active'>>()

  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json(user)
})

export default auth
