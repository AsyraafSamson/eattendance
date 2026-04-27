import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { getDistanceMeters } from '../lib/geo'
import type { Bindings, Variables, User } from '../types'
import { getAppSettings } from '../lib/settings'

const googleAuth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

// GET /api/auth/google/login-start  — for /login page (all roles)
googleAuth.get('/login-start', async (c) => {
  const state = await sign(
    { purpose: 'login', ts: Date.now() },
    c.env.JWT_SECRET
  )
  const redirectUri = new URL(c.req.url).origin + '/api/auth/google/callback'
  const params = new URLSearchParams({
    client_id:     c.env.GOOGLE_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile',
    state,
    prompt:        'select_account',
  })
  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
})

// GET /api/auth/google/start?type=check-in&lat=1.23&lng=103.45  — for attend/QR check-in
googleAuth.get('/start', async (c) => {
  const type = c.req.query('type') as 'check-in' | 'check-out' | undefined
  const lat  = c.req.query('lat')
  const lng  = c.req.query('lng')

  if (!type || !['check-in', 'check-out'].includes(type)) {
    return c.text('Invalid type parameter', 400)
  }

  const state = await sign(
    { purpose: 'attend', type, lat: lat ?? null, lng: lng ?? null, ts: Date.now() },
    c.env.JWT_SECRET
  )

  const redirectUri = new URL(c.req.url).origin + '/api/auth/google/callback'
  const params = new URLSearchParams({
    client_id:     c.env.GOOGLE_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile',
    state,
    prompt:        'select_account',
  })

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
})

// GET /api/auth/google/callback
googleAuth.get('/callback', async (c) => {
  const code  = c.req.query('code')
  const state = c.req.query('state')
  const oauthError = c.req.query('error')
  const settings = await getAppSettings(c.env.DB)
  const frontendUrl = settings.frontendUrl

  if (oauthError || !code || !state) {
    return c.redirect(`${frontendUrl}/login?google_error=cancelled`)
  }

  // Verify signed state
  let stateData: { purpose?: string; type?: string; lat?: string | null; lng?: string | null; ts: number }
  try {
    stateData = await verify(state, c.env.JWT_SECRET, 'HS256') as typeof stateData
  } catch {
    return c.redirect(`${frontendUrl}/login?google_error=invalid_state`)
  }

  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    return c.redirect(`${frontendUrl}/login?google_error=expired`)
  }

  const redirectBase = stateData.purpose === 'login' ? `${frontendUrl}/login` : `${frontendUrl}/attend`
  const redirectError = (reason: string, extra = '') =>
    c.redirect(`${redirectBase}?google_error=${reason}${extra}`)

  // Exchange code for Google tokens
  const redirectUri = new URL(c.req.url).origin + '/api/auth/google/callback'
  let googleEmail: string
  let googleName: string
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
    if (!tokenData.access_token) throw new Error(tokenData.error || 'No access token')

    const userRes  = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userInfo = await userRes.json() as { email?: string; name?: string }
    if (!userInfo.email) throw new Error('No email from Google')
    googleEmail = userInfo.email
    googleName  = userInfo.name ?? userInfo.email
  } catch {
    return redirectError('google_failed')
  }

  // Look up user by Google email
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND is_active = 1'
  ).bind(googleEmail).first<User>()

  if (!user) {
    return redirectError('not_registered', `&email=${encodeURIComponent(googleEmail)}`)
  }

  // ── LOGIN flow ────────────────────────────────────────────────────────────
  if (stateData.purpose === 'login') {
    const token = await sign(
      { sub: user.id, role: user.role, name: user.name, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
      c.env.JWT_SECRET,
      'HS256'
    )
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id, employee_id: user.employee_id, name: user.name, email: user.email, role: user.role,
    }))
    return c.redirect(`${frontendUrl}/login?google_token=${token}&google_user=${userData}`)
  }

  // ── ATTEND flow ───────────────────────────────────────────────────────────
  const devMode = c.env.DEV_MODE === 'true'
  if (!devMode && stateData.lat && stateData.lng) {
    const lat      = parseFloat(stateData.lat)
    const lng      = parseFloat(stateData.lng)
    const distance  = getDistanceMeters(lat, lng, settings.officeLat, settings.officeLng)
    if (distance > settings.officeRadiusMeters) {
      return c.redirect(
        `${frontendUrl}/attend?google_error=out_of_range&distance=${Math.round(distance)}&radius=${settings.officeRadiusMeters}`
      )
    }
  }

  const { type } = stateData

  // Duplicate punch prevention
  const todayMY = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
  const lastRecord = await c.env.DB.prepare(
    `SELECT type FROM attendance
     WHERE user_id = ? AND date(timestamp, '+8 hours') = ?
     ORDER BY timestamp DESC LIMIT 1`
  ).bind(user.id, todayMY).first<{ type: string }>()

  if (lastRecord?.type === type) {
    const msg = type === 'check-in' ? 'already_checked_in' : 'already_checked_out'
    return c.redirect(`${frontendUrl}/attend?google_error=${msg}&name=${encodeURIComponent(user.name)}`)
  }

  // Record attendance
  const lat = stateData.lat ? parseFloat(stateData.lat) : null
  const lng = stateData.lng ? parseFloat(stateData.lng) : null
  await c.env.DB.prepare(
    'INSERT INTO attendance (user_id, type, source, lat, lng) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, type, 'google', lat, lng).run()

  // Fetch today records for the success screen
  const todayRecords = await c.env.DB.prepare(
    `SELECT type, timestamp FROM attendance
     WHERE user_id = ? AND date(timestamp, '+8 hours') = ?
     ORDER BY timestamp ASC`
  ).bind(user.id, todayMY).all<{ type: string; timestamp: string }>()

  const encoded = encodeURIComponent(JSON.stringify({
    name:  user.name,
    type,
    records: todayRecords.results ?? [],
  }))

  return c.redirect(`${frontendUrl}/attend?google_ok=${encoded}`)
})

export default googleAuth
