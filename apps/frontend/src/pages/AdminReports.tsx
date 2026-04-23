import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type ReportEmployee = {
  user_id: string;
  employee_id: string;
  name: string;
  department: string | null;
  regular_hours: number;
  overtime_hours: number;
  break_hours: number;
  total_hours: number;
  pto_hours: number;
  approved_timesheets: number;
};

type Report = {
  period_start: string;
  period_end: string;
  generated_at: string;
  employees: ReportEmployee[];
  totals: {
    regular_hours: number;
    overtime_hours: number;
    break_hours: number;
    pto_hours: number;
  };
};

function getDefaultPeriod() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${last}` };
}

export default function AdminReports() {
  const { token, logout } = useAuth();
  const def = getDefaultPeriod();
  const [start, setStart] = useState(def.start);
  const [end, setEnd] = useState(def.end);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const fetchReport = async () => {
    if (!start || !end) { alert('Sila pilih tempoh'); return; }
    setLoading(true);
    const res = await fetch(`${API_URL}/api/reports/payroll?period_start=${start}&period_end=${end}`, { headers });
    const data = await res.json();
    if (!res.ok) { alert(data.error); setLoading(false); return; }
    setReport(data);
    setLoading(false);
  };

  const downloadCSV = () => {
    window.open(`${API_URL}/api/reports/payroll/csv?period_start=${start}&period_end=${end}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Laporan Gaji</h1>
        <div className="flex items-center gap-3">
          <Link to="/admin" className="text-sm text-blue-600 hover:underline">← Admin</Link>
          <button onClick={logout} className="text-red-500 text-sm hover:underline">Logout</button>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto space-y-4">
        {/* Filter */}
        <div className="bg-white rounded-xl shadow p-5 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tarikh Mula</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tarikh Tamat</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Jana...' : '📊 Jana Laporan'}
          </button>
          {report && (
            <button
              onClick={downloadCSV}
              className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              ⬇️ Muat Turun CSV
            </button>
          )}
        </div>

        {/* Report table */}
        {report && (
          <>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Jam Biasa', value: `${report.totals.regular_hours}j`, color: 'text-green-600' },
                { label: 'Lebih Masa', value: `${report.totals.overtime_hours}j`, color: 'text-orange-500' },
                { label: 'Rehat', value: `${report.totals.break_hours}j`, color: 'text-blue-500' },
                { label: 'Cuti', value: `${report.totals.pto_hours}j`, color: 'text-purple-500' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl shadow p-4 text-center">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="font-semibold">Butiran Pekerja</h2>
                <p className="text-xs text-gray-400">
                  {report.period_start} – {report.period_end} · {report.employees.length} pekerja
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">No. Pekerja</th>
                      <th className="px-4 py-3 font-medium">Nama</th>
                      <th className="px-4 py-3 font-medium">Jabatan</th>
                      <th className="px-4 py-3 font-medium text-right">Biasa</th>
                      <th className="px-4 py-3 font-medium text-right">OT</th>
                      <th className="px-4 py-3 font-medium text-right">Rehat</th>
                      <th className="px-4 py-3 font-medium text-right">Jumlah</th>
                      <th className="px-4 py-3 font-medium text-right">Cuti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.employees.map(emp => (
                      <tr key={emp.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs">{emp.employee_id}</td>
                        <td className="px-4 py-3 font-medium">{emp.name}</td>
                        <td className="px-4 py-3 text-gray-500">{emp.department ?? '–'}</td>
                        <td className="px-4 py-3 text-right text-green-600">{emp.regular_hours}j</td>
                        <td className="px-4 py-3 text-right text-orange-500">{emp.overtime_hours}j</td>
                        <td className="px-4 py-3 text-right text-blue-500">{emp.break_hours}j</td>
                        <td className="px-4 py-3 text-right font-semibold">{emp.total_hours}j</td>
                        <td className="px-4 py-3 text-right text-purple-500">{emp.pto_hours}j</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
