import type { Env } from '../types';
import { listOpenSlots, bookSlotAtomic } from '../db';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export async function handleListSlots(_req: Request, env: Env): Promise<Response> {
  const slots = await listOpenSlots(env);
  return json({ slots });
}

export async function handleCreateBooking(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ sessionId: string; slotId: string }>();
  if (!body.sessionId || !body.slotId) return json({ error: 'sessionId and slotId are required' }, 400);
  const bookingId = await bookSlotAtomic(env, body.slotId, body.sessionId);
  if (!bookingId) return json({ error: 'slot_full' }, 409);
  return json({ bookingId });
}
