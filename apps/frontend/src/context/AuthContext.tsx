import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiFetch } from '../lib/api';

type User = {
  id: string;
  name: string;
  role: string;
  employee_id: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (user: User) => void;
  logout: () => void;
};

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore user info from localStorage — auth itself is via httpOnly cookie
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser: unknown = JSON.parse(storedUser);
        if (isStoredUser(parsedUser)) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem('user');
        }
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    // Server sets httpOnly cookie — we only store non-sensitive user info
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  const loginWithGoogle = (googleUser: User) => {
    // Server has already set the httpOnly cookie via redirect
    setUser(googleUser);
    localStorage.setItem('user', JSON.stringify(googleUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    // Clear server-side cookie
    void apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
