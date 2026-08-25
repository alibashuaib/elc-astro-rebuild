import type { Env } from './types';
import { handleStartSession, handleAnswer } from './routes/session';
import { handleListSlots, handleCreateBooking } from './routes/booking';
import {
  requireAdmin, handleAdminLogin, handleAdminListSlots, handleAdminCreateSlot, handleAdminDeleteSlot,
  handleAdminListBookings, handleAdminListQuestions, handleAdminCreateQuestion, handleAdminSetQuestionActive,
} from './routes/admin';

const ALLOWED_ORIGINS = ['https://elc.com.sa', 'http://localhost:4321'];

function withCors(res: Response, origin: string | null): Response {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers = new Headers(res.headers);
  headers.set('access-control-allow-origin', allow);
  headers.set('access-control-allow-credentials', 'true');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('access-control-allow-methods', 'GET,POST,DELETE,PATCH,OPTIONS');
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('origin');
    if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), origin);

    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

    try {
      if (parts[0] !== 'api') return withCors(new Response('not found', { status: 404 }), origin);

      if (parts[1] === 'session' && parts.length === 2 && req.method === 'POST') {
        return withCors(await handleStartSession(req, env), origin);
      }
      if (parts[1] === 'session' && parts[3] === 'answer' && req.method === 'POST') {
        return withCors(await handleAnswer(req, env, parts[2]), origin);
      }
      if (parts[1] === 'slots' && parts.length === 2 && req.method === 'GET') {
        return withCors(await handleListSlots(req, env), origin);
      }
      if (parts[1] === 'bookings' && parts.length === 2 && req.method === 'POST') {
        return withCors(await handleCreateBooking(req, env), origin);
      }
      if (parts[1] === 'admin' && parts[2] === 'login' && req.method === 'POST') {
        return withCors(await handleAdminLogin(req, env), origin);
      }
      if (parts[1] === 'admin') {
        const unauthorized = await requireAdmin(req, env);
        if (unauthorized) return withCors(unauthorized, origin);

        if (parts[2] === 'slots' && parts.length === 3 && req.method === 'GET') return withCors(await handleAdminListSlots(req, env), origin);
        if (parts[2] === 'slots' && parts.length === 3 && req.method === 'POST') return withCors(await handleAdminCreateSlot(req, env), origin);
        if (parts[2] === 'slots' && parts.length === 4 && req.method === 'DELETE') return withCors(await handleAdminDeleteSlot(req, env, parts[3]), origin);
        if (parts[2] === 'bookings' && req.method === 'GET') return withCors(await handleAdminListBookings(req, env), origin);
        if (parts[2] === 'questions' && parts.length === 3 && req.method === 'GET') return withCors(await handleAdminListQuestions(req, env), origin);
        if (parts[2] === 'questions' && parts.length === 3 && req.method === 'POST') return withCors(await handleAdminCreateQuestion(req, env), origin);
        if (parts[2] === 'questions' && parts.length === 4 && req.method === 'PATCH') return withCors(await handleAdminSetQuestionActive(req, env, parts[3]), origin);
      }
      return withCors(new Response('not found', { status: 404 }), origin);
    } catch (err) {
      return withCors(new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'content-type': 'application/json' } }), origin);
    }
  },
};
