import type { CefrLevel } from './scoring';

export interface Env {
  DB: D1Database;
  ADMIN_SESSION_TTL_SECONDS: string;
  ADMIN_COOKIE_SECRET: string; // set via `wrangler secret put ADMIN_COOKIE_SECRET`
}

export type Track = 'kids' | 'adults';

export interface StudentInput {
  name: string;
  phone: string;
  dob: string; // ISO date
  guardianName?: string;
  locale: 'en' | 'ar';
  track?: Track; // explicit choice from the registration form; falls back to age-based computeTrack(dob) if omitted/invalid
}

export type QuestionType = 'mcq' | 'text';

export interface QuestionRow {
  id: string;
  track: Track;
  level: CefrLevel; // descriptive metadata only -- doesn't drive question selection, see db.ts/pickNextQuestion
  type: QuestionType;
  prompt: string;
  options: string; // JSON string; '[]' for type: 'text'
  correct_index: number; // unused placeholder (0) for type: 'text'
  expected_answer: string | null; // set for type: 'text', null for type: 'mcq'
  case_sensitive: number; // 1 only for items that explicitly test capital/small letters; 0 grades case-insensitively
  image_url: string | null; // optional picture shown above the prompt (e.g. picture-matching items)
  passage_id: string | null; // set for reading-comprehension items; joins to passages.id for the article text
  sequence: number; // fixed order within track, matching the source document
  active: number;
}

export interface PassageRow {
  id: string;
  title: string;
  body: string;
}

export interface SessionRow {
  id: string;
  student_id: string;
  track: Track;
  status: 'in_progress' | 'completed' | 'abandoned';
  current_level_index: number;
  step: number;
  recent_levels: string; // JSON string
  questions_asked: number;
  estimated_level: string | null;
}
