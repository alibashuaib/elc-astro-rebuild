import type { Env } from './types';
import { handleStartSession, handleAnswer } from './routes/session';
import { handleListSlots, handleCreateBooking } from './routes/booking';
import {
  requireAdmin, handleAdminLogin, handleAdminListSlots, handleAdminCreateSlot, handleAdminDeleteSlot,
  handleAdminListBookings, handleAdminListQuestions, handleAdminCreateQuestion, handleAdminSetQuestionActive,
} from './routes/admin';

const ALLOWED_ORIGINS = ['https://elc.com.sa'];

function isAllowedOrigin(origin: string, env: Env): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Astro automatically moves to the next available port during local
  // development, so permit loopback origins without hard-coding 4321 -- but
  // only when actually running locally. Unconditionally, this let any page
  // served from the visitor's own machine make credentialed cross-origin
  // calls to the live admin API.
  if (env.LOCAL_DEV !== 'true') return false;
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function withCors(res: Response, origin: string | null, env: Env): Response {
  const allow = origin && isAllowedOrigin(origin, env) ? origin : ALLOWED_ORIGINS[0];
  const headers = new Headers(res.headers);
  headers.set('access-control-allow-origin', allow);
  headers.set('access-control-allow-credentials', 'true');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('access-control-allow-methods', 'GET,POST,DELETE,PATCH,OPTIONS');
  return new Response(res.body, { status: res.status, headers });
}

/** A ':name' segment matches any single path segment and is passed to the handler in order. */
interface Route {
  method: string;
  pattern: string[];
  /** Gated behind requireAdmin before the handler runs. */
  admin?: boolean;
  handler: (req: Request, env: Env, params: string[]) => Promise<Response>;
}

const ROUTES: Route[] = [
  { method: 'POST', pattern: ['api', 'session'], handler: (req, env) => handleStartSession(req, env) },
  { method: 'POST', pattern: ['api', 'session', ':sessionId', 'answer'], handler: (req, env, [sessionId]) => handleAnswer(req, env, sessionId) },
  { method: 'GET', pattern: ['api', 'slots'], handler: (req, env) => handleListSlots(req, env) },
  { method: 'POST', pattern: ['api', 'bookings'], handler: (req, env) => handleCreateBooking(req, env) },
  { method: 'POST', pattern: ['api', 'admin', 'login'], handler: (req, env) => handleAdminLogin(req, env) },
  { method: 'GET', pattern: ['api', 'admin', 'slots'], admin: true, handler: (req, env) => handleAdminListSlots(req, env) },
  { method: 'POST', pattern: ['api', 'admin', 'slots'], admin: true, handler: (req, env) => handleAdminCreateSlot(req, env) },
  { method: 'DELETE', pattern: ['api', 'admin', 'slots', ':slotId'], admin: true, handler: (req, env, [slotId]) => handleAdminDeleteSlot(req, env, slotId) },
  { method: 'GET', pattern: ['api', 'admin', 'bookings'], admin: true, handler: (req, env) => handleAdminListBookings(req, env) },
  { method: 'GET', pattern: ['api', 'admin', 'questions'], admin: true, handler: (req, env) => handleAdminListQuestions(req, env) },
  { method: 'POST', pattern: ['api', 'admin', 'questions'], admin: true, handler: (req, env) => handleAdminCreateQuestion(req, env) },
  { method: 'PATCH', pattern: ['api', 'admin', 'questions', ':questionId'], admin: true, handler: (req, env, [questionId]) => handleAdminSetQuestionActive(req, env, questionId) },
];

function matchRoute(method: string, parts: string[]): { route: Route; params: string[] } | null {
  for (const route of ROUTES) {
    if (route.method !== method || route.pattern.length !== parts.length) continue;
    const params: string[] = [];
    const matched = route.pattern.every((segment, i) => {
      if (segment.startsWith(':')) {
        params.push(parts[i]);
        return true;
      }
      return segment === parts[i];
    });
    if (matched) return { route, params };
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('origin');
    const respond = (res: Response) => withCors(res, origin, env);
    if (req.method === 'OPTIONS') return respond(new Response(null, { status: 204 }));

    const parts = new URL(req.url).pathname.split('/').filter(Boolean); // ['api', ...]

    try {
      const matched = matchRoute(req.method, parts);
      if (!matched) return respond(new Response('not found', { status: 404 }));

      if (matched.route.admin) {
        const unauthorized = await requireAdmin(req, env);
        if (unauthorized) return respond(unauthorized);
      }
      return respond(await matched.route.handler(req, env, matched.params));
    } catch (err) {
      console.error('placement API request failed', err);
      const localMessage = env.LOCAL_DEV === 'true' && err instanceof Error ? err.message : 'internal_error';
      return respond(new Response(JSON.stringify({ error: localMessage }), { status: 500, headers: { 'content-type': 'application/json' } }));
    }
  },
};
