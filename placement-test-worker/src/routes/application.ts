import type { Env } from '../types';
import { getSession, getApplicationBySession, insertApplication, listApplicationsWithDetails, setApplicationStatus } from '../db';
import { getSessionAdminId } from '../auth';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export async function handleSubmitApplication(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ sessionId: string; course: string; guardianName?: string }>();
  if (!body.sessionId || !body.course) {
    return json({ error: 'sessionId and course are required' }, 400);
  }
  const session = await getSession(env, body.sessionId);
  if (!session || session.status !== 'completed') {
    return json({ error: 'session_not_completed' }, 400);
  }
  if (session.track === 'kids' && !body.guardianName?.trim()) {
    return json({ error: 'guardian_name_required' }, 400);
  }
  const existing = await getApplicationBySession(env, body.sessionId);
  if (existing) return json({ error: 'already_applied' }, 409);
  const applicationId = await insertApplication(env, {
    sessionId: body.sessionId,
    course: body.course,
    guardianName: body.guardianName ?? null,
  });
  return json({ applicationId }, 201);
}

export async function handleAdminListApplications(req: Request, env: Env): Promise<Response> {
  const status = new URL(req.url).searchParams.get('status');
  return json({ applications: await listApplicationsWithDetails(env, status) });
}

export async function handleAdminSetApplicationStatus(req: Request, env: Env, applicationId: string): Promise<Response> {
  const { status } = await req.json<{ status: string }>();
  if (status !== 'approved' && status !== 'rejected') return json({ error: 'invalid_status' }, 400);
  const adminId = await getSessionAdminId(req, env);
  if (!adminId) return json({ error: 'unauthorized' }, 401);
  await setApplicationStatus(env, applicationId, status, adminId);
  return json({ ok: true });
}
