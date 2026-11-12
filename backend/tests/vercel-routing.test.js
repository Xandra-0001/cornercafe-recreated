import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeVercelApiUrl } from '../src/utils/vercel-routing.js';

test('Vercel admin aliases map one-segment function paths to the Express API paths', () => {
  assert.equal(normalizeVercelApiUrl('/api/admin-auth?action=login'), '/api/admin/auth?action=login');
  assert.equal(normalizeVercelApiUrl('/admin-reservations?status=pending'), '/api/admin/reservations?status=pending');
  assert.equal(normalizeVercelApiUrl('/api/admin-auth-logout'), '/api/admin/auth/logout');
  assert.equal(normalizeVercelApiUrl('/api/admin-auth-password'), '/api/admin/auth/password');
});

test('Vercel API URL normalization leaves existing endpoints and queries intact', () => {
  assert.equal(normalizeVercelApiUrl('/api/availability?date=2026-11-20&partySize=2'), '/api/availability?date=2026-11-20&partySize=2');
  assert.equal(normalizeVercelApiUrl('/health'), '/api/health');
});
