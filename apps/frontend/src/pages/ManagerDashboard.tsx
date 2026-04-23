import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type AttendanceRow = {
  id: string;
  employee_id: string;
  name: string;
  department: string | null;
  check_in: string | null;
  check_out: string | null;
  punch_count: number;
};

type PendingTimesheet = {
  id: string;
  user_id: string;
  name: string;
  employee_id: string;
  department: string | null;
  period_start: string;
  period_end: string;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  submitted_at: string;
};

type PendingPTO = {
  id: string;
  user_id: string;
  name: string;
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  pto_balance: number;
};

function fmtTime(ts: string | null) {
  if (!ts) return '–';
  return new Date(ts.replace(' ', 'T') + (ts.includes('+') ? '' : 'Z'))
    .toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' });
}

export default function ManagerDashboard() {
  const { token, user, logout } = useAuth();
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [date, setDate] = useState(today);
  const [pendingTS, setPendingTS] = useState<PendingTimesheet[]>([]);
  const [pendingPTO, setPendingPTO] = useState<PendingPTO[]>([]);
  const [loading, setLoading] = useState(false);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAll = useCallback(async () => {
    if (!token) return;
    const [attRes, tsRes, ptoRes] = await Promise.all([
      fetch(`${API_URL}/api/manager/attendance?date=${date}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/manager/timesheets/pending`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/manager/pto/pending`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [att, ts, pto] = await Promise.all([attRes.json(), tsRes.json(), ptoRes.json()]);
    if (Array.isArray(att)) setAttendance(att);
    if (Array.isArray(ts)) setPendingTS(ts);
    if (Array.isArray(pto)) setPendingPTO(pto);
  }, [token, date]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const reviewTS = async (id: string, action: 'approve' | 'reject', notes?: string) => {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/timesheets/${id}/${action}`, {
      method: 'POST', headers,
      body: JSON.stringify({ notes }),
    });
    if (res.ok) {
      setPendingTS(prev => prev.filter(t => t.id !== id));
    } else {
      const d = await res.json();
      alert(d.error);
    }
    setLoading(false);
  };

  const reviewPTO = async (id: string, action: 'approve' | 'reject', notes?: string) => {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/pto/${id}/${action}`, {
      method: 'POST', headers,
      body: JSON.stringify({ notes }),
    });
    if (res.ok) {
      setPendingPTO(prev => prev.filter(p => p.id !== id));
    } else {
      const d = await res.json();
      alert(d.error);
    }
    setLoading(false);
  };

  const presentCount = attendance.filter(a => a.check_in).length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Dashboard Pengurus</h1>
        <div className="flex items-center gap-4">
          <Link to="/timesheet" className="text-sm text-blue-600 hover:underline">Timesheet Saya</Link>
          <Link to="/pto" className="text-sm text-blue-600 hover:underline">Cuti Saya</Link>
          {user?.role === 'admin' && <Link to="/admin" className="text-sm text-purple-600 hover:underline">Admin</Link>}
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button onClick={logout} className="text-red-500 text-sm hover:underline">Logout</button>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6">

        {/* Stat summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{presentCount}</p>
            <p className="text-sm text-gray-500 mt-1">Hadir Hari Ini</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold text-yellow-500">{pendingTS.length}</p>
            <p className="text-sm text-gray-500 mt-1">Timesheet Pending</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">{pendingPTO.length}</p>
            <p className="text-sm text-gray-500 mt-1">Permohonan Cuti</p>
          </div>
        </div>

        {/* Team attendance */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800">Kehadiran Pasukan</h2>
            <input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          {attendance.length === 0 ? (
            <p className="text-center text-gray-400 py-4 text-sm">Tiada rekod</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b">
                    <th className="pb-2 font-medium">Pekerja</th>
                    <th className="pb-2 font-medium">Masuk</th>
                    <th className="pb-2 font-medium">Keluar</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendance.map(row => (
                    <tr key={row.id}>
                      <td className="py-2">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-gray-400">{row.employee_id} {row.department ? `· ${row.department}` : ''}</p>
                      </td>
                      <td className="py-2 text-green-600">{fmtTime(row.check_in)}</td>
                      <td className="py-2 text-orange-600">{fmtTime(row.check_out)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.check_in ? (row.check_out ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700') : 'bg-red-100 text-red-600'}`}>
                          {row.check_in ? (row.check_out ? 'Selesai' : 'Bekerja') : 'Tidak Hadir'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending timesheets */}
        {pendingTS.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Timesheet Menunggu Kelulusan</h2>
            <div className="space-y-4">
              {pendingTS.map(ts => (
                <div key={ts.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{ts.name} <span className="text-gray-400 text-sm">({ts.employee_id})</span></p>
                      <p className="text-xs text-gray-500">{ts.period_start} – {ts.period_end}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{ts.total_hours}j jumlah</p>
                      <p className="text-xs text-gray-400">OT: {ts.overtime_hours}j</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => reviewTS(ts.id, 'approve')}
                      disabled={loading}
                      className="flex-1 bg-green-500 text-white py-1.5 rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
                    >
                      ✅ Luluskan
                    </button>
                    <button
                      onClick={() => {
                        const notes = prompt('Nota penolakan (pilihan):') ?? '';
                        reviewTS(ts.id, 'reject', notes);
                      }}
                      disabled={loading}
                      className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
                    >
                      ❌ Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending PTO */}
        {pendingPTO.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Permohonan Cuti Menunggu Kelulusan</h2>
            <div className="space-y-4">
              {pendingPTO.map(p => (
                <div key={p.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{p.name} <span className="text-gray-400 text-sm">({p.employee_id})</span></p>
                      <p className="text-xs text-gray-500 capitalize">{p.type} · {p.start_date} – {p.end_date} ({p.days_requested} hari)</p>
                      {p.reason && <p className="text-xs text-gray-400 mt-1 italic">"{p.reason}"</p>}
                    </div>
                    <span className="text-xs text-gray-400">Baki: {p.pto_balance}j</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => reviewPTO(p.id, 'approve')}
                      disabled={loading}
                      className="flex-1 bg-green-500 text-white py-1.5 rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
                    >
                      ✅ Luluskan
                    </button>
                    <button
                      onClick={() => {
                        const notes = prompt('Nota penolakan (pilihan):') ?? '';
                        reviewPTO(p.id, 'reject', notes);
                      }}
                      disabled={loading}
                      className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
                    >
                      ❌ Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
