import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'

function makeDb(attemptCount: number) {
  return {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => ({ count: attemptCount }),
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

describe('loginRateLimit', () => {
  it('allows request when under attempt limit', async () => {
    const { loginRateLimit } = await import('../middleware/rate-limit')
    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
    app.post('/login', loginRateLimit, (c) => c.json({ ok: true }))

    const res = await app.request('/login', { method: 'POST' }, {
      ...baseEnv,
      DB: makeDb(3),
    })
    expect(res.status).toBe(200)
  })

  it('blocks request at exactly the limit', async () => {
    const { loginRateLimit } = await import('../middleware/rate-limit')
    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
    app.post('/login', loginRateLimit, (c) => c.json({ ok: true }))

    const res = await app.request('/login', { method: 'POST' }, {
      ...baseEnv,
      DB: makeDb(5),
    })
    expect(res.status).toBe(429)
  })

  it('blocks request above the limit', async () => {
    const { loginRateLimit } = await import('../middleware/rate-limit')
    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
    app.post('/login', loginRateLimit, (c) => c.json({ ok: true }))

    const res = await app.request('/login', { method: 'POST' }, {
      ...baseEnv,
      DB: makeDb(10),
    })
    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('15 minit')
  })

  it('fails open when DB query throws (table missing)', async () => {
    const { loginRateLimit } = await import('../middleware/rate-limit')
    const brokenDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => { throw new Error('no such table: login_attempts') },
        }),
      }),
    } as unknown as D1Database

    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
    app.post('/login', loginRateLimit, (c) => c.json({ ok: true }))

    const res = await app.request('/login', { method: 'POST' }, { ...baseEnv, DB: brokenDb })
    expect(res.status).toBe(200)
  })
})
