import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'
import { authMiddleware, adminOnly } from '../middleware/auth'

const reports = new Hono<{ Bindings: Bindings; Variables: Variables }>()

reports.use('*', authMiddleware, adminOnly)

type ReportRow = {
  user_id: string
  employee_id: string
  name: string
  department: string | null
  regular_hours: number
  overtime_hours: number
  break_hours: number
  total_hours: number
  pto_hours: number
  approved_timesheets: number
}

// GET /api/reports/payroll?period_start=&period_end=
reports.get('/payroll', async (c) => {
  const periodStart = c.req.query('period_start')
  const periodEnd = c.req.query('period_end')

  if (!periodStart || !periodEnd) {
    return c.json({ error: 'period_start and period_end required (YYYY-MM-DD)' }, 400)
  }

  // Aggregate approved timesheets in period
  const { results: tsRows } = await c.env.DB.prepare(
    `SELECT
       u.id as user_id, u.employee_id, u.name, u.department,
       COALESCE(SUM(t.regular_hours), 0) as regular_hours,
       COALESCE(SUM(t.overtime_hours), 0) as overtime_hours,
       COALESCE(SUM(t.break_hours), 0) as break_hours,
       COALESCE(SUM(t.total_hours), 0) as total_hours,
       COUNT(t.id) as approved_timesheets
     FROM users u
     LEFT JOIN timesheets t ON t.user_id = u.id
       AND t.status = 'approved'
       AND t.period_start >= ?
       AND t.period_end <= ?
     WHERE u.is_active = 1 AND u.role != 'admin'
     GROUP BY u.id, u.employee_id, u.name, u.department
     ORDER BY u.name ASC`
  ).bind(periodStart, periodEnd).all<Omit<ReportRow, 'pto_hours'>>()

  // Fetch approved PTO hours in period per employee
  const { results: ptoRows } = await c.env.DB.prepare(
    `SELECT user_id, SUM(hours_deducted) as pto_hours
     FROM pto_requests
     WHERE status = 'approved'
       AND start_date >= ?
       AND end_date <= ?
     GROUP BY user_id`
  ).bind(periodStart, periodEnd).all<{ user_id: string; pto_hours: number }>()

  const ptoMap: Record<string, number> = {}
  for (const row of ptoRows ?? []) {
    ptoMap[row.user_id] = row.pto_hours
  }

  const report: ReportRow[] = (tsRows ?? []).map(r => ({
    ...r,
    pto_hours: ptoMap[r.user_id] ?? 0,
  }))

  return c.json({
    period_start: periodStart,
    period_end: periodEnd,
    generated_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    employees: report,
    totals: {
      regular_hours: round2(report.reduce((s, r) => s + r.regular_hours, 0)),
      overtime_hours: round2(report.reduce((s, r) => s + r.overtime_hours, 0)),
      break_hours: round2(report.reduce((s, r) => s + r.break_hours, 0)),
      pto_hours: round2(report.reduce((s, r) => s + r.pto_hours, 0)),
    },
  })
})

// GET /api/reports/payroll/csv?period_start=&period_end=
reports.get('/payroll/csv', async (c) => {
  const periodStart = c.req.query('period_start')
  const periodEnd = c.req.query('period_end')

  if (!periodStart || !periodEnd) {
    return c.text('period_start and period_end required', 400)
  }

  // Reuse same query as JSON endpoint
  const { results: tsRows } = await c.env.DB.prepare(
    `SELECT
       u.id as user_id, u.employee_id, u.name, u.department,
       COALESCE(SUM(t.regular_hours), 0) as regular_hours,
       COALESCE(SUM(t.overtime_hours), 0) as overtime_hours,
       COALESCE(SUM(t.break_hours), 0) as break_hours,
       COALESCE(SUM(t.total_hours), 0) as total_hours,
       COUNT(t.id) as approved_timesheets
     FROM users u
     LEFT JOIN timesheets t ON t.user_id = u.id
       AND t.status = 'approved'
       AND t.period_start >= ?
       AND t.period_end <= ?
     WHERE u.is_active = 1 AND u.role != 'admin'
     GROUP BY u.id, u.employee_id, u.name, u.department
     ORDER BY u.name ASC`
  ).bind(periodStart, periodEnd).all<Omit<ReportRow, 'pto_hours'>>()

  const { results: ptoRows } = await c.env.DB.prepare(
    `SELECT user_id, SUM(hours_deducted) as pto_hours
     FROM pto_requests WHERE status='approved' AND start_date >= ? AND end_date <= ?
     GROUP BY user_id`
  ).bind(periodStart, periodEnd).all<{ user_id: string; pto_hours: number }>()

  const ptoMap: Record<string, number> = {}
  for (const row of ptoRows ?? []) ptoMap[row.user_id] = row.pto_hours

  const rows = (tsRows ?? []).map(r => ({
    ...r,
    pto_hours: ptoMap[r.user_id] ?? 0,
  }))

  const header = 'No. Pekerja,Nama,Jabatan,Jam Biasa,Jam Lebih Masa,Jam Rehat,Jumlah Jam,Jam Cuti\r\n'
  const body = rows.map(r =>
    [r.employee_id, `"${r.name}"`, r.department ?? '', r.regular_hours, r.overtime_hours, r.break_hours, r.total_hours, r.pto_hours].join(',')
  ).join('\r\n')

  const csv = header + body
  const filename = `payroll-${periodStart}-${periodEnd}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export default reports
