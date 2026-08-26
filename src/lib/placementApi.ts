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
  correct?: boolean; // whether the *previous* answer (the one this response is replying to) was correct; absent for the first question
}

export interface DonePayload {
  done: true;
  level: string;
  levelName: string; // stage name for `level`, e.g. "Elementary" for kids A2 -- see scoring.ts/STAGE_NAMES_BY_TRACK
  correct?: boolean; // whether the final answer was correct; absent if the session ended without answering (bank pre-exhausted)
}

export type SessionStep = (QuestionPayload | DonePayload) & { sessionId?: string; track?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`placement API ${path} failed: ${res.status}`);
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

export async function createBooking(
  sessionId: string,
  slotId: string
): Promise<{ bookingId: string } | { error: string }> {
  const res = await fetch(`${BASE}/api/bookings`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, slotId }),
  });
  if (res.status === 409) {
    const body = await res.json();
    return { error: body.error };
  }
  if (!res.ok) throw new Error(`placement API /api/bookings failed: ${res.status}`);
  return res.json();
}
