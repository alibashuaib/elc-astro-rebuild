import type { Env, IdType } from '../types';
import { getSession, getApplicationBySession, insertApplication, listApplicationsWithDetails, setApplicationStatus } from '../db';
import { getSessionAdminId } from '../auth';

const ID_TYPES: IdType[] = ['national_id', 'iqama', 'passport'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export async function handleSubmitApplication(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{
    sessionId: string;
    course: string;
    guardianName?: string;
    idNumber: string;
    idType: string;
    email: string;
  }>();
  if (!body.sessionId || !body.course || !body.idNumber || !body.email) {
    return json({ error: 'sessionId, course, idNumber and email are required' }, 400);
  }
  if (!EMAIL_RE.test(body.email)) {
    return json({ error: 'invalid_email' }, 400);
  }
  if (!ID_TYPES.includes(body.idType as IdType)) {
    return json({ error: 'invalid_id_type' }, 400);
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
    idNumber: body.idNumber,
    idType: body.idType as IdType,
    email: body.email,
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
  if (!adminId) return json({ error: 'unauthorized' }, 401); // defence in depth -- index.ts's requireAdmin already gates this route
  await setApplicationStatus(env, applicationId, status, adminId);
  return json({ ok: true });
}
