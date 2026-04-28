import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl, fetchPublicAppInfo } from '../lib/api';

type GoogleUser = { id: string; name: string; role: string; employee_id: string; email: string };

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [officeName, setOfficeName] = useState('Memuatkan...');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();

  useEffect(() => {
    void fetchPublicAppInfo().then((info) => setOfficeName(info.officeName)).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const googleUser  = params.get('google_user');
    const googleError = params.get('google_error');
    const email       = params.get('email');

    if (googleUser) {
      try {
        const user = JSON.parse(decodeURIComponent(googleUser)) as GoogleUser;
        loginWithGoogle(user);
        window.history.replaceState({}, '', '/login');
      } catch {
        setError('Ralat membaca data Google. Cuba lagi.');
      }
    } else if (googleError) {
      const messages: Record<string, string> = {
        cancelled:      'Log masuk Google dibatalkan.',
        invalid_state:  'Sesi tidak sah. Cuba lagi.',
        expired:        'Sesi tamat masa. Cuba lagi.',
        google_failed:  'Gagal mengesahkan dengan Google.',
        not_registered: `Akaun Google (${email ?? ''}) tidak didaftarkan dalam sistem ini.`,
      };
      setError(messages[googleError] ?? `Ralat: ${googleError}`);
      window.history.replaceState({}, '', '/login');
    }
  }, [loginWithGoogle]);

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    window.location.href = apiUrl('/api/auth/google/login-start');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      // No navigate() here — AppRoutes auto-redirects once user state is committed
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="bg-blue-600 px-6 py-8 text-center text-white">
          <div className="text-4xl mb-2">🏥</div>
          <h1 className="text-2xl font-bold">E-Attendance</h1>
          <p className="text-blue-200 text-sm mt-1">{officeName}</p>
        </div>
        <div className="px-6 pt-6 pb-2 space-y-3">
          {/* Google Sign-in */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            {googleLoading ? (
              <span className="text-sm text-gray-500">Memuatkan...</span>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm">Log masuk dengan Google</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">atau guna email & password</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="email@contoh.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">
              ❌ {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {loading ? 'Log masuk...' : 'Log Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
