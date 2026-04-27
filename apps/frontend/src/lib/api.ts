import { API_URL } from '../config';

export type PublicAppInfo = {
  officeName: string;
  devMode: boolean;
};

export function apiUrl(path: string) {
  return path.startsWith('http://') || path.startsWith('https://') ? path : `${API_URL}${path}`;
}

export function authHeaders(token: string | null, headers?: HeadersInit) {
  const merged = new Headers(headers);
  if (token) {
    merged.set('Authorization', `Bearer ${token}`);
  }
  return merged;
}

export async function apiFetch(path: string, options: RequestInit & { token?: string | null } = {}) {
  const { token = null, headers, ...rest } = options;
  const mergedHeaders = authHeaders(token, headers);
  const method = (rest.method ?? 'GET').toUpperCase();

  if (!mergedHeaders.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    mergedHeaders.set('Content-Type', 'application/json');
  }

  return fetch(apiUrl(path), { ...rest, headers: mergedHeaders });
}

export async function fetchPublicAppInfo(): Promise<PublicAppInfo> {
  const response = await apiFetch('/api/attend/info');
  if (!response.ok) {
    throw new Error('Gagal mendapatkan maklumat aplikasi');
  }
  return response.json() as Promise<PublicAppInfo>;
}
