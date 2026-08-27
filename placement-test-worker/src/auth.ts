import bcrypt from 'bcryptjs';
import type { Env } from './types';

const COOKIE_NAME = 'elc_admin_session';

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function checkPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function issueSessionCookie(env: Env, adminId: string): Promise<string> {
  // A missing or malformed TTL used to yield NaN here, which serialized into the
  // signed payload as the string "NaN". Because `Date.now() > NaN` is false, the
  // expiry check in verifyAdminSession then passed forever -- a correctly signed
  // admin cookie that never expired. Refuse to mint one at all instead.
  const ttl = parseInt(env.ADMIN_SESSION_TTL_SECONDS, 10);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error(`ADMIN_SESSION_TTL_SECONDS must be a positive number of seconds, got ${JSON.stringify(env.ADMIN_SESSION_TTL_SECONDS)}`);
  }
  const expires = Date.now() + ttl * 1000;
  const payload = `${adminId}.${expires}`;
  const sig = await sign(payload, env.ADMIN_COOKIE_SECRET);
  const value = `${payload}.${sig}`;
  // SameSite=None (with Secure) is required, not just permitted: the admin panel is served from
  // elc.com.sa while this Worker runs on a different origin (*.workers.dev), so its cross-site
  // fetch() calls to /api/admin/* would never attach a SameSite=Strict or =Lax cookie — login
  // would appear to succeed while every subsequent admin call silently 401s.
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${ttl}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyAdminSession(req: Request, env: Env): Promise<boolean> {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [adminId, expiresStr, sig] = match[1].split('.');
  if (!adminId || !expiresStr || !sig) return false;
  // Defence in depth against the NaN-expiry cookie described in
  // issueSessionCookie: an unparseable expiry is treated as expired, not as
  // "never expires" (which is what a bare `Date.now() > NaN` comparison gives).
  const expires = parseInt(expiresStr, 10);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  const expectedSig = await sign(`${adminId}.${expiresStr}`, env.ADMIN_COOKIE_SECRET);
  return constantTimeEqual(expectedSig, sig);
}
