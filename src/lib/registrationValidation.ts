// src/lib/registrationValidation.ts
// Client-side mirror of placement-test-worker/src/registrationRules.ts --
// kept as a plain duplicate (client and Worker code don't share a build);
// update both together if a rule ever changes.

export const NAME_RE = /^[\p{L}\s'’-]{2,}$/u;
export const PHONE_RE = /^(\+966|0)5\d{8}$/;
export const ID_NUMBER_RE = /^\d{7,15}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REFERRAL_SOURCES = ['friend', 'paper_ad', 'sms', 'internet', 'road_ad', 'social', 'other'] as const;
export const SOCIAL_CHANNELS = ['facebook', 'twitter', 'youtube', 'tiktok', 'instagram', 'snapchat'] as const;
export const GUARDIAN_RELATIONSHIPS = ['father', 'mother', 'sibling', 'grandparent', 'legal_guardian', 'other'] as const;
export const EDUCATION_LEVELS = ['primary', 'intermediate', 'secondary', 'university', 'postgraduate', 'vocational', 'other'] as const;

/**
 * Exact calendar-year age -- same math as placement-test-worker/src/db.ts's computeTrack.
 * Uses UTC getters throughout (not local-time getters) because `dob` is a 'YYYY-MM-DD' string,
 * which the Date constructor parses as UTC midnight -- reading it back with local-time getters
 * can land on the previous day for viewers west of UTC, disagreeing with the worker's UTC-based
 * computeAge by up to a year right at an age boundary.
 */
export function computeAge(dob: string): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return NaN;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}
