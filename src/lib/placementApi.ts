const BASE = import.meta.env.PUBLIC_PLACEMENT_API_URL as string;

export interface StartSessionInput {
  name: string;
  phone: string;
  dob: string;
  guardianName?: string;
  locale: 'en' | 'ar';
  track?: 'kids' | 'adults';
}

export interface QuestionPayload {
  done: false;
  sessionId?: string;
  track?: 'kids' | 'adults';
  questionId: string;
  type: 'mcq' | 'text';
  prompt: string;
  options?: string[]; // present for type: 'mcq' only
  imageUrl?: string; // optional picture shown above the prompt (e.g. picture-matching items)
  passage?: { id: string; title: string; body: string }; // present for reading-comprehension items
  questionNumber: number; // 1-based position in the track's fixed sequential walk-through
  total: number; // size of the track's active question bank, for progress display
  skipAvailable?: boolean; // adults get one skip per band; kids may always skip
  correct?: boolean; // whether the *previous* answer (the one this response is replying to) was correct; absent for the first question
}

export interface DonePayload {
  done: true;
  level: string;
  levelName: string; // stage name for `level`, e.g. "Super Minds 3A" for kids -- see scoring.ts/STAGE_NAMES_BY_TRACK
  yle?: string; // Cambridge YLE level retained for reporting; currently hidden from student results
  correct?: boolean; // whether the final answer was correct; absent if the session ended without answering (bank pre-exhausted)
}

export type SessionStep = (QuestionPayload | DonePayload) & { sessionId?: string; track?: string };

/**
 * `expectedErrors` lists non-OK statuses whose JSON body is a meaningful result
 * rather than a failure — they're returned to the caller instead of throwing.
 */
async function request<T>(path: string, init?: RequestInit & { expectedErrors?: number[] }): Promise<T> {
  const { expectedErrors = [], ...fetchInit } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    ...fetchInit,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok && !expectedErrors.includes(res.status)) {
    throw new Error(`placement API ${path} failed: ${res.status}`);
  }
  return res.json();
}

export function startSession(input: StartSessionInput) {
  return request<SessionStep & { sessionId: string; track: string }>('/api/session', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function submitAnswer(
  sessionId: string,
  questionId: string,
  answer: { selectedIndex: number } | { answerText: string } | { skip: true }
) {
  return request<SessionStep>(`/api/session/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ questionId, ...answer }),
  });
}

export function listSlots() {
  return request<{ slots: Array<{ id: string; starts_at: string; remaining: number }> }>('/api/slots');
}

export function createBooking(sessionId: string, slotId: string) {
  // 409 means the slot filled up between listing and booking -- a normal
  // outcome the caller renders, not a transport failure.
  return request<{ bookingId: string } | { error: string }>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify({ sessionId, slotId }),
    expectedErrors: [409],
  });
}
