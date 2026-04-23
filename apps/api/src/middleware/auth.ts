import { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import type { Bindings, Variables } from '../types'

export const authMiddleware = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = auth.slice(7)
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
    c.set('userId', payload.sub as string)
    c.set('userRole', payload.role as string)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}

export const adminOnly = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) => {
  if (c.get('userRole') !== 'admin') {
    return c.json({ error: 'Forbidden: admin only' }, 403)
  }
  await next()
}

// Allows both manager and admin
export const managerOrAdmin = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) => {
  const role = c.get('userRole')
  if (role !== 'manager' && role !== 'admin') {
    return c.json({ error: 'Forbidden: manager or admin only' }, 403)
  }
  await next()
}
