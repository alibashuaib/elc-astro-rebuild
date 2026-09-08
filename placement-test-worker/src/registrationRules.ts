// placement-test-worker/src/registrationRules.ts
// Shared between handleStartSession's server-side validation and its tests.
// The Astro frontend keeps its own copy in src/lib/registrationValidation.ts
// (client code and the Worker don't share a build) -- each side's file
// points at the other in a comment so the two never drift silently.

export const NAME_RE = /^[\p{L}\s'’-]{2,}$/u;
export const PHONE_RE = /^(\+966|0)5\d{8}$/;
export const ID_NUMBER_RE = /^\d{7,15}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REFERRAL_SOURCES = ['friend', 'paper_ad', 'sms', 'internet', 'road_ad', 'social', 'other'] as const;
export const SOCIAL_CHANNELS = ['facebook', 'twitter', 'youtube', 'tiktok', 'instagram', 'snapchat'] as const;
export const GUARDIAN_RELATIONSHIPS = ['father', 'mother', 'sibling', 'grandparent', 'legal_guardian', 'other'] as const;

/** Exact calendar-year age, matching db.ts's computeTrack/isUnderEleven math. */
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
