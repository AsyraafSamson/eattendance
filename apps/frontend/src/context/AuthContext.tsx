import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type User = {
  id: string;
  name: string;
  role: string;
  employee_id: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (token: string, user: User) => void;
  logout: () => void;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isStoredUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.role === 'string' &&
    ['employee', 'manager', 'admin'].includes(candidate.role) &&
    typeof candidate.employee_id === 'string'
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        const parsedUser: unknown = JSON.parse(storedUser);

        if (isStoredUser(parsedUser)) {
          setToken(storedToken);
          setUser(parsedUser);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  const loginWithGoogle = (googleToken: string, googleUser: User) => {
    setToken(googleToken);
    setUser(googleUser);
    localStorage.setItem('token', googleToken);
    localStorage.setItem('user', JSON.stringify(googleUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
