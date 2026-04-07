import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

const ATTEND_URL = `${window.location.origin}/attend`

export default function AdminQR() {
  const { user, logout } = useAuth()

  console.log('[AdminQR] rendering, user=', user, 'attendUrl=', ATTEND_URL)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* Top nav */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '0.75rem 1rem', paddingTop: 'max(0.75rem, env(safe-area-inset-top))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="print:hidden">
        <h1 style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>QR Attendance</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/admin" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Dashboard</Link>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{user?.name}</span>
          <button onClick={logout} style={{ color: '#ef4444', fontSize: '0.875rem' }}>Logout</button>
        </div>
      </div>

      {/* Print button */}
      <div style={{ padding: '1rem', textAlign: 'center' }} className="print:hidden">
        <button
          onClick={() => window.print()}
          style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.75rem 2rem', borderRadius: '0.75rem', fontWeight: '600', cursor: 'pointer', border: 'none' }}
        >
          🖨️ Print / Save PDF
        </button>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Tekan butang di atas → pilih "Save as PDF" atau terus print
        </p>
      </div>

      {/* QR Card */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 1rem 2rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', textAlign: 'center', width: '100%', maxWidth: '24rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏥</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>E-Attendance</h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>ILKKM Johor Bahru</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem' }}>
            <QRCodeSVG value={ATTEND_URL} size={220} level="H" />
          </div>

          <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1.5rem' }}>
            <p style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>Cara Isi Kehadiran:</p>
            <div style={{ textAlign: 'left', backgroundColor: '#eff6ff', borderRadius: '0.75rem', padding: '1rem' }}>
              <p>1️⃣ Imbas QR code di atas</p>
              <p>2️⃣ Masuk email & password</p>
              <p>3️⃣ Pilih Check In atau Check Out</p>
              <p>4️⃣ Tekan butang rekod</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#f3f4f6', borderRadius: '0.75rem', padding: '0.75rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Atau buka terus:</p>
            <a href={ATTEND_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#2563eb', fontFamily: 'monospace', wordBreak: 'break-all', textDecoration: 'underline' }}>{ATTEND_URL}</a>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: '1rem' }}>
            Sistem Kehadiran Digital • {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </div>
  )
}
