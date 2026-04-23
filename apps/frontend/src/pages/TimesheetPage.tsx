import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type Timesheet = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  regular_hours: number;
  overtime_hours: number;
  break_hours: number;
  total_hours: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draf',    color: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Dihantar', color: 'bg-yellow-100 text-yellow-700' },
  approved:  { label: 'Diluluskan', color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Ditolak', color: 'bg-red-100 text-red-600' },
};

function getPayPeriod() {
  // Default: current month
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${lastDay}` };
}

export default function TimesheetPage() {
  const { token, user, logout } = useAuth();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const period = getPayPeriod();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchTimesheets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await fetch(`${API_URL}/api/timesheets/my`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (Array.isArray(data)) setTimesheets(data);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchTimesheets(); }, [fetchTimesheets]);

  const generateCurrent = async () => {
    setGenerating(true);
    const res = await fetch(`${API_URL}/api/timesheets/generate`, {
      method: 'POST', headers,
      body: JSON.stringify({ period_start: period.start, period_end: period.end }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); setGenerating(false); return; }
    await fetchTimesheets();
    setGenerating(false);
  };

  const submitTimesheet = async (id: string) => {
    setSubmitting(id);
    const res = await fetch(`${API_URL}/api/timesheets/${id}/submit`, {
      method: 'POST', headers,
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); }
    else { await fetchTimesheets(); }
    setSubmitting(null);
  };

  const hasCurrentPeriod = timesheets.some(
    t => t.period_start === period.start && t.period_end === period.end
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Timesheet Saya</h1>
        <div className="flex items-center gap-3">
          <Link to={user?.role === 'admin' ? '/admin' : user?.role === 'manager' ? '/manager' : '/'} className="text-sm text-blue-600 hover:underline">← Kembali</Link>
          <button onClick={logout} className="text-red-500 text-sm hover:underline">Logout</button>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Generate button */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-1">Tempoh Semasa</h2>
          <p className="text-sm text-gray-500 mb-3">{period.start} – {period.end}</p>
          <button
            onClick={generateCurrent}
            disabled={generating}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? 'Jana...' : hasCurrentPeriod ? '🔄 Kira Semula Jam' : '📊 Jana Timesheet'}
          </button>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center text-gray-400 py-8">Memuatkan...</p>
        ) : timesheets.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Tiada timesheet lagi. Jana timesheet pertama anda.</p>
        ) : (
          <div className="space-y-3">
            {timesheets.map(ts => {
              const s = STATUS_LABEL[ts.status] ?? STATUS_LABEL.draft;
              return (
                <div key={ts.id} className="bg-white rounded-xl shadow p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium text-sm">{ts.period_start} – {ts.period_end}</p>
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{ts.total_hours}j</p>
                      <p className="text-xs text-gray-400">jumlah</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs bg-gray-50 rounded-lg p-2 mb-3">
                    <div>
                      <p className="font-semibold text-green-600">{ts.regular_hours}j</p>
                      <p className="text-gray-400">Biasa</p>
                    </div>
                    <div>
                      <p className="font-semibold text-orange-500">{ts.overtime_hours}j</p>
                      <p className="text-gray-400">OT</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-500">{ts.break_hours}j</p>
                      <p className="text-gray-400">Rehat</p>
                    </div>
                  </div>

                  {ts.status === 'draft' && (
                    <button
                      onClick={() => submitTimesheet(ts.id)}
                      disabled={submitting === ts.id}
                      className="w-full bg-green-500 text-white py-1.5 rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
                    >
                      {submitting === ts.id ? 'Menghantar...' : '📤 Hantar untuk Kelulusan'}
                    </button>
                  )}

                  {ts.status === 'rejected' && ts.review_notes && (
                    <p className="text-xs text-red-500 bg-red-50 rounded p-2 mt-2">
                      Ditolak: {ts.review_notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
