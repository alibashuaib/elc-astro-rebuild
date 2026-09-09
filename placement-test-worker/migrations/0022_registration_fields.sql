-- Registration wizard: richer student intake, plus dropping the
-- email/id_type/id_number columns applications gained in 0020 -- those are
-- now collected once, here, at registration.
ALTER TABLE students ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN father_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN grandfather_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN family_name TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN id_number TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN nationality TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN email TEXT;
ALTER TABLE students ADD COLUMN education_level TEXT;
ALTER TABLE students ADD COLUMN address TEXT;
ALTER TABLE students ADD COLUMN guardian_relationship TEXT;
ALTER TABLE students ADD COLUMN guardian_relationship_other TEXT;
ALTER TABLE students ADD COLUMN guardian_phone TEXT;
ALTER TABLE students ADD COLUMN guardian_alt_phone TEXT;
ALTER TABLE students ADD COLUMN referral_source TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN referral_source_other TEXT;
ALTER TABLE students ADD COLUMN referral_social_channels TEXT;
ALTER TABLE students ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE students ADD COLUMN media_consent_accepted_at TEXT;
ALTER TABLE students ADD COLUMN terms_version TEXT;

-- Backfill: applications gained email/id_type/id_number in 0021, and any real
-- application submitted between that shipping and this migration running has
-- data in those columns that's about to be dropped. Copy each student's most
-- recent application id_number/email into the new students columns before
-- dropping, so that data isn't lost.
UPDATE students SET id_number = COALESCE(
  (SELECT a.id_number FROM applications a
   JOIN test_sessions ts ON ts.id = a.session_id
   WHERE ts.student_id = students.id AND a.id_number IS NOT NULL AND a.id_number != ''
   ORDER BY a.created_at DESC LIMIT 1), id_number)
WHERE id_number = '';

UPDATE students SET email = COALESCE(
  (SELECT a.email FROM applications a
   JOIN test_sessions ts ON ts.id = a.session_id
   WHERE ts.student_id = students.id AND a.email IS NOT NULL AND a.email != ''
   ORDER BY a.created_at DESC LIMIT 1), email)
WHERE email IS NULL OR email = '';

ALTER TABLE applications DROP COLUMN email;
ALTER TABLE applications DROP COLUMN id_type;
ALTER TABLE applications DROP COLUMN id_number;
