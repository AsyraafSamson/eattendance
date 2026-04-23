import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings, Variables } from './types'
import auth from './routes/auth'
import attendance from './routes/attendance'
import attend from './routes/attend'
import users from './routes/users'
import breaks from './routes/breaks'
import timesheets from './routes/timesheets'
import pto from './routes/pto'
import notifications from './routes/notifications'
import reports from './routes/reports'
import manager from './routes/manager'
import googleAuth from './routes/google-auth'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://eattendance.pages.dev'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check + DB connection test
app.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM users'
  ).first<{ total: number }>()

  return c.json({
    status: 'ok',
    db: 'connected',
    users: result?.total ?? 0,
    office: c.env.OFFICE_NAME,
    devMode: c.env.DEV_MODE === 'true',
  })
})

app.route('/api/auth', auth)
app.route('/api/attendance', attendance)
app.route('/api/attend', attend)
app.route('/api/users', users)
app.route('/api/breaks', breaks)
app.route('/api/timesheets', timesheets)
app.route('/api/pto', pto)
app.route('/api/notifications', notifications)
app.route('/api/reports', reports)
app.route('/api/manager', manager)
app.route('/api/auth/google', googleAuth)

app.notFound((c) => c.json({ error: 'Route not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
