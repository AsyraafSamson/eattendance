import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8788'

type OfficeInfo = { officeName: string; devMode: boolean }
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
  const [result, setResult] = useState<AttendResult | null>(null)
  const [officeInfo, setOfficeInfo] = useState<OfficeInfo | null>(null)
  const [gpsError, setGpsError] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/api/attend/info`)
      .then(r => r.json() as Promise<OfficeInfo>)
      .then(setOfficeInfo)
      .catch(() => {})
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

      const res = await fetch(`${API_URL}/api/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const formatTime = (ts: string) =>
    new Date(ts.replace(' ', 'T') + 'Z').toLocaleTimeString('ms-MY', {
      timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit'
    })

  const formatDate = (ts: string) =>
    new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString('ms-MY', {
      timeZone: 'Asia/Kuala_Lumpur', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

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
                <p className="text-xs text-gray-400 mb-3">{formatDate(result.todayRecords[0].timestamp)}</p>
                <div className="bg-gray-50 rounded-2xl overflow-hidden divide-y divide-gray-100">
                  {result.todayRecords.map((rec, i) => (
                    <div key={i} className="flex justify-between items-center px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{rec.type === 'check-in' ? '✅' : '🔴'}</span>
                        <span className={`text-sm font-medium ${rec.type === 'check-in' ? 'text-green-700' : 'text-orange-600'}`}>
                          {rec.type === 'check-in' ? 'Check In' : 'Check Out'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-400 font-mono">{formatTime(rec.timestamp)}</span>
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
