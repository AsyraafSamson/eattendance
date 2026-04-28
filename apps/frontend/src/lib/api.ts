import { API_URL } from '../config';

export type PublicAppInfo = {
  officeName: string;
  devMode: boolean;
};

export function apiUrl(path: string) {
  return path.startsWith('http://') || path.startsWith('https://') ? path : `${API_URL}${path}`;
}

export async function apiFetch(path: string, options: RequestInit & { token?: string | null } = {}) {
  // token param accepted for call-site compatibility but ignored — auth is via httpOnly cookie
  const { token: _ignored, headers, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();
  const mergedHeaders = new Headers(headers ?? {});

  if (!mergedHeaders.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    mergedHeaders.set('Content-Type', 'application/json');
  }

  return fetch(apiUrl(path), { ...rest, headers: mergedHeaders, credentials: 'include' });
}

export async function fetchPublicAppInfo(): Promise<PublicAppInfo> {
  const response = await apiFetch('/api/attend/info');
  if (!response.ok) {
    throw new Error('Gagal mendapatkan maklumat aplikasi');
  }
  return response.json() as Promise<PublicAppInfo>;
}
