import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component, ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminQR from './pages/AdminQR';
import AdminUsers from './pages/AdminUsers';
import AttendPage from './pages/AttendPage';

// Catch any React render crash — shows error instead of blank white page
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-8">
          <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-xl font-bold text-red-600 mb-2">Ralat Aplikasi</h1>
            <p className="text-sm text-gray-500 mb-4 font-mono break-all">{this.state.error}</p>
            <button
              onClick={() => window.location.href = '/login'}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Kembali ke Login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PrivateRoute({ children, allowedRoles }: { children: JSX.Element; allowedRoles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center p-8 text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center p-8 text-gray-500">Loading...</div>;

  return (
    <Routes>
      {/* Public — QR scan page, no login needed */}
      <Route path="/attend" element={<AttendPage />} />

      {/* Auth */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />} />

      {/* Employee */}
      <Route path="/" element={
        <PrivateRoute allowedRoles={['employee']}>
          <EmployeeDashboard />
        </PrivateRoute>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <PrivateRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </PrivateRoute>
      } />
      <Route path="/admin/qr" element={
        <PrivateRoute allowedRoles={['admin']}>
          <AdminQR />
        </PrivateRoute>
      } />
      <Route path="/admin/users" element={
        <PrivateRoute allowedRoles={['admin']}>
          <AdminUsers />
        </PrivateRoute>
      } />

      <Route path="*" element={<Navigate to={user?.role === 'admin' ? '/admin' : '/login'} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
