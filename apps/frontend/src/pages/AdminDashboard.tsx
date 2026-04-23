import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type AttendanceRecord = {
  id: string;
  user_id: string;
  name: string;
  employee_id: string;
  type: string;
  timestamp: string;
};

export default function AdminDashboard() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [date, setDate] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [fetching, setFetching] = useState(false);

  const fetchAttendance = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/all?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); navigate('/login'); return; }
      const data = await res.json();
      if (Array.isArray(data)) setAttendance(data);
    } catch {
      // network error — silently ignore, table stays empty
    } finally {
      setFetching(false);
    }
  }, [date, token, logout, navigate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const checkIns = attendance.filter((r) => r.type === 'check-in').length;
  const checkOuts = attendance.filter((r) => r.type === 'check-out').length;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b p-3 flex justify-between items-center" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <h1 className="text-lg font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link to="/admin/qr" className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-blue-700 font-medium">
            🖨️ <span className="hidden sm:inline">QR Code</span>
          </Link>
          <Link to="/admin/users" className="bg-gray-700 text-white text-xs px-3 py-2 rounded-lg hover:bg-gray-800 font-medium">
            👥 <span className="hidden sm:inline">Pengguna</span>
          </Link>
          <Link to="/admin/reports" className="bg-purple-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-purple-700 font-medium">
            📊 <span className="hidden sm:inline">Laporan</span>
          </Link>
          <span className="text-sm text-gray-600 hidden sm:inline">{user?.name}</span>
          <button onClick={logout} className="text-red-500 text-xs hover:underline border border-red-200 px-2 py-2 rounded-lg">Keluar</button>
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500">Total Records</div>
            <div className="text-3xl font-bold">{attendance.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500">Check Ins</div>
            <div className="text-3xl font-bold text-green-600">{checkIns}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500">Check Outs</div>
            <div className="text-3xl font-bold text-orange-600">{checkOuts}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold">Attendance Records</h2>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded p-1 text-sm"
            />
          </div>
          <div className="overflow-x-auto">
            {fetching ? (
              <p className="text-center text-gray-400 py-8">Memuatkan...</p>
            ) : attendance.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Tiada rekod untuk tarikh ini</p>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="sm:hidden divide-y">
                  {attendance.map((record) => (
                    <div key={record.id} className="p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{record.name}</p>
                        <p className="text-xs text-gray-400">{record.employee_id}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${record.type === 'check-in' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                          {record.type === 'check-in' ? '✅ Check In' : '🔴 Check Out'}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(record.timestamp.replace(' ', 'T') + 'Z').toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table view */}
                <table className="w-full text-sm hidden sm:table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Employee ID</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record) => (
                      <tr key={record.id} className="border-t">
                        <td className="p-3">{record.name}</td>
                        <td className="p-3">{record.employee_id}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${record.type === 'check-in' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                            {record.type === 'check-in' ? '✅ Check In' : '🔴 Check Out'}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500">
                          {new Date(record.timestamp.replace(' ', 'T') + 'Z').toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
