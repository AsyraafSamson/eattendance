import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import type { Bindings, Variables } from '../types'

const JWT_SECRET = 'test-secret'

const mockEnv: Bindings = {
  DB: {} as D1Database,
  JWT_SECRET,
  DEV_MODE: 'true',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
}

async function makeToken(payload: Record<string, unknown>) {
  return sign({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET, 'HS256')
}

function makeApp() {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  return app
}

describe('authMiddleware', () => {
  it('passes with valid Bearer token', async () => {
    const { authMiddleware } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.get('/test', (c) => c.json({ userId: c.get('userId'), role: c.get('userRole') }))

    const token = await makeToken({ sub: 'user-1', role: 'employee' })
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    }, mockEnv)

    expect(res.status).toBe(200)
    const body = await res.json() as { userId: string; role: string }
    expect(body.userId).toBe('user-1')
    expect(body.role).toBe('employee')
  })

  it('passes with valid cookie', async () => {
    const { authMiddleware } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.get('/test', (c) => c.json({ userId: c.get('userId'), role: c.get('userRole') }))

    const token = await makeToken({ sub: 'user-2', role: 'manager' })
    const res = await app.request('/test', {
      headers: { Cookie: `auth_token=${token}` },
    }, mockEnv)

    expect(res.status).toBe(200)
    const body = await res.json() as { userId: string; role: string }
    expect(body.userId).toBe('user-2')
    expect(body.role).toBe('manager')
  })

  it('returns 401 when no token provided', async () => {
    const { authMiddleware } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.get('/test', (c) => c.json({ ok: true }))

    const res = await app.request('/test', {}, mockEnv)
    expect(res.status).toBe(401)
  })

  it('returns 401 for invalid token', async () => {
    const { authMiddleware } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.get('/test', (c) => c.json({ ok: true }))

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    }, mockEnv)
    expect(res.status).toBe(401)
  })

  it('prefers cookie over Bearer header', async () => {
    const { authMiddleware } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.get('/test', (c) => c.json({ userId: c.get('userId') }))

    const cookieToken = await makeToken({ sub: 'cookie-user', role: 'employee' })
    const bearerToken = await makeToken({ sub: 'bearer-user', role: 'employee' })

    const res = await app.request('/test', {
      headers: {
        Cookie: `auth_token=${cookieToken}`,
        Authorization: `Bearer ${bearerToken}`,
      },
    }, mockEnv)

    expect(res.status).toBe(200)
    const body = await res.json() as { userId: string }
    expect(body.userId).toBe('cookie-user')
  })
})

describe('adminOnly', () => {
  it('allows admin role', async () => {
    const { authMiddleware, adminOnly } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.use('*', adminOnly)
    app.get('/test', (c) => c.json({ ok: true }))

    const token = await makeToken({ sub: 'admin-1', role: 'admin' })
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    }, mockEnv)
    expect(res.status).toBe(200)
  })

  it('blocks employee role with 403', async () => {
    const { authMiddleware, adminOnly } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.use('*', adminOnly)
    app.get('/test', (c) => c.json({ ok: true }))

    const token = await makeToken({ sub: 'emp-1', role: 'employee' })
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    }, mockEnv)
    expect(res.status).toBe(403)
  })

  it('blocks manager role with 403', async () => {
    const { authMiddleware, adminOnly } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.use('*', adminOnly)
    app.get('/test', (c) => c.json({ ok: true }))

    const token = await makeToken({ sub: 'mgr-1', role: 'manager' })
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    }, mockEnv)
    expect(res.status).toBe(403)
  })
})

describe('managerOrAdmin', () => {
  it('allows manager role', async () => {
    const { authMiddleware, managerOrAdmin } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.use('*', managerOrAdmin)
    app.get('/test', (c) => c.json({ ok: true }))

    const token = await makeToken({ sub: 'mgr-1', role: 'manager' })
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    }, mockEnv)
    expect(res.status).toBe(200)
  })

  it('allows admin role', async () => {
    const { authMiddleware, managerOrAdmin } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.use('*', managerOrAdmin)
    app.get('/test', (c) => c.json({ ok: true }))

    const token = await makeToken({ sub: 'admin-1', role: 'admin' })
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    }, mockEnv)
    expect(res.status).toBe(200)
  })

  it('blocks employee role with 403', async () => {
    const { authMiddleware, managerOrAdmin } = await import('../middleware/auth')
    const app = makeApp()
    app.use('*', authMiddleware)
    app.use('*', managerOrAdmin)
    app.get('/test', (c) => c.json({ ok: true }))

    const token = await makeToken({ sub: 'emp-1', role: 'employee' })
    const res = await app.request('/test', {
      headers: { Authorization: `Bearer ${token}` },
    }, mockEnv)
    expect(res.status).toBe(403)
  })
})
