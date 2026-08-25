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
}

export interface QuestionRow {
  id: string;
  track: Track;
  level: CefrLevel;
  prompt: string;
  options: string; // JSON string
  correct_index: number;
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
