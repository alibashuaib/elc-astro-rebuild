// In-memory R2Bucket-compatible shim, same rationale as fakeD1.ts: the real
// workerd runtime crashes on startup in this sandbox, so R2-touching route
// code is unit-tested against this instead. Implements only what this
// project's code calls: bucket.put(key, body, { httpMetadata }) and
// bucket.get(key) -> { body, httpEtag, writeHttpMetadata(headers) } | null.
//
// Production code never imports this file — Env.DOCS stays typed as the real
// R2Bucket everywhere outside tests.

interface StoredObject {
  data: ArrayBuffer;
  contentType?: string;
}

export function createFakeR2(): R2Bucket {
  const store = new Map<string, StoredObject>();

  return {
    async put(key: string, value: ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }) {
      const data = ArrayBuffer.isView(value)
        ? (value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer)
        : value;
      store.set(key, { data, contentType: options?.httpMetadata?.contentType });
      return { key } as any;
    },
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        body: new Response(entry.data).body,
        httpEtag: `"${key}"`,
        writeHttpMetadata(headers: Headers) {
          if (entry.contentType) headers.set('content-type', entry.contentType);
        },
      } as any;
    },
  } as unknown as R2Bucket;
}
