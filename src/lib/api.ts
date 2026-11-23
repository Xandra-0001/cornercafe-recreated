let csrfToken: string | null = null;

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBase = (configuredBase || (import.meta.env.DEV ? 'http://localhost:8787' : '')).replace(/\/+$/, '');
const vercelFunctionPaths: Record<string, string> = {
  '/api/admin/auth': '/api/admin-auth',
  '/api/admin/auth/logout': '/api/admin-auth-logout',
  '/api/admin/auth/password': '/api/admin-auth-password',
  '/api/admin/reservations': '/api/admin-reservations',
  '/api/admin/tables': '/api/admin-tables',
  '/api/admin/reservation': '/api/admin-reservation',
  '/api/admin/users': '/api/admin-users',
  '/api/admin/user': '/api/admin-user',
};

function resolveRequestPath(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.DEV || configuredBase) return normalized;
  const queryIndex = normalized.indexOf('?');
  const pathname = queryIndex < 0 ? normalized : normalized.slice(0, queryIndex);
  const search = queryIndex < 0 ? '' : normalized.slice(queryIndex);
  return `${vercelFunctionPaths[pathname] || pathname}${search}`;
}

export function setCsrfToken(value: string | null) {
  csrfToken = value;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // In production, a blank base keeps requests same-origin and routes them to Vercel Functions.
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  const headers = new Headers(init.headers);
  const method = (init.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  try {
    return await fetch(apiBase + resolveRequestPath(path), {
      ...init,
      method,
      headers,
      credentials: 'include',
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The reservation service took too long to respond. Please try again.');
    }
    throw new Error('The reservation service could not be reached. Check your connection and try again.');
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function apiJson<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload
      && typeof payload.error === 'object' && payload.error !== null && 'message' in payload.error
      && typeof payload.error.message === 'string'
      ? payload.error.message
      : 'The request could not be completed. Please try again.';
    throw new Error(message);
  }
  if (!payload || typeof payload !== 'object') throw new Error('The reservation service returned an invalid response.');
  return payload as T;
}
