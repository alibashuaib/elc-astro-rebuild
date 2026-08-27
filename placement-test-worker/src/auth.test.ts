import { describe, it, expect } from 'vitest';
import { issueSessionCookie, verifyAdminSession } from './auth';

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    ADMIN_SESSION_TTL_SECONDS: '43200',
    ADMIN_COOKIE_SECRET: 'test-secret-do-not-use-in-prod',
    ...overrides,
  } as any;
}

function requestWithCookie(cookie: string): Request {
  return new Request('http://x', { headers: { cookie } });
}

describe('admin session cookies', () => {
  it('issues a cookie that verifies', async () => {
    const env = makeEnv();
    const cookie = await issueSessionCookie(env, 'a1');
    expect(await verifyAdminSession(requestWithCookie(cookie), env)).toBe(true);
  });

  // A missing or malformed TTL used to make `expires` NaN, which serialized into
  // the signed payload as the literal string "NaN". `Date.now() > NaN` is false,
  // so the expiry check passed forever: the cookie was correctly signed and never
  // expired. Fail at issue time instead of minting an immortal credential.
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['non-numeric', 'twelve-hours'],
    ['zero', '0'],
    ['negative', '-1'],
  ])('refuses to issue a cookie when the TTL is %s', async (_label, ttl) => {
    const env = makeEnv({ ADMIN_SESSION_TTL_SECONDS: ttl });
    await expect(issueSessionCookie(env, 'a1')).rejects.toThrow(/ADMIN_SESSION_TTL_SECONDS/);
  });

  // Defence in depth: a *validly signed* cookie must still be refused if its
  // expiry field isn't a real timestamp. Signed here with the same scheme
  // auth.ts uses, so the signature check passes and the expiry guard is what
  // this test actually exercises -- signing a bad payload is no longer
  // reachable through issueSessionCookie now that it throws.
  it('rejects a correctly signed cookie whose expiry is not a number', async () => {
    const env = makeEnv();
    const payload = 'a1.NaN';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.ADMIN_COOKIE_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const encoded = btoa(String.fromCharCode(...new Uint8Array(sig)));

    expect(await verifyAdminSession(requestWithCookie(`elc_admin_session=${payload}.${encoded}`), env)).toBe(false);
  });

  it('rejects an expired cookie', async () => {
    const env = makeEnv({ ADMIN_SESSION_TTL_SECONDS: '1' });
    const cookie = await issueSessionCookie(env, 'a1');
    // Signed with a 1s TTL; verify as if 2s have passed.
    const realNow = Date.now;
    Date.now = () => realNow() + 2000;
    try {
      expect(await verifyAdminSession(requestWithCookie(cookie), env)).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });
});
