import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'

// Mock bcryptjs so tests don't pay the hashing cost
vi.mock('bcryptjs', () => ({
  default: {
    compare: async (plain: string, hash: string) => plain === hash,
    hash: async (plain: string, _rounds: number) => plain,
  },
}))

// Bypass rate limiting in auth route tests
vi.mock('../middleware/rate-limit', () => ({
  loginRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
  recordFailedLogin: async () => {},
  clearLoginAttempts: async () => {},
}))

const activeUser = {
  id: 'user-1',
  employee_id: 'EMP001',
  name: 'Test User',
  email: 'test@example.com',
  password_hash: 'password123',
  role: 'employee',
  is_active: 1,
  department: null,
  manager_id: null,
  pto_balance: 80,
  created_at: '2024-01-01T00:00:00.000Z',
}

function makeDb(user: typeof activeUser | null) {
  return {
    prepare: (_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => user,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
    }),
  } as unknown as D1Database
}

const baseEnv: Omit<Bindings, 'DB'> = {
  JWT_SECRET: 'test-secret',
  DEV_MODE: 'true',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
}

async function makeAuthApp(db: D1Database) {
  const { default: authRoute } = await import('../routes/auth')
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  app.route('/api/auth', authRoute)
  return app
}

describe('POST /api/auth/login', () => {
  it('returns 200 and sets auth cookie on valid credentials', async () => {
    const app = await makeAuthApp(makeDb(activeUser))
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    }, { ...baseEnv, DB: makeDb(activeUser) })

    expect(res.status).toBe(200)

    const cookie = res.headers.get('Set-Cookie')
    expect(cookie).toContain('auth_token=')
    expect(cookie).toContain('HttpOnly')

    const body = await res.json() as { user: { email: string; role: string } }
    expect(body.user.email).toBe('test@example.com')
    expect(body.user.role).toBe('employee')
    expect(body).not.toHaveProperty('token')
  })

  it('returns 401 on wrong password', async () => {
    const app = await makeAuthApp(makeDb(activeUser))
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrongpassword' }),
    }, { ...baseEnv, DB: makeDb(activeUser) })

    expect(res.status).toBe(401)
  })

  it('returns 401 when user not found', async () => {
    const app = await makeAuthApp(makeDb(null))
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'anypassword' }),
    }, { ...baseEnv, DB: makeDb(null) })

    expect(res.status).toBe(401)
  })

  it('returns 400 when fields are missing', async () => {
    const app = await makeAuthApp(makeDb(null))
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    }, { ...baseEnv, DB: makeDb(null) })

    expect(res.status).toBe(400)
  })

  it('does not expose JWT in response body', async () => {
    const app = await makeAuthApp(makeDb(activeUser))
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    }, { ...baseEnv, DB: makeDb(activeUser) })

    const body = await res.json() as Record<string, unknown>
    expect(body).not.toHaveProperty('token')
    expect(JSON.stringify(body)).not.toMatch(/eyJ/)
  })
})

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears the auth cookie', async () => {
    const app = await makeAuthApp(makeDb(null))
    const res = await app.request('/api/auth/logout', {
      method: 'POST',
    }, { ...baseEnv, DB: makeDb(null) })

    expect(res.status).toBe(200)
    const cookie = res.headers.get('Set-Cookie')
    expect(cookie).toContain('auth_token=')
    expect(cookie).toContain('Max-Age=0')
  })
})
