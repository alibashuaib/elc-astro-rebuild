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

ALTER TABLE applications DROP COLUMN email;
ALTER TABLE applications DROP COLUMN id_type;
ALTER TABLE applications DROP COLUMN id_number;
