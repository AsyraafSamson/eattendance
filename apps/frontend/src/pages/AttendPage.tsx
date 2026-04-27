import { useState, useEffect } from 'react'
import { apiFetch, apiUrl, fetchPublicAppInfo, type PublicAppInfo } from '../lib/api'
import { formatMalaysiaDate, formatMalaysiaTime } from '../lib/date'

type TodayRecord = { type: string; timestamp: string }
type AttendResult = {
  success: boolean
  message: string
  name?: string
  todayRecords?: TodayRecord[]
}

export default function AttendPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [type, setType] = useState<'check-in' | 'check-out'>('check-in')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [result, setResult] = useState<AttendResult | null>(null)
  const [officeInfo, setOfficeInfo] = useState<PublicAppInfo | null>(null)
  const [gpsError, setGpsError] = useState('')

  useEffect(() => {
    void fetchPublicAppInfo().then(setOfficeInfo).catch(() => {})

    // Handle Google OAuth callback result
    const params = new URLSearchParams(window.location.search)
    const googleOk = params.get('google_ok')
    const googleError = params.get('google_error')

    if (googleOk) {
      try {
        const data = JSON.parse(decodeURIComponent(googleOk)) as {
          name: string; type: string; records: TodayRecord[]
        }
        const actionLabel = data.type === 'check-in' ? 'Check-in berjaya!' : 'Check-out berjaya!'
        setResult({ success: true, message: actionLabel, name: data.name, todayRecords: data.records })
      } catch {
        setResult({ success: false, message: 'Ralat membaca respons Google.' })
      }
      window.history.replaceState({}, '', window.location.pathname)
    } else if (googleError) {
      const errorMessages: Record<string, string> = {
        cancelled:          'Log masuk Google dibatalkan.',
        invalid_state:      'Sesi tidak sah. Cuba lagi.',
        expired:            'Sesi tamat masa. Cuba lagi.',
        google_failed:      'Gagal mengesahkan dengan Google.',
        not_registered:     `Akaun Google anda (${params.get('email') ?? ''}) tidak didaftarkan dalam sistem.`,
        out_of_range:       `Anda terlalu jauh dari pejabat (${params.get('distance')}m, had ${params.get('radius')}m).`,
        already_checked_in: `${params.get('name') ?? 'Anda'} sudah check-in hari ini.`,
        already_checked_out:`${params.get('name') ?? 'Anda'} sudah check-out hari ini.`,
      }
      setResult({ success: false, message: errorMessages[googleError] ?? `Ralat: ${googleError}` })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS tidak disokong oleh browser ini'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error('Sila benarkan akses lokasi GPS untuk merekod kehadiran'))
      )
    })
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setGpsError('')
    try {
      let coords = { lat: '0', lng: '0' }
      try {
        const pos = await getLocation()
        coords = { lat: String(pos.lat), lng: String(pos.lng) }
      } catch (err) {
        if (!officeInfo?.devMode) {
          setGpsError(err instanceof Error ? err.message : 'GPS error')
          setGoogleLoading(false)
          return
        }
      }
      const params = new URLSearchParams({ type, ...coords })
      window.location.href = `${apiUrl('/api/auth/google/start')}?${params.toString()}`
    } catch {
      setGpsError('Ralat memulakan log masuk Google.')
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setGpsError('')

    try {
      let coords = { lat: 0, lng: 0 }
      try {
        coords = await getLocation()
      } catch (err) {
        if (!officeInfo?.devMode) {
          setGpsError(err instanceof Error ? err.message : 'GPS error')
          setLoading(false)
          return
        }
      }

      const res = await apiFetch('/api/attend', {
        method: 'POST',
        body: JSON.stringify({ email, password, type, ...coords }),
      })

      const data = await res.json() as AttendResult & { error?: string }

      if (!res.ok) {
        setResult({ success: false, message: data.error || 'Gagal merekod kehadiran' })
      } else {
        setResult({ success: true, message: data.message || 'Berjaya!', name: data.name, todayRecords: data.todayRecords })
        setEmail('')
        setPassword('')
      }
    } catch {
      setResult({ success: false, message: 'Ralat sambungan. Cuba lagi.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-start justify-center p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden my-4">

        {/* Header */}
        <div className="bg-blue-600 text-white p-6 text-center">
          <div className="text-3xl mb-2">🏥</div>
          <h1 className="text-xl font-bold">E-Attendance</h1>
          <p className="text-blue-200 text-sm mt-1">{officeInfo?.officeName || 'Loading...'}</p>
          {officeInfo?.devMode && (
            <span className="inline-block mt-2 bg-yellow-400 text-yellow-900 text-xs px-2 py-0.5 rounded-full font-medium">
              DEV MODE — GPS Disabled
            </span>
          )}
        </div>

        {/* Success Screen */}
        {result?.success ? (
          <div className="p-6">
            {/* Success badge */}
            <div className={`rounded-2xl p-5 text-center mb-5 ${result.message.includes('Check-in') ? 'bg-green-50' : 'bg-orange-50'}`}>
              <div className="text-4xl mb-2">{result.message.includes('Check-in') ? '✅' : '🔴'}</div>
              <h2 className={`text-base font-bold ${result.message.includes('Check-in') ? 'text-green-700' : 'text-orange-700'}`}>{result.message}</h2>
              {result.name && <p className="text-gray-500 text-sm mt-1">Selamat datang, <strong>{result.name}</strong>!</p>}
            </div>

            {/* Today's records */}
            {result.todayRecords && result.todayRecords.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">📋 Rekod Hari Ini</p>
                <p className="text-xs text-gray-400 mb-3">{formatMalaysiaDate(result.todayRecords[0].timestamp)}</p>
                <div className="bg-gray-50 rounded-2xl overflow-hidden divide-y divide-gray-100">
                  {result.todayRecords.map((rec, i) => (
                    <div key={i} className="flex justify-between items-center px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{rec.type === 'check-in' ? '✅' : '🔴'}</span>
                        <span className={`text-sm font-medium ${rec.type === 'check-in' ? 'text-green-700' : 'text-orange-600'}`}>
                          {rec.type === 'check-in' ? 'Check In' : 'Check Out'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-400 font-mono">{formatMalaysiaTime(rec.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setResult(null)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
            >
              Rekod Lagi
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Check-in / Check-out Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
              <button type="button" onClick={() => setType('check-in')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${type === 'check-in' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>
                ✅ Check In
              </button>
              <button type="button" onClick={() => setType('check-out')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${type === 'check-out' ? 'bg-orange-500 text-white shadow' : 'text-gray-500'}`}>
                🔴 Check Out
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@contoh.com" required autoComplete="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            {gpsError && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded-xl">📍 {gpsError}</div>
            )}
            {result && !result.success && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">❌ {result.message}</div>
            )}

            {/* Google Sign-in */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              {googleLoading ? (
                <span className="text-sm">Memuatkan...</span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-sm">Log masuk dengan Google</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">atau guna email & password</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button type="submit" disabled={loading}
              className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50 ${type === 'check-in' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
              {loading ? 'Merekod...' : type === 'check-in' ? '✅ Rekod Check In' : '🔴 Rekod Check Out'}
            </button>

            <p className="text-center text-xs text-gray-400">📍 Lokasi GPS akan disemak secara automatik</p>
          </form>
        )}
      </div>
    </div>
  )
}
