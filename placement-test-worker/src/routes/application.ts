import type { Env, DocumentKind } from '../types';
import {
  getSession, getApplicationBySession, getApplicationById, insertApplication, insertApplicationDocument,
  listApplicationsWithDetails, setApplicationStatus, getApplicationDocument,
} from '../db';
import { getSessionAdminId } from '../auth';

const ALLOWED_DOC_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const DOC_KINDS: DocumentKind[] = ['id_copy', 'photo', 'other'];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export async function handleSubmitApplication(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ sessionId: string; course: string; guardianName?: string; idNumber: string }>();
  if (!body.sessionId || !body.course || !body.idNumber) {
    return json({ error: 'sessionId, course and idNumber are required' }, 400);
  }
  const session = await getSession(env, body.sessionId);
  if (!session || session.status !== 'completed') {
    return json({ error: 'session_not_completed' }, 400);
  }
  const existing = await getApplicationBySession(env, body.sessionId);
  if (existing) return json({ error: 'already_applied' }, 409);
  const applicationId = await insertApplication(env, {
    sessionId: body.sessionId,
    course: body.course,
    guardianName: body.guardianName ?? null,
    idNumber: body.idNumber,
  });
  return json({ applicationId }, 201);
}

export async function handleUploadDocument(req: Request, env: Env, applicationId: string): Promise<Response> {
  const application = await getApplicationById(env, applicationId);
  if (!application) return json({ error: 'not_found' }, 404);

  const form = await req.formData();
  const kind = form.get('kind');
  const file = form.get('file');
  if (typeof kind !== 'string' || !DOC_KINDS.includes(kind as DocumentKind)) {
    return json({ error: 'invalid_kind' }, 400);
  }
  if (!(file instanceof File)) return json({ error: 'file_required' }, 400);
  if (!ALLOWED_DOC_TYPES.has(file.type)) return json({ error: 'unsupported_type' }, 400);
  if (file.size > MAX_DOC_BYTES) return json({ error: 'file_too_large' }, 413);

  const r2Key = `applications/${applicationId}/${kind}-${crypto.randomUUID()}`;
  await env.DOCS.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const documentId = await insertApplicationDocument(env, applicationId, kind as DocumentKind, r2Key);
  return json({ documentId }, 201);
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

export async function handleAdminGetDocument(_req: Request, env: Env, applicationId: string, documentId: string): Promise<Response> {
  const doc = await getApplicationDocument(env, applicationId, documentId);
  if (!doc) return new Response('not found', { status: 404 });
  const object = await env.DOCS.get(doc.r2_key);
  if (!object) return new Response('not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
}
