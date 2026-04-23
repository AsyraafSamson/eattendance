import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type User = {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  manager_id: string | null;
  manager_name: string | null;
  pto_balance: number;
  is_active: number;
  created_at: string;
};

const emptyAdd = { employee_id: '', name: '', email: '', password: '', role: 'employee', department: '', manager_id: '', pto_balance: '80' };

type EditForm = { name: string; email: string; employee_id: string; role: string; department: string; manager_id: string; pto_balance: string };

const roleBadge = (role: string) => {
  if (role === 'admin') return 'bg-purple-100 text-purple-700';
  if (role === 'manager') return 'bg-yellow-100 text-yellow-700';
  return 'bg-blue-100 text-blue-700';
};
const roleLabel = (role: string) => role === 'admin' ? 'Admin' : role === 'manager' ? 'Pengurus' : 'Pekerja';

export default function AdminUsers() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyAdd);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { logout(); navigate('/login'); return; }
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } finally {
      setLoading(false);
    }
  }, [token, logout, navigate]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3500); };

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.employee_id.toLowerCase().includes(q);
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const body: Record<string, unknown> = { ...addForm, pto_balance: parseFloat(addForm.pto_balance) || 0 };
      if (!body.manager_id) delete body.manager_id;
      if (!body.department) delete body.department;
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal tambah pengguna'); return; }
      flash('Pengguna berjaya ditambah!');
      setAddForm(emptyAdd); setShowAdd(false); fetchUsers();
    } finally { setSubmitting(false); }
  };

  const openEdit = (user: User) => {
    setEditTarget(user);
    setEditForm({
      name: user.name, email: user.email, employee_id: user.employee_id,
      role: user.role, department: user.department ?? '', manager_id: user.manager_id ?? '',
      pto_balance: String(user.pto_balance ?? 0),
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editForm) return;
    setSubmitting(true); setError('');
    try {
      const body: Record<string, unknown> = {
        name: editForm.name, email: editForm.email, employee_id: editForm.employee_id,
        role: editForm.role, department: editForm.department || null,
        manager_id: editForm.manager_id || null,
        pto_balance: parseFloat(editForm.pto_balance) || 0,
      };
      const res = await fetch(`${API_URL}/api/users/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal kemaskini pengguna'); return; }
      flash(`Maklumat "${editForm.name}" berjaya dikemaskini!`);
      setEditTarget(null); setEditForm(null); fetchUsers();
    } finally { setSubmitting(false); }
  };

  const handleToggle = async (user: User) => {
    const res = await fetch(`${API_URL}/api/users/${user.id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) fetchUsers();
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Padam pengguna "${user.name}"? Tindakan ini tidak boleh dibuat alik.`)) return;
    const res = await fetch(`${API_URL}/api/users/${user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
      flash(`Password "${resetTarget.name}" berjaya ditukar!`);
      setResetTarget(null); setNewPassword('');
    } finally { setSubmitting(false); }
  };

  const InputCls = 'w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
  const LabelCls = 'block text-xs text-gray-500 mb-1';

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b p-3 flex justify-between items-center" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <Link to="/admin" className="text-gray-500 hover:text-gray-800 text-sm">← Dashboard</Link>
          <h1 className="text-lg font-bold">Pengguna</h1>
        </div>
        <button onClick={logout} className="text-red-500 text-xs hover:underline border border-red-200 px-2 py-2 rounded-lg">Keluar</button>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        {success && <div className="mb-4 bg-green-100 border border-green-200 text-green-800 rounded-lg p-3 text-sm">✅ {success}</div>}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="🔍 Cari nama, email, ID..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <select
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={filterRole} onChange={e => setFilterRole(e.target.value)}
          >
            <option value="all">Semua Peranan</option>
            <option value="employee">Pekerja</option>
            <option value="manager">Pengurus</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={() => { setShowAdd(!showAdd); setError(''); }}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
          >
            {showAdd ? '✕ Batal' : '+ Tambah Pengguna'}
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-white rounded-xl shadow p-5 mb-5 border border-blue-100">
            <h2 className="font-semibold mb-4 text-gray-800">Tambah Pengguna Baru</h2>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 rounded p-2">{error}</p>}
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={LabelCls}>ID Pekerja *</label><input required className={InputCls} placeholder="cth: EMP006" value={addForm.employee_id} onChange={e => setAddForm(f => ({ ...f, employee_id: e.target.value }))} /></div>
              <div><label className={LabelCls}>Nama Penuh *</label><input required className={InputCls} placeholder="cth: Ahmad Bin Ali" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className={LabelCls}>Email *</label><input required type="email" className={InputCls} placeholder="cth: ahmad@ilkkm.gov.my" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className={LabelCls}>Password *</label><input required type="password" className={InputCls} placeholder="Min 6 aksara" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} /></div>
              <div>
                <label className={LabelCls}>Peranan</label>
                <select className={InputCls} value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="employee">Pekerja</option>
                  <option value="manager">Pengurus</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div><label className={LabelCls}>Jabatan</label><input className={InputCls} placeholder="cth: Cashier" value={addForm.department} onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))} /></div>
              <div>
                <label className={LabelCls}>Pengurus (untuk Pekerja)</label>
                <select className={InputCls} value={addForm.manager_id} onChange={e => setAddForm(f => ({ ...f, manager_id: e.target.value }))}>
                  <option value="">— Tiada —</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.employee_id})</option>)}
                </select>
              </div>
              <div><label className={LabelCls}>Baki Cuti (jam)</label><input type="number" min="0" className={InputCls} value={addForm.pto_balance} onChange={e => setAddForm(f => ({ ...f, pto_balance: e.target.value }))} /></div>
              <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
                <button type="button" onClick={() => { setShowAdd(false); setError(''); }} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">{submitting ? 'Menyimpan...' : 'Simpan Pengguna'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Modal */}
        {editTarget && editForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl my-4">
              <h2 className="font-semibold mb-4 text-gray-800">Kemaskini Pengguna</h2>
              {error && <p className="text-red-600 text-sm mb-3 bg-red-50 rounded p-2">{error}</p>}
              <form onSubmit={handleEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={LabelCls}>ID Pekerja</label><input required className={InputCls} value={editForm.employee_id} onChange={e => setEditForm(f => f ? { ...f, employee_id: e.target.value } : f)} /></div>
                <div><label className={LabelCls}>Nama Penuh</label><input required className={InputCls} value={editForm.name} onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)} /></div>
                <div><label className={LabelCls}>Email</label><input required type="email" className={InputCls} value={editForm.email} onChange={e => setEditForm(f => f ? { ...f, email: e.target.value } : f)} /></div>
                <div>
                  <label className={LabelCls}>Peranan</label>
                  <select className={InputCls} value={editForm.role} onChange={e => setEditForm(f => f ? { ...f, role: e.target.value } : f)}>
                    <option value="employee">Pekerja</option>
                    <option value="manager">Pengurus</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div><label className={LabelCls}>Jabatan</label><input className={InputCls} value={editForm.department} onChange={e => setEditForm(f => f ? { ...f, department: e.target.value } : f)} /></div>
                <div>
                  <label className={LabelCls}>Pengurus</label>
                  <select className={InputCls} value={editForm.manager_id} onChange={e => setEditForm(f => f ? { ...f, manager_id: e.target.value } : f)}>
                    <option value="">— Tiada —</option>
                    {managers.filter(m => m.id !== editTarget.id).map(m => <option key={m.id} value={m.id}>{m.name} ({m.employee_id})</option>)}
                  </select>
                </div>
                <div><label className={LabelCls}>Baki Cuti (jam)</label><input type="number" min="0" className={InputCls} value={editForm.pto_balance} onChange={e => setEditForm(f => f ? { ...f, pto_balance: e.target.value } : f)} /></div>
                <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
                  <button type="button" onClick={() => { setEditTarget(null); setEditForm(null); setError(''); }} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Batal</button>
                  <button type="submit" disabled={submitting} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">{submitting ? 'Menyimpan...' : 'Kemaskini'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
              <h2 className="font-semibold mb-1">Reset Password</h2>
              <p className="text-sm text-gray-500 mb-4">{resetTarget.name} ({resetTarget.employee_id})</p>
              <form onSubmit={handleResetPassword}>
                <input required type="password" className={`${InputCls} mb-3`} placeholder="Password baru (min 6 aksara)" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} autoFocus />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setResetTarget(null); setNewPassword(''); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Batal</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Menyimpan...' : 'Tukar Password'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users list */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b text-sm text-gray-500">
            {filtered.length} daripada {users.length} pengguna
          </div>
          {loading ? (
            <p className="text-center text-gray-400 py-10">Memuatkan...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Tiada pengguna dijumpai</p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden divide-y">
                {filtered.map(user => (
                  <div key={user.id} className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="font-medium text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {user.employee_id} · <span className={`font-medium ${user.role === 'admin' ? 'text-purple-600' : user.role === 'manager' ? 'text-yellow-600' : 'text-blue-600'}`}>{roleLabel(user.role)}</span>
                          {user.department ? ` · ${user.department}` : ''}
                        </p>
                        {user.manager_name && <p className="text-xs text-gray-400">Pengurus: {user.manager_name}</p>}
                        <p className="text-xs text-gray-400">Cuti: {user.pto_balance}j</p>
                      </div>
                      <button onClick={() => handleToggle(user)} className={`px-2 py-1 rounded text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {user.is_active ? '✅ Aktif' : '🔴 Tidak Aktif'}
                      </button>
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => openEdit(user)} className="text-xs text-gray-600 hover:underline">✏️ Edit</button>
                      <button onClick={() => { setResetTarget(user); setNewPassword(''); }} className="text-xs text-blue-600 hover:underline">🔑 Reset PW</button>
                      <button onClick={() => handleDelete(user)} className="text-xs text-red-500 hover:underline">🗑️ Padam</button>
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
                      <th className="p-3 text-left text-gray-500 font-medium">ID / Jabatan</th>
                      <th className="p-3 text-left text-gray-500 font-medium">Peranan</th>
                      <th className="p-3 text-left text-gray-500 font-medium">Pengurus</th>
                      <th className="p-3 text-left text-gray-500 font-medium">Cuti (j)</th>
                      <th className="p-3 text-left text-gray-500 font-medium">Status</th>
                      <th className="p-3 text-left text-gray-500 font-medium">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(user => (
                      <tr key={user.id} className="border-t hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium text-gray-800">{user.name}</div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-gray-600">{user.employee_id}</div>
                          {user.department && <div className="text-xs text-gray-400">{user.department}</div>}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleBadge(user.role)}`}>{roleLabel(user.role)}</span>
                        </td>
                        <td className="p-3 text-gray-500 text-xs">{user.manager_name ?? '—'}</td>
                        <td className="p-3 text-gray-600">{user.pto_balance}</td>
                        <td className="p-3">
                          <button onClick={() => handleToggle(user)} className={`px-2 py-0.5 rounded text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                            {user.is_active ? '✅ Aktif' : '🔴 Tidak Aktif'}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(user)} className="text-xs text-gray-600 hover:text-gray-900 hover:underline">✏️ Edit</button>
                            <button onClick={() => { setResetTarget(user); setNewPassword(''); }} className="text-xs text-blue-600 hover:underline">🔑 PW</button>
                            <button onClick={() => handleDelete(user)} className="text-xs text-red-500 hover:underline">🗑️</button>
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
