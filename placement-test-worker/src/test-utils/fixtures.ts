// placement-test-worker/src/test-utils/fixtures.ts
/** A complete, valid /api/session registration body. Override individual
 * fields per test -- every field not overridden passes every validation
 * rule in handleStartSession (see registrationRules.ts). */
export function validRegistration(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Sam',
    fatherName: 'Ali',
    grandfatherName: 'Mohammed',
    familyName: 'Alharbi',
    name: 'Sam Ali Mohammed Alharbi',
    phone: '+966500000000',
    dob: '1995-01-01',
    idNumber: '1234567890',
    nationality: 'سعودي',
    locale: 'en',
    referralSource: 'friend',
    termsAccepted: true,
    mediaConsentAccepted: true,
    ...overrides,
  };
}

/** Same, but under 4-11yo (kids track) -- adds the guardian fields
 * handleStartSession requires once age < 18. */
export function validKidsRegistration(overrides: Record<string, unknown> = {}) {
  return validRegistration({
    firstName: 'Kid',
    dob: '2018-01-01',
    track: 'kids',
    guardianName: 'Guardian Name',
    guardianRelationship: 'father',
    guardianPhone: '+966500000099',
    ...overrides,
  });
}

/** Deterministically turns an arbitrary string (e.g. a test/question id) into
 * a syntactically valid Saudi mobile number -- PHONE_RE now rejects the
 * plain identifier strings tests used to pass as a "just needs to be
 * unique" phone. */
export function phoneFor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `+9665${String(hash % 100000000).padStart(8, '0')}`;
}
