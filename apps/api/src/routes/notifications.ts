import { Hono } from 'hono'
import type { Bindings, Variables, Notification } from '../types'
import { authMiddleware } from '../middleware/auth'

const notifications = new Hono<{ Bindings: Bindings; Variables: Variables }>()

notifications.use('*', authMiddleware)

// GET /api/notifications — list notifications for current user
notifications.get('/', async (c) => {
  const userId = c.get('userId')
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)
  const unreadOnly = c.req.query('unread') === 'true'

  const query = unreadOnly
    ? `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`

  const { results } = await c.env.DB.prepare(query).bind(userId, limit).all<Notification>()

  const unreadCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).bind(userId).first<{ count: number }>()

  return c.json({ notifications: results ?? [], unread_count: unreadCount?.count ?? 0 })
})

// PATCH /api/notifications/:id/read — mark one as read
notifications.patch('/:id/read', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run()

  return c.json({ success: true })
})

// PATCH /api/notifications/read-all — mark all as read
notifications.patch('/read-all', async (c) => {
  const userId = c.get('userId')

  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?'
  ).bind(userId).run()

  return c.json({ success: true })
})

export default notifications
