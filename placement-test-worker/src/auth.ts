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
  const ttl = parseInt(env.ADMIN_SESSION_TTL_SECONDS, 10);
  const expires = Date.now() + ttl * 1000;
  const payload = `${adminId}.${expires}`;
  const sig = await sign(payload, env.ADMIN_COOKIE_SECRET);
  const value = `${payload}.${sig}`;
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${ttl}`;
}

export async function verifyAdminSession(req: Request, env: Env): Promise<boolean> {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [adminId, expiresStr, sig] = match[1].split('.');
  if (!adminId || !expiresStr || !sig) return false;
  if (Date.now() > parseInt(expiresStr, 10)) return false;
  const expectedSig = await sign(`${adminId}.${expiresStr}`, env.ADMIN_COOKIE_SECRET);
  return expectedSig === sig;
}
