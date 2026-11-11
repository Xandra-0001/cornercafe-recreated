import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from '@vercel/blob';
import { INITIAL_TABLES, MENU_ITEMS, TIME_SLOTS } from './data/cafeData.js';

const scryptAsync = promisify(scrypt);
const DATABASE_PATH = 'corner-cafe/state-v1.json';
const SESSION_COOKIE = 'corner_cafe_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const MAX_STATE_WRITE_ATTEMPTS = 10;

function emptyState() {
  return {
    version: 1,
    admins: [],
    sessions: [],
    bookings: [],
    tables: INITIAL_TABLES.map((table) => ({ ...table, isAvailable: true })),
    loginFailures: {},
  };
}

function migrateTableLayout(state) {
  const savedTables = Array.isArray(state.tables) ? state.tables : [];
  const savedById = new Map(savedTables.map((table) => [table.id, table]));
  const defaultsById = new Map(INITIAL_TABLES.map((table) => [table.id, table]));

  state.tables = [
    ...INITIAL_TABLES.map((table) => ({
      ...table,
      ...(savedById.get(table.id) || {}),
      zone: table.zone,
      floor: table.floor,
    })),
    ...savedTables.filter((table) => !defaultsById.has(table.id)),
  ];

  state.bookings = state.bookings.map((booking) => {
    const defaultTable = defaultsById.get(booking.table?.id);
    return defaultTable
      ? { ...booking, table: { ...defaultTable, ...booking.table, zone: defaultTable.zone, floor: defaultTable.floor } }
      : booking;
  });
  return state;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isWriteConflict(error) {
  return error instanceof BlobPreconditionFailedError
    || /Precondition failed: ETag mismatch/i.test(String(error?.message || ''))
    || error?.name === 'BlobPreconditionFailedError'
    || error?.code === 'BlobPreconditionFailedError'
    || error?.status === 412
    || error?.statusCode === 412;
}

async function readState() {
  let metadata;
  try {
    metadata = await head(DATABASE_PATH);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { state: emptyState(), etag: null };
    throw error;
  }

  const stored = await get(DATABASE_PATH, { access: 'private', useCache: false });
  if (!stored || stored.statusCode !== 200 || !stored.stream) {
    return { state: emptyState(), etag: null };
  }

  const text = await new Response(stored.stream).text();
  const state = JSON.parse(text);
  if (!state || state.version !== 1 || !Array.isArray(state.admins) || !Array.isArray(state.bookings)) {
    throw new Error('Stored cafe data has an unsupported format.');
  }
  return { state: migrateTableLayout(state), etag: metadata.etag };
}

async function writeState(state, etag) {
  const options = {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: Boolean(etag),
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 0,
  };
  if (etag) options.ifMatch = etag;
  await put(DATABASE_PATH, JSON.stringify(state), options);
}

async function mutateState(mutator) {
  let conflictLogged = false;
  for (let attempt = 0; attempt < MAX_STATE_WRITE_ATTEMPTS; attempt += 1) {
    const { state, etag } = await readState();
    const result = await mutator(state);
    try {
      await writeState(state, etag);
      return result;
    } catch (error) {
      if (!isWriteConflict(error)) throw error;
      if (!conflictLogged) {
        conflictLogged = true;
        try {
          const latestEtag = (await head(DATABASE_PATH)).etag;
          console.warn('Cafe Blob write conflict', {
            attempt: attempt + 1,
            hasReadEtag: Boolean(etag),
            readEtagLength: etag?.length || 0,
            readEtagQuoted: Boolean(etag?.startsWith('"') && etag.endsWith('"')),
            latestEtagLength: latestEtag?.length || 0,
            latestEtagQuoted: Boolean(latestEtag?.startsWith('"') && latestEtag.endsWith('"')),
            readMatchesLatest: etag === latestEtag,
          });
        } catch (diagnosticError) {
          console.warn('Cafe Blob ETag diagnostic failed:', diagnosticError?.message || 'unknown error');
        }
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(160, 8 * (2 ** attempt))));
    }
  }
  const error = new Error('The booking data changed repeatedly. Please try again.');
  error.statusCode = 503;
  throw error;
}

function send(res, status, value, headers = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [name, content] of Object.entries(headers)) res.setHeader(name, content);
  res.status(status).json(value);
}

