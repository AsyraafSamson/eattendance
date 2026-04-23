import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type AttendanceRecord = {
  id: string;
  type: string;
  timestamp: string;
};

type BreakRecord = {
  id: string;
  start_time: string;
  end_time: string | null;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
};

function fmtTime(ts: string) {
  return new Date(ts.replace(' ', 'T') + (ts.includes('+') ? '' : 'Z'))
    .toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' });
}

export default function EmployeeDashboard() {
  const { token, user, logout } = useAuth();
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [breaks, setBreaks] = useState<BreakRecord[]>([]);
  const [totalBreakMin, setTotalBreakMin] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [breakLoading, setBreakLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const [histRes, todayRes, breakRes, notifRes] = await Promise.all([
        fetch(`${API_URL}/api/attendance/history?limit=50`, { headers }),
        fetch(`${API_URL}/api/attendance/today`, { headers }),
        fetch(`${API_URL}/api/breaks/today`, { headers }),
        fetch(`${API_URL}/api/notifications?limit=10`, { headers }),
      ]);
      const [hist, today, brk, notif] = await Promise.all([
        histRes.json(), todayRes.json(), breakRes.json(), notifRes.json(),
      ]);
      if (Array.isArray(hist)) setHistory(hist);
      if (Array.isArray(today)) setTodayRecords(today);
      if (brk?.breaks) { setBreaks(brk.breaks); setTotalBreakMin(brk.total_minutes ?? 0); }
      if (notif?.notifications) { setNotifications(notif.notifications); setUnreadCount(notif.unread_count ?? 0); }
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Today's status
  const lastRecord = todayRecords[todayRecords.length - 1];
  const isClockedIn = lastRecord?.type === 'check-in';
  const isOnBreak = breaks.some(b => !b.end_time);

  const handleBreak = async () => {
    setBreakLoading(true);
    try {
      const endpoint = isOnBreak ? '/api/breaks/end' : '/api/breaks/start';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      await fetchAll();
    } finally {
      setBreakLoading(false);
    }
  };

  const markAllRead = async () => {
    await fetch(`${API_URL}/api/notifications/read-all`, { method: 'PATCH', headers });
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  // Group history by date
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
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <div className="relative">
            <button onClick={() => setShowNotif(!showNotif)} className="relative p-1">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border z-50">
                <div className="flex justify-between items-center p-3 border-b">
                  <span className="font-semibold text-sm">Notifikasi</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">Baca semua</button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-6">Tiada notifikasi</p>
                  ) : notifications.map(n => (
                    <div key={n.id} className={`p-3 border-b text-sm ${n.is_read ? 'bg-white' : 'bg-blue-50'}`}>
                      <p className="font-medium">{n.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className="text-sm text-gray-600">{user?.name} <span className="text-gray-400">({user?.employee_id})</span></span>
          <button onClick={logout} className="text-red-500 text-sm hover:underline">Logout</button>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">

        {/* Today status card */}
        <div className={`rounded-xl p-4 text-center ${isClockedIn ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
          <p className="text-2xl mb-1">{isClockedIn ? '✅' : '🔴'}</p>
          <p className="font-semibold text-gray-800">
            {isClockedIn ? (isOnBreak ? 'Sedang Rehat' : 'Sedang Bekerja') : (lastRecord ? 'Sudah Keluar' : 'Belum Masuk')}
          </p>
          {lastRecord && (
            <p className="text-xs text-gray-500 mt-1">
              {lastRecord.type === 'check-in' ? 'Masuk' : 'Keluar'}: {fmtTime(lastRecord.timestamp)}
            </p>
          )}
          {isClockedIn && (
            <div className="mt-3">
              <button
                onClick={handleBreak}
                disabled={breakLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition ${isOnBreak ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:opacity-50`}
              >
                {breakLoading ? '...' : isOnBreak ? '▶️ Tamat Rehat' : '⏸️ Mula Rehat'}
              </button>
              {totalBreakMin > 0 && (
                <p className="text-xs text-gray-400 mt-1">Jumlah rehat hari ini: {totalBreakMin} minit</p>
              )}
            </div>
          )}
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/timesheet" className="bg-white rounded-xl shadow p-4 flex items-center gap-3 hover:bg-blue-50 transition">
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-semibold text-sm">Timesheet</p>
              <p className="text-xs text-gray-400">Jana & hantar</p>
            </div>
          </Link>
          <Link to="/pto" className="bg-white rounded-xl shadow p-4 flex items-center gap-3 hover:bg-green-50 transition">
            <span className="text-2xl">🌴</span>
            <div>
              <p className="font-semibold text-sm">Cuti</p>
              <p className="text-xs text-gray-400">Mohon & semak</p>
            </div>
          </Link>
        </div>

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
                        <span className="text-gray-500">{fmtTime(rec.timestamp)}</span>
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
