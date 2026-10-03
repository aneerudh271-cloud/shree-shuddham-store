import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDatabase } from './db.js';
import { send, validateOrigin } from './http.js';

const COOKIE_NAME = 'ss_admin_session';
const SESSION_SECONDS = 60 * 60 * 8;

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqual(left, right) {
  const leftBytes = Buffer.from(String(left));
  const rightBytes = Buffer.from(String(right));
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function cookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map((piece) => {
    const separator = piece.indexOf('=');
    if (separator < 0) return ['', ''];
    try {
      return [piece.slice(0, separator).trim(), decodeURIComponent(piece.slice(separator + 1).trim())];
    } catch {
      return ['', ''];
    }
  }).filter(([name]) => name));
}

function cookieHeader(value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

export async function seedAdmin(db) {
  const admins = db.collection('admin_users');
  const existing = await admins.findOne({ key: 'primary' });
  if (existing) return existing;
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!username || !passwordHash || !/^\$2[aby]\$/.test(passwordHash)) {
    throw new Error('Configure ADMIN_USERNAME and a bcrypt ADMIN_PASSWORD_HASH before enabling admin access.');
  }
  const admin = { key: 'primary', username, passwordHash, createdAt: new Date(), updatedAt: new Date() };
  try {
    await admins.insertOne(admin);
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return admins.findOne({ key: 'primary' });
}

export async function createAdminSession(req, res, username, password) {
  validateOrigin(req);
  const db = await getDatabase();
  const admin = await seedAdmin(db);
  const now = new Date();
  const clientIp = createHash('sha256')
    .update(String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim().slice(0, 128))
    .digest('hex');
  const limits = db.collection('login_limits');
  const attempt = await limits.findOne({ key: clientIp });
  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    const error = new Error('Too many sign-in attempts. Try again later.');
    error.status = 429;
    throw error;
  }
  if (!attempt
    || now.getTime() - new Date(attempt.windowStart).getTime() > 15 * 60 * 1000
    || (attempt.lockedUntil && attempt.lockedUntil <= now)) {
    await limits.updateOne(
      { key: clientIp },
      { $set: { windowStart: now, count: 0, lockedUntil: null, expiresAt: new Date(now.getTime() + 30 * 60 * 1000) } },
      { upsert: true }
    );
  }
  const match = safeEqual(username, admin.username) && await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    await limits.updateOne(
      { key: clientIp },
      { $inc: { count: 1 }, $set: { expiresAt: new Date(now.getTime() + 30 * 60 * 1000) }, $setOnInsert: { windowStart: now } },
      { upsert: true }
    );
    const updated = await limits.findOne({ key: clientIp });
    const count = updated?.count || 1;
    if (count >= 8) {
      const lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
      await limits.updateOne({ key: clientIp }, { $set: { lockedUntil, expiresAt: lockedUntil } });
    }
    const error = new Error('Admin ID or password is incorrect.');
    error.status = 401;
    throw error;
  }
  await limits.deleteOne({ key: clientIp });
  const token = randomBytes(32).toString('base64url');
  await db.collection('admin_sessions').insertOne({
    tokenHash: tokenHash(token),
    username: admin.username,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000)
  });
  send(res, 200, { ok: true, username: admin.username }, { 'Set-Cookie': cookieHeader(token, SESSION_SECONDS) });
}

export async function requireAdmin(req, res) {
  const token = cookies(req)[COOKIE_NAME];
  if (!token) {
    send(res, 401, { error: 'Sign in is required.' });
    return null;
  }
  const db = await getDatabase();
  const session = await db.collection('admin_sessions').findOne({
    tokenHash: tokenHash(token),
    expiresAt: { $gt: new Date() }
  });
  if (!session) {
    send(res, 401, { error: 'Your admin session has expired. Sign in again.' }, { 'Set-Cookie': cookieHeader('', 0) });
    return null;
  }
  return { db, session };
}

export async function logoutAdmin(req, res) {
  validateOrigin(req);
  const token = cookies(req)[COOKIE_NAME];
  if (token) {
    const db = await getDatabase();
    await db.collection('admin_sessions').deleteOne({ tokenHash: tokenHash(token) });
  }
  send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', 0) });
}

export async function changeAdminCredentials(req, res, username, password, currentPassword) {
  validateOrigin(req);
  const db = await getDatabase();
  const admin = await seedAdmin(db);
  if (!await bcrypt.compare(currentPassword, admin.passwordHash)) {
    const error = new Error('Current password is incorrect.');
    error.status = 401;
    throw error;
  }
  if (password) {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.collection('admin_users').updateOne(
      { key: 'primary' },
      { $set: { username, passwordHash, updatedAt: new Date() } }
    );
  } else {
    await db.collection('admin_users').updateOne(
      { key: 'primary' },
      { $set: { username, updatedAt: new Date() } }
    );
  }
  await db.collection('admin_sessions').deleteMany({});
  send(res, 200, { ok: true, username }, { 'Set-Cookie': cookieHeader('', 0) });
}

export async function readAdminSession(req, res) {
  const token = cookies(req)[COOKIE_NAME];
  if (!token) return send(res, 401, { error: 'Sign in is required.' });
  const db = await getDatabase();
  const session = await db.collection('admin_sessions').findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
  if (!session) return send(res, 401, { error: 'Your admin session has expired.' }, { 'Set-Cookie': cookieHeader('', 0) });
  send(res, 200, { ok: true, username: session.username });
}
