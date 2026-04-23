import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminQR from './pages/AdminQR';
import AdminUsers from './pages/AdminUsers';
import AdminReports from './pages/AdminReports';
import AttendPage from './pages/AttendPage';
import ManagerDashboard from './pages/ManagerDashboard';
import TimesheetPage from './pages/TimesheetPage';
import PTOPage from './pages/PTOPage';

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

function homeForRole(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'manager') return '/manager';
  if (role === 'employee') return '/';
  return '/login';
}

function isKnownRole(role?: string): role is 'employee' | 'manager' | 'admin' {
  return role === 'employee' || role === 'manager' || role === 'admin';
}

function PrivateRoute({ children, allowedRoles }: { children: ReactElement; allowedRoles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center p-8 text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isKnownRole(user.role)) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
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
      <Route path="/login" element={!user || !isKnownRole(user.role) ? <Login /> : <Navigate to={homeForRole(user.role)} replace />} />

      {/* Employee */}
      <Route path="/" element={
        <PrivateRoute allowedRoles={['employee']}>
          <EmployeeDashboard />
        </PrivateRoute>
      } />
      <Route path="/timesheet" element={
        <PrivateRoute allowedRoles={['employee', 'manager', 'admin']}>
          <TimesheetPage />
        </PrivateRoute>
      } />
      <Route path="/pto" element={
        <PrivateRoute allowedRoles={['employee', 'manager', 'admin']}>
          <PTOPage />
        </PrivateRoute>
      } />

      {/* Manager */}
      <Route path="/manager" element={
        <PrivateRoute allowedRoles={['manager', 'admin']}>
          <ManagerDashboard />
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
      <Route path="/admin/reports" element={
        <PrivateRoute allowedRoles={['admin']}>
          <AdminReports />
        </PrivateRoute>
      } />

      <Route path="*" element={<Navigate to={user && isKnownRole(user.role) ? homeForRole(user.role) : '/login'} replace />} />
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
