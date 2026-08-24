// Fetches reviews from the Google Business Profile (via Places API, New) at BUILD
// TIME — not client-side. This keeps the homepage fully static (no client fetch,
// no CLS/layout shift while reviews load, no extra JS) and means these are the
// only real, non-fabricated reviews the site ever shows — per the plan (§5):
// "AggregateRating/Review — only once real reviews exist, never fabricated."
//
// Needs two env vars, set as repo secrets in CI and in a local .env for `astro dev`:
//   GOOGLE_PLACES_API_KEY  — a Places API (New) key, restricted to this API only
//   GOOGLE_PLACE_ID        — this business's Place ID (same GBP listing that needs
//                            the NAP-mismatch fix — see lib/schema.ts). Find it at
//                            https://developers.google.com/maps/documentation/places/web-service/place-id
//
// Without both set, this returns null and the caller renders nothing — the build
// must never fail just because reviews aren't configured yet.

export interface GoogleReview {
  authorName: string;
  authorPhotoUrl: string | null;
  rating: number; // 1–5
  text: string;
  relativeTime: string; // e.g. "a month ago" — as returned by Google, already localized
  publishTime: string; // ISO 8601
}

export interface GoogleReviewsResult {
  overallRating: number;
  totalReviewCount: number;
  reviews: GoogleReview[];
}

const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';

export async function fetchGoogleReviews(locale: 'en' | 'ar'): Promise<GoogleReviewsResult | null> {
  // process.env, not import.meta.env: this module only ever runs server-side
  // (imported from .astro frontmatter, never shipped to the client), and
  // process.env avoids any ambiguity around Astro's PUBLIC_-prefix client
  // exposure rules for vars that are meant to stay build-time-only secrets.
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return null;
  }

  try {
    const res = await fetch(`${PLACES_API_BASE}/${placeId}?languageCode=${locale}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        // Field mask keeps the request minimal — Places API (New) bills by field group requested.
        'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
      },
    });

    if (!res.ok) {
      console.warn(`[googleReviews] Places API returned ${res.status} — skipping reviews for this build.`);
      return null;
    }

    const data = await res.json();

    const reviews: GoogleReview[] = (data.reviews ?? [])
      .map((r: any) => ({
        authorName: r.authorAttribution?.displayName ?? 'Google user',
        authorPhotoUrl: r.authorAttribution?.photoUri ?? null,
        rating: r.rating ?? 0,
        text: r.text?.text ?? r.originalText?.text ?? '',
        relativeTime: r.relativePublishTimeDescription ?? '',
        publishTime: r.publishTime ?? '',
      }))
      // Only the displayed testimonial cards are curated to 4★+ — overallRating
      // and totalReviewCount below stay the true, unfiltered Google aggregate
      // (also what schema.org/AggregateRating reports), so the site never shows
      // a rating number that doesn't match what's actually on the GBP listing.
      .filter((r) => r.rating >= 4);

    return {
      overallRating: data.rating ?? 0,
      totalReviewCount: data.userRatingCount ?? 0,
      reviews,
    };
  } catch (err) {
    // Network failure during build shouldn't take the whole site down — log and
    // move on. CI should still catch a persistently-failing config via the
    // Lighthouse/manual QA pass, not a hard build error here.
    console.warn('[googleReviews] fetch failed — skipping reviews for this build.', err);
    return null;
  }
}
