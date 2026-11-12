ALTER TABLE incident_records ADD COLUMN created_by text REFERENCES "user"(id);
CREATE INDEX incident_records_owner_idx ON incident_records(created_by);
ALTER TABLE record_batches ADD COLUMN requested_by text REFERENCES "user"(id);
ALTER TABLE record_batches ADD COLUMN duplicate_count integer NOT NULL DEFAULT 0;
ALTER TABLE question_log ADD COLUMN asked_by text REFERENCES "user"(id);
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor_id text REFERENCES "user"(id),
  action text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_attempts (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  resets_at timestamptz NOT NULL
);
ALTER TABLE "user" ADD CONSTRAINT user_role_valid CHECK (role IN ('user', 'admin'));