function fail(res, status, code, message) {
  send(res, status, { error: { code, message } });
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return {};
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }).filter(([key]) => key));
}

function secureCookie(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  return process.env.VERCEL_ENV === 'production' || forwardedProto === 'https';
}

function sessionCookie(req, token) {
  const secure = secureCookie(req) ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`;
}

function clearSessionCookie(req) {
  const secure = secureCookie(req) ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function verifySameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const requestHost = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    return new URL(origin).host.toLowerCase() === String(requestHost || '').toLowerCase();
  } catch {
    return false;
  }
}

function normalizedEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function makePassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString('hex')}$${Buffer.from(key).toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, cost, saltHex, keyHex] = String(stored || '').split('$');
  if (algorithm !== 'scrypt' || cost !== '16384' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = Buffer.from(await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 }));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function currentAdmin(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const { state } = await readState();
  const session = state.sessions.find((item) => item.tokenHash === hash(token) && Date.parse(item.expiresAt) > Date.now());
  if (!session) return null;
  const admin = state.admins.find((item) => item.id === session.adminId && item.isActive);
  if (!admin) return null;
  return { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
}

function requireMethod(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  fail(res, 405, 'METHOD_NOT_ALLOWED', `Use ${methods.join(' or ')} for this endpoint.`);
  return false;
}

function parseDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function timeInMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(value || ''));
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(match[2]);
}

function slotsOverlap(first, second) {
  const a = timeInMinutes(first);
  const b = timeInMinutes(second);
  return a !== null && b !== null && a < b + 90 && b < a + 90;
}

function tableHasConflict(bookings, date, slot, tableId, exceptId = null) {
  return bookings.some((booking) => booking.id !== exceptId
    && booking.date === date
    && booking.table?.id === tableId
    && booking.status !== 'cancelled'
    && slotsOverlap(booking.timeSlot, slot));
}

function activeReservationForSlot(bookings, date, slot, tableId) {
  return bookings.find((booking) => booking.date === date
    && booking.table?.id === tableId
    && booking.status !== 'cancelled'
    && slotsOverlap(booking.timeSlot, slot));
}

function requestIp(req) {
  return String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim().slice(0, 80);
}

function statusForSlot(bookings, date, slot, table) {
  return !tableHasConflict(bookings, date, slot, table.id);
}

async function handleLogin(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  if (!verifySameOrigin(req)) return fail(res, 403, 'ORIGIN_REJECTED', 'Request origin was not accepted.');
  const body = parseBody(req);
  const email = normalizedEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!validEmail(email) || password.length > 128) return fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password was not recognised.');

  const { state } = await readState();
  const limiterKey = hash(`${requestIp(req)}|${email}`);
  const recentFailures = (state.loginFailures[limiterKey] || []).filter((timestamp) => Date.now() - timestamp < LOGIN_WINDOW_MS);
  if (recentFailures.length >= MAX_LOGIN_ATTEMPTS) return fail(res, 429, 'LOGIN_RATE_LIMITED', 'Too many attempts. Wait 15 minutes and try again.');

  const admin = state.admins.find((item) => item.email === email && item.isActive);
  const passwordMatches = admin ? await verifyPassword(password, admin.passwordHash) : false;
  if (!passwordMatches) {
    await mutateState((current) => {
      const failures = (current.loginFailures[limiterKey] || []).filter((timestamp) => Date.now() - timestamp < LOGIN_WINDOW_MS);
      current.loginFailures[limiterKey] = [...failures, Date.now()].slice(-MAX_LOGIN_ATTEMPTS);
      return null;
    });
    return fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password was not recognised.');
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const session = { id: randomUUID(), adminId: admin.id, tokenHash: hash(token), expiresAt, createdAt: new Date().toISOString() };
  await mutateState((current) => {
    current.sessions = current.sessions.filter((item) => Date.parse(item.expiresAt) > Date.now() && item.adminId !== admin.id);
    current.sessions.push(session);
    delete current.loginFailures[limiterKey];
    return null;
  });
  send(res, 200, { admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } }, { 'Set-Cookie': sessionCookie(req, token) });
}

async function handleSession(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const admin = await currentAdmin(req);
  if (!admin) return fail(res, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
  send(res, 200, { admin });
}

async function handleLogout(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  if (!verifySameOrigin(req)) return fail(res, 403, 'ORIGIN_REJECTED', 'Request origin was not accepted.');
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) {
    const tokenHash = hash(token);
    await mutateState((state) => {
      state.sessions = state.sessions.filter((session) => session.tokenHash !== tokenHash);
      return null;
    });
  }
  send(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
}

function safeBooking(booking) {
  const { customerName, customerPhone, customerEmail, specialRequests, ...publicFields } = booking;
  return { ...publicFields, customerName };
}

function normalizePreOrders(value) {
  if (!Array.isArray(value)) return [];
  if (value.length > 20) throw Object.assign(new Error('Too many pre-order items.'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  return value.map((entry) => {
    const itemId = entry?.item?.id || entry?.menuItemId || entry?.id;
    const quantity = Number(entry?.quantity);
    const item = MENU_ITEMS.find((menuItem) => menuItem.id === itemId);
    if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw Object.assign(new Error('A pre-order item or quantity is invalid.'), { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    return { item, quantity };
  });
}

async function createReservation(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  if (!verifySameOrigin(req)) return fail(res, 403, 'ORIGIN_REJECTED', 'Request origin was not accepted.');
  const body = parseBody(req);
  const date = body.date;
  const timeSlot = body.timeSlot;
  const partySize = Number(body.partySize);
  const tableId = body.table?.id || body.tableId;
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
  const customerEmail = normalizedEmail(body.customerEmail);
  const specialRequests = typeof body.specialRequests === 'string' ? body.specialRequests.trim().slice(0, 1000) : '';
  if (!parseDate(date) || date < new Date().toISOString().slice(0, 10)
    || !TIME_SLOTS.includes(timeSlot) || !Number.isInteger(partySize) || partySize < 1 || partySize > 8
    || !tableId || customerName.length < 2 || customerName.length > 100
    || (!customerPhone && !validEmail(customerEmail)) || customerPhone.length > 40) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Check the date, time, party size, seating, and guest contact details.');
  }

  let preOrders;
  try { preOrders = normalizePreOrders(body.preOrders); }
  catch (error) { return fail(res, error.statusCode || 400, error.code || 'VALIDATION_ERROR', error.message); }

  const result = await mutateState((state) => {
    const table = state.tables.find((item) => item.id === tableId && item.isActive !== false);
    if (!table) return { error: 'TABLE_NOT_FOUND' };
    if (table.capacity < partySize) return { error: 'TABLE_CAPACITY' };
    if (tableHasConflict(state.bookings, date, timeSlot, tableId)) return { error: 'SLOT_UNAVAILABLE' };
    let referenceNumber;
    do { referenceNumber = `CC-${randomBytes(5).toString('hex').toUpperCase()}`; }
    while (state.bookings.some((item) => item.referenceNumber === referenceNumber));
    const booking = {
      id: randomUUID(), referenceNumber, date, timeSlot, partySize,
      table: { ...table, isAvailable: true }, preOrders,
      customerName, customerPhone, customerEmail, specialRequests,
      status: 'pending', createdAt: new Date().toISOString(),
    };
    state.bookings.unshift(booking);
    return { booking };
  });
  if (result.error === 'SLOT_UNAVAILABLE') return fail(res, 409, result.error, 'That table is no longer available at this time. Choose another slot.');
  if (result.error === 'TABLE_CAPACITY') return fail(res, 409, result.error, 'That table is too small for your party.');
  if (result.error) return fail(res, 404, result.error, 'That table is unavailable. Refresh the seating map and try again.');
  send(res, 201, result);
}

async function handleAvailability(req, res, url) {
  if (!requireMethod(req, res, ['GET'])) return;
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const partySize = Number(url.searchParams.get('partySize') || 2);
  if (!parseDate(date) || !Number.isInteger(partySize) || partySize < 1 || partySize > 8) {
    return fail(res, 400, 'VALIDATION_ERROR', 'A valid date and party size are required.');
  }
  const { state } = await readState();
  const tableId = url.searchParams.get('tableId');
  if (tableId) {
    const table = state.tables.find((item) => item.id === tableId && item.capacity >= partySize && item.isActive !== false);
    if (!table) return fail(res, 404, 'TABLE_NOT_FOUND', 'That table is not available for this party size.');
    const availableSlots = TIME_SLOTS.filter((slot) => !tableHasConflict(state.bookings, date, slot, tableId));
    return send(res, 200, { date, partySize, tableId, availableSlots });
  }
  const tables = state.tables.filter((table) => table.isActive !== false).map((table) => ({
    ...table,
    isAvailable: TIME_SLOTS.some((slot) => !tableHasConflict(state.bookings, date, slot, table.id)),
  }));
  send(res, 200, { date, partySize, tables });
}

async function handlePublicReference(req, res, reference) {
  if (!requireMethod(req, res, ['GET'])) return;
  const { state } = await readState();
  const booking = state.bookings.find((item) => item.referenceNumber === reference);
  if (!booking) return fail(res, 404, 'RESERVATION_NOT_FOUND', 'No reservation matches that reference.');
  send(res, 200, { referenceNumber: booking.referenceNumber, date: booking.date, timeSlot: booking.timeSlot, partySize: booking.partySize, table: { id: booking.table.id, zone: booking.table.zone }, status: booking.status, customerName: booking.customerName });
}

function ownerOnly(res, admin) {
  if (admin.role === 'owner') return true;
  fail(res, 403, 'FORBIDDEN', 'An owner account is required for team management.');
  return false;
}

async function adminReservations(req, res, url, admin) {
  if (!requireMethod(req, res, ['GET'])) return;
  const { state } = await readState();
  const date = url.searchParams.get('date') || '';
  const status = url.searchParams.get('status') || 'all';
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();
  const bookings = state.bookings.filter((booking) => (!date || booking.date === date)
    && (status === 'all' || booking.status === status)
    && (!search || booking.customerName.toLowerCase().includes(search)
      || booking.referenceNumber.toLowerCase().includes(search)
      || booking.table.id.toLowerCase().includes(search)))
    .map((booking) => ({ ...booking, table: { ...booking.table, isAvailable: true } }));
  send(res, 200, { bookings, admin: { id: admin.id, email: admin.email, role: admin.role } });
}

async function updateReservation(req, res, bookingId) {
  if (!requireMethod(req, res, ['PATCH'])) return;
  if (!verifySameOrigin(req)) return fail(res, 403, 'ORIGIN_REJECTED', 'Request origin was not accepted.');
  const body = parseBody(req);
  if (!['confirmed', 'cancelled'].includes(body.status)) return fail(res, 400, 'VALIDATION_ERROR', 'Choose confirmed or cancelled.');
  const admin = await currentAdmin(req);
  if (!admin) return fail(res, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
  const result = await mutateState((state) => {
    const booking = state.bookings.find((item) => item.id === bookingId);
    if (!booking) return { error: 'RESERVATION_NOT_FOUND' };
    if (body.status === 'confirmed' && tableHasConflict(state.bookings, booking.date, booking.timeSlot, booking.table.id, booking.id)) {
      return { error: 'SLOT_UNAVAILABLE' };
    }
    booking.status = body.status;
    booking.reviewedBy = admin.id;
    booking.reviewedAt = new Date().toISOString();
    booking.updatedAt = booking.reviewedAt;
    return { booking };
  });
  if (result.error === 'RESERVATION_NOT_FOUND') return fail(res, 404, result.error, 'Reservation was not found.');
  if (result.error === 'SLOT_UNAVAILABLE') return fail(res, 409, result.error, 'Another reservation now conflicts with this table and time.');
  send(res, 200, result);
}

async function adminTables(req, res, url) {
  if (!requireMethod(req, res, ['GET'])) return;
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const slot = url.searchParams.get('timeSlot');
  const { state } = await readState();
  const tables = state.tables.map((table) => ({
    ...table,
    isAvailable: slot
      ? statusForSlot(state.bookings, date, slot, table)
      : TIME_SLOTS.some((time) => statusForSlot(state.bookings, date, time, table)),
  }));
  send(res, 200, { date, tables });
}

async function adminUsers(req, res, admin) {
  if (!ownerOnly(res, admin)) return;
  if (req.method === 'GET') {
    const { state } = await readState();
    return send(res, 200, { admins: state.admins.map(({ id, name, email, role, isActive, createdAt }) => ({ id, name, email, role, isActive, createdAt })) });
  }
  if (!requireMethod(req, res, ['POST'])) return;
  if (!verifySameOrigin(req)) return fail(res, 403, 'ORIGIN_REJECTED', 'Request origin was not accepted.');
  const body = parseBody(req);
  const email = normalizedEmail(body.email);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!validEmail(email) || name.length < 2 || name.length > 100 || password.length < 12 || password.length > 128) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Enter a valid email, name, and password of at least 12 characters.');
  }
  const passwordHash = await makePassword(password);
  const result = await mutateState((state) => {
    if (state.admins.some((item) => item.email === email)) return { error: 'EMAIL_EXISTS' };
    const user = { id: randomUUID(), name, email, role: 'staff', passwordHash, isActive: true, createdAt: new Date().toISOString() };
    state.admins.push(user);
    return { admin: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt } };
  });
  if (result.error) return fail(res, 409, result.error, 'An account with this email already exists.');
  send(res, 201, result);
}

async function updateAdmin(req, res, targetId, admin) {
  if (!ownerOnly(res, admin)) return;
  if (!requireMethod(req, res, ['PATCH'])) return;
  if (!verifySameOrigin(req)) return fail(res, 403, 'ORIGIN_REJECTED', 'Request origin was not accepted.');
  const body = parseBody(req);
  if (typeof body.isActive !== 'boolean') return fail(res, 400, 'VALIDATION_ERROR', 'Provide an active or inactive account status.');
  if (targetId === admin.id && !body.isActive) return fail(res, 400, 'VALIDATION_ERROR', 'You cannot deactivate your own account.');
  const result = await mutateState((state) => {
    const target = state.admins.find((item) => item.id === targetId);
    if (!target) return { error: 'ADMIN_NOT_FOUND' };
    target.isActive = body.isActive;
    if (!target.isActive) state.sessions = state.sessions.filter((session) => session.adminId !== target.id);
    return { admin: { id: target.id, name: target.name, email: target.email, role: target.role, isActive: target.isActive } };
  });
  if (result.error) return fail(res, 404, result.error, 'Account was not found.');
  send(res, 200, result);
}

async function requireAdmin(req, res) {
  const admin = await currentAdmin(req);
  if (!admin) {
    fail(res, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
    return null;
  }
  return admin;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const url = new URL(req.url || '/api', `https://${req.headers.host || 'localhost'}`);
    const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const route = segments.join('/');

    if (route === 'health' && req.method === 'GET') {
      await readState();
      return send(res, 200, { ok: true, service: 'corner-cafe-api', storage: 'private-blob' });
    }
    if (route === 'admin/auth') {
      const action = url.searchParams.get('action');
      if (action === 'login') return await handleLogin(req, res);
      if (action === 'session') return await handleSession(req, res);
      if (action === 'logout') return await handleLogout(req, res);
      return fail(res, 404, 'NOT_FOUND', 'Authentication action was not found.');
    }
    if (route === 'availability') return await handleAvailability(req, res, url);
    if (route === 'reservations' && req.method === 'POST') return await createReservation(req, res);
    if (route === 'reservation-status') return await handlePublicReference(req, res, url.searchParams.get('reference') || '');
    if (segments[0] === 'reservations' && segments.length === 2) return await handlePublicReference(req, res, segments[1]);

    if (route.startsWith('admin/')) {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      if (route === 'admin/reservations') return await adminReservations(req, res, url, admin);
      if (route === 'admin/reservation') return await updateReservation(req, res, url.searchParams.get('id') || '');
      if (segments[1] === 'reservations' && segments.length === 3) return await updateReservation(req, res, segments[2]);
      if (route === 'admin/tables') return await adminTables(req, res, url);
      if (route === 'admin/users') return await adminUsers(req, res, admin);
      if (route === 'admin/user') return await updateAdmin(req, res, url.searchParams.get('id') || '', admin);
      if (segments[1] === 'users' && segments.length === 3) return await updateAdmin(req, res, segments[2], admin);
    }

    return fail(res, 404, 'NOT_FOUND', 'API route was not found.');
  } catch (error) {
    console.error('Cafe API error:', error?.message || error);
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    return fail(res, status, 'INTERNAL_ERROR', status === 503 ? error.message : 'The request could not be completed. Try again.');
  }
}
