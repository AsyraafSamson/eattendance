import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8788';

type User = {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  is_active: number;
  created_at: string;
};

const emptyForm = { employee_id: '', name: '', email: '', password: '', role: 'employee' };

export default function AdminUsers() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); navigate('/login'); return; }
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } finally {
      setLoading(false);
    }
  }, [token, logout, navigate]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal tambah pengguna'); return; }
      setSuccess('Pengguna berjaya ditambah!');
      setForm(emptyForm);
      setShowForm(false);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (user: User) => {
    const res = await fetch(`${API_URL}/api/users/${user.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchUsers();
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Padam pengguna "${user.name}"? Tindakan ini tidak boleh dibuat alik.`)) return;
    const res = await fetch(`${API_URL}/api/users/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    fetchUsers();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${resetTarget.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setSuccess(`Password "${resetTarget.name}" berjaya ditukar!`);
      setResetTarget(null);
      setNewPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Nav */}
      <div className="bg-white shadow-sm border-b p-3 flex justify-between items-center" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <Link to="/admin" className="text-gray-500 hover:text-gray-800 text-sm">← Dashboard</Link>
          <h1 className="text-lg font-bold">Pengguna</h1>
        </div>
        <button onClick={logout} className="text-red-500 text-xs hover:underline border border-red-200 px-2 py-2 rounded-lg">Keluar</button>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Success */}
        {success && (
          <div className="mb-4 bg-green-100 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
            ✅ {success}
          </div>
        )}

        {/* Header row */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{users.length} pengguna berdaftar</p>
          <button
            onClick={() => { setShowForm(!showForm); setError(''); }}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            {showForm ? '✕ Batal' : '+ Tambah Pengguna'}
          </button>
        </div>

        {/* Add user form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow p-5 mb-5 border border-blue-100">
            <h2 className="font-semibold mb-4 text-gray-800">Tambah Pengguna Baru</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 rounded p-2">{error}</p>}
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ID Pekerja *</label>
                <input
                  required
                  className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="cth: EMP001"
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nama Penuh *</label>
                <input
                  required
                  className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="cth: Ahmad Bin Ali"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input
                  required
                  type="email"
                  className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="cth: ahmad@ilkkm.gov.my"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Password *</label>
                <input
                  required
                  type="password"
                  className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Min 6 aksara"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Peranan</label>
                <select
                  className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="employee">Pekerja</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                  Batal
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {submitting ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
              <h2 className="font-semibold mb-1">Reset Password</h2>
              <p className="text-sm text-gray-500 mb-4">{resetTarget.name} ({resetTarget.employee_id})</p>
              <form onSubmit={handleResetPassword}>
                <input
                  required
                  type="password"
                  className="w-full border rounded-lg p-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Password baru (min 6 aksara)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={6}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setResetTarget(null); setNewPassword(''); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                    Batal
                  </button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {submitting ? 'Menyimpan...' : 'Tukar Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users list */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-400 py-10">Memuatkan...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Tiada pengguna berdaftar</p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden divide-y">
                {users.map(user => (
                  <div key={user.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{user.employee_id} · <span className={user.role === 'admin' ? 'text-purple-600' : 'text-blue-600'}>{user.role === 'admin' ? 'Admin' : 'Pekerja'}</span></p>
                      </div>
                      <button
                        onClick={() => handleToggle(user)}
                        className={`px-2 py-1 rounded text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                      >
                        {user.is_active ? '✅ Aktif' : '🔴 Tidak Aktif'}
                      </button>
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => { setResetTarget(user); setNewPassword(''); }} className="text-xs text-blue-600 hover:underline">Reset Password</button>
                      <button onClick={() => handleDelete(user)} className="text-xs text-red-500 hover:underline">Padam</button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-3 text-left text-gray-500 font-medium">Nama</th>
                      <th className="p-3 text-left text-gray-500 font-medium">ID Pekerja</th>
                      <th className="p-3 text-left text-gray-500 font-medium">Peranan</th>
                      <th className="p-3 text-left text-gray-500 font-medium">Status</th>
                      <th className="p-3 text-left text-gray-500 font-medium">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-t hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium text-gray-800">{user.name}</div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </td>
                        <td className="p-3 text-gray-600">{user.employee_id}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {user.role === 'admin' ? 'Admin' : 'Pekerja'}
                          </span>
                        </td>
                        <td className="p-3">
                          <button onClick={() => handleToggle(user)} className={`px-2 py-0.5 rounded text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                            {user.is_active ? '✅ Aktif' : '🔴 Tidak Aktif'}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button onClick={() => { setResetTarget(user); setNewPassword(''); }} className="text-xs text-blue-600 hover:underline">Reset PW</button>
                            <button onClick={() => handleDelete(user)} className="text-xs text-red-500 hover:underline">Padam</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
