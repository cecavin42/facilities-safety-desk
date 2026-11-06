CREATE TABLE account_recovery (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id),
  issued_by text NOT NULL REFERENCES "user"(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_recovery_user_idx ON account_recovery(user_id);
CREATE TABLE source_versions (
  id uuid PRIMARY KEY,
  document_id text NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  publisher text NOT NULL,
  revision text NOT NULL,
  source_url text NOT NULL,
  scope text NOT NULL,
  credit text NOT NULL,
  origin text NOT NULL CHECK(origin IN ('bundled','upload')),
  state text NOT NULL CHECK(state IN ('draft','active','retired')),
  passages jsonb NOT NULL,
  content_hash text NOT NULL,
  file_name text,
  file_type text,
  file_bytes bytea,
  created_by text REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  retired_at timestamptz,
  UNIQUE(document_id,version)
);
CREATE UNIQUE INDEX source_one_active_version ON source_versions(document_id) WHERE state='active';
CREATE INDEX source_state_idx ON source_versions(state);
