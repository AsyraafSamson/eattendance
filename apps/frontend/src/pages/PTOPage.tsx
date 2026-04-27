import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

type PTORequest = {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: string;
  reason: string | null;
  review_notes: string | null;
  created_at: string;
};

const PTO_TYPES = [
  { value: 'annual', label: 'Cuti Tahunan' },
  { value: 'sick', label: 'Cuti Sakit' },
  { value: 'emergency', label: 'Kecemasan' },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Menunggu', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Diluluskan', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Ditolak', color: 'bg-red-100 text-red-600' },
};

export default function PTOPage() {
  const { token, user, logout } = useAuth();
  const [requests, setRequests] = useState<PTORequest[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: 'annual', start_date: '', end_date: '', reason: '' });
  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const [reqRes, balRes] = await Promise.all([
      apiFetch('/api/pto/my', { token }),
      apiFetch('/api/pto/balance', { token }),
    ]);
    const [reqs, bal] = await Promise.all([reqRes.json(), balRes.json()]);
    if (Array.isArray(reqs)) setRequests(reqs);
    if (bal?.balance !== undefined) setBalance(bal.balance);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submitRequest = async () => {
    if (!form.start_date || !form.end_date) { alert('Sila pilih tarikh'); return; }
    if (form.end_date < form.start_date) { alert('Tarikh tamat mestilah selepas tarikh mula'); return; }
    setSubmitting(true);
    const res = await apiFetch('/api/pto', {
      method: 'POST',
      token,
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); setSubmitting(false); return; }
    await fetchData();
    setShowForm(false);
    setForm({ type: 'annual', start_date: '', end_date: '', reason: '' });
    setSubmitting(false);
  };

  const backLink = user?.role === 'admin' ? '/admin' : user?.role === 'manager' ? '/manager' : '/';

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Permohonan Cuti</h1>
        <div className="flex items-center gap-3">
          <Link to={backLink} className="text-sm text-blue-600 hover:underline">← Kembali</Link>
          <button onClick={logout} className="text-red-500 text-sm hover:underline">Logout</button>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Balance card */}
        <div className="bg-white rounded-xl shadow p-5 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Baki Cuti Tahunan</p>
            <p className="text-3xl font-bold text-green-600">{balance}j</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            + Mohon Cuti
          </button>
        </div>

        {/* New request form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <h2 className="font-semibold">Permohonan Baharu</h2>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Jenis Cuti</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {PTO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tarikh Mula</label>
                <input type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tarikh Tamat</label>
                <input type="date" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sebab (pilihan)</label>
              <textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Nyatakan sebab..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={submitRequest}
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Menghantar...' : 'Hantar Permohonan'}
              </button>
            </div>
          </div>
        )}

        {/* Request list */}
        {loading ? (
          <p className="text-center text-gray-400 py-8">Memuatkan...</p>
        ) : requests.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Tiada permohonan cuti</p>
        ) : (
          <div className="space-y-3">
            {requests.map(req => {
              const s = STATUS_LABEL[req.status] ?? STATUS_LABEL.pending;
              const typeLabel = PTO_TYPES.find(t => t.value === req.type)?.label ?? req.type;
              return (
                <div key={req.id} className="bg-white rounded-xl shadow p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{typeLabel}</p>
                      <p className="text-xs text-gray-500">{req.start_date} – {req.end_date} ({req.days_requested} hari)</p>
                      {req.reason && <p className="text-xs text-gray-400 mt-1 italic">"{req.reason}"</p>}
                      {req.review_notes && (
                        <p className="text-xs text-red-500 mt-1">Nota: {req.review_notes}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
