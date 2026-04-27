type SettingRow = {
  key: string
  value: string
}

const REQUIRED_SETTING_KEYS = [
  'office_name',
  'office_lat',
  'office_lng',
  'office_radius_meters',
  'frontend_url',
] as const

type RequiredSettingKey = (typeof REQUIRED_SETTING_KEYS)[number]

export type AppSettings = {
  officeName: string
  officeLat: number
  officeLng: number
  officeRadiusMeters: number
  frontendUrl: string
}

function requireValue(values: Map<string, string>, key: RequiredSettingKey): string {
  const value = values.get(key)?.trim()
  if (!value) {
    throw new Error(`Missing required app setting: ${key}`)
  }
  return value
}

function requireNumber(values: Map<string, string>, key: Extract<RequiredSettingKey, 'office_lat' | 'office_lng' | 'office_radius_meters'>): number {
  const raw = requireValue(values, key)
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric app setting: ${key}`)
  }
  return parsed
}

export async function getAppSettings(db: D1Database): Promise<AppSettings> {
  const placeholders = REQUIRED_SETTING_KEYS.map(() => '?').join(', ')
  const { results } = await db.prepare(
    `SELECT key, value FROM app_settings WHERE key IN (${placeholders})`
  ).bind(...REQUIRED_SETTING_KEYS).all<SettingRow>()

  const values = new Map((results ?? []).map((row) => [row.key, row.value]))

  return {
    officeName: requireValue(values, 'office_name'),
    officeLat: requireNumber(values, 'office_lat'),
    officeLng: requireNumber(values, 'office_lng'),
    officeRadiusMeters: requireNumber(values, 'office_radius_meters'),
    frontendUrl: requireValue(values, 'frontend_url'),
  }
}
