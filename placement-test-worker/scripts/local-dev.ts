import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import worker from '../src/index.ts';
import { createFakeD1 } from '../src/test-utils/fakeD1.ts';

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrations = [
  '0001_init.sql',
  '0002_seed_questions.sql',
  '0003_real_questions.sql',
  '0004_add_text_question_type.sql',
  '0005_kids_text_and_vocab_questions.sql',
  '0006_fixed_sequential_order.sql',
  '0007_elc_level_ladders.sql',
  '0008_kids_picture_matching.sql',
  '0009_reading_passages.sql',
  '0010_kids_reading_passage.sql',
  '0011_skip_question.sql',
  '0012_case_insensitive_grading.sql',
  '0013_room_vocab_images.sql',
].map((file) => path.join(workerRoot, 'migrations', file));

const env = {
  DB: createFakeD1(migrations),
  ADMIN_COOKIE_SECRET: 'local-development-only',
  ADMIN_SESSION_TTL_SECONDS: '43200',
  LOCAL_DEV: 'true',
} as any;

const server = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }

    const request = new Request(`http://localhost:8787${req.url ?? '/'}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
    const response = await worker.fetch(request, env);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, name) => (responseHeaders[name] = value));
    res.writeHead(response.status, responseHeaders);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'local_server_error' }));
  }
});

server.listen(8787, '127.0.0.1', () => {
  console.log('Placement test API running at http://localhost:8787');
});
