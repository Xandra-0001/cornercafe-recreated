const API_ROUTE_ALIASES = new Map([
  ['/api/admin-auth', '/api/admin/auth'],
  ['/api/admin-auth-logout', '/api/admin/auth/logout'],
  ['/api/admin-auth-password', '/api/admin/auth/password'],
  ['/api/admin-reservations', '/api/admin/reservations'],
  ['/api/admin-tables', '/api/admin/tables'],
  ['/api/admin-reservation', '/api/admin/reservation'],
  ['/api/admin-users', '/api/admin/users'],
  ['/api/admin-user', '/api/admin/user'],
]);

export function normalizeVercelApiUrl(rawUrl) {
  const requestUrl = new URL(rawUrl || '/', 'https://vercel.invalid');
  if (!requestUrl.pathname.startsWith('/api/')) {
    requestUrl.pathname = `/api${requestUrl.pathname.startsWith('/') ? '' : '/'}${requestUrl.pathname}`;
  }
  requestUrl.pathname = API_ROUTE_ALIASES.get(requestUrl.pathname) || requestUrl.pathname;
  return `${requestUrl.pathname}${requestUrl.search}`;
}
