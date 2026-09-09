-- Adds email + id_type to applications, and drops document upload support
-- (id copy / photo uploads were removed from the application flow).
ALTER TABLE applications ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN id_type TEXT NOT NULL DEFAULT 'national_id'
  CHECK (id_type IN ('national_id', 'iqama', 'passport'));

DROP TABLE application_documents;
