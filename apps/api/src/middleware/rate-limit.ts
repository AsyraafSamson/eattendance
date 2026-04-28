import { Context, Next } from 'hono'
import type { Bindings, Variables } from '../types'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

export const loginRateLimit = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()

  try {
    const result = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND attempted_at > ?'
    ).bind(ip, windowStart).first<{ count: number }>()

    if ((result?.count ?? 0) >= MAX_ATTEMPTS) {
      return c.json(
        { error: 'Terlalu banyak percubaan log masuk. Sila cuba lagi dalam 15 minit.' },
        429
      )
    }
  } catch {
    // Table may not exist in older deployments — fail open
  }

  await next()
}

export async function recordFailedLogin(db: D1Database, ip: string): Promise<void> {
  try {
    await db.prepare('INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)')
      .bind(ip, new Date().toISOString()).run()
  } catch {
    // Ignore — non-critical
  }
}

export async function clearLoginAttempts(db: D1Database, ip: string): Promise<void> {
  try {
    await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run()
  } catch {
    // Ignore — non-critical
  }
}
