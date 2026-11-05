export class BadRequestError extends Error {}

/** Anything other than a JSON object body is a 400 (BadRequestError), never a 500. */
export async function readJson<T>(req: Request): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError('invalid_json');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestError('invalid_json');
  return body as T;
}
