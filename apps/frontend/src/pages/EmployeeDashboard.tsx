import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type AttendanceRecord = {
  id: string;
  type: string;
  timestamp: string;
};

export default function EmployeeDashboard() {
  const { token, user, logout } = useAuth();
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/attendance/history?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setHistory(data); })
      .finally(() => setFetching(false));
  }, [token]);

  // Group records by date (Malaysia timezone)
  const grouped = history.reduce<Record<string, AttendanceRecord[]>>((acc, rec) => {
    const date = new Date(rec.timestamp.replace(' ', 'T') + 'Z').toLocaleDateString('ms-MY', {
      timeZone: 'Asia/Kuala_Lumpur', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });
    (acc[date] ??= []).push(rec);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">E-Attendance</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name} <span className="text-gray-400">({user?.employee_id})</span></span>
          <button onClick={logout} className="text-red-500 text-sm hover:underline">Logout</button>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">

        {/* Info card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 text-center">
          <p className="font-semibold mb-1">📍 Cara Rekod Kehadiran</p>
          <p>Imbas QR code yang terpapar di pintu pejabat untuk daftar masuk / keluar.</p>
        </div>

        {/* History card */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800">Rekod Kehadiran</h2>
            <span className="text-xs text-gray-400">{history.length} rekod</span>
          </div>

          {fetching ? (
            <p className="text-center text-gray-400 py-8">Memuatkan...</p>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Tiada rekod lagi</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([date, records]) => (
                <div key={date}>
                  <p className="text-xs text-gray-400 font-medium mb-2 uppercase">{date}</p>
                  <div className="space-y-2">
                    {records.map(rec => (
                      <div key={rec.id} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className={`font-medium ${rec.type === 'check-in' ? 'text-green-600' : 'text-orange-600'}`}>
                          {rec.type === 'check-in' ? '✅ Check In' : '🔴 Check Out'}
                        </span>
                        <span className="text-gray-500">
                          {new Date(rec.timestamp.replace(' ', 'T') + 'Z').toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
