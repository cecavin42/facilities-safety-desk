-- Semantic search (optional, off unless an embeddings key is set). One row
-- holds the embedding of one passage of one source version, made by one
-- embedding model: a list of numbers that places the passage's meaning, so a
-- question can find it even when it uses other words.
--
-- The vectors are stored as an ordinary array of real numbers, which every
-- PostgreSQL accepts. The app loads them and compares them itself. Nothing
-- here needs the pgvector extension; docs/DEPLOYMENT.md says why and when to
-- move to it. The table stays empty while semantic search is off.
--
-- text_hash is the fingerprint of the exact text that was embedded. A row
-- whose fingerprint no longer matches the passage is ignored and made again.
-- model is part of the key, so a change of model can be indexed beside the
-- old one before the setting is switched.
CREATE TABLE passage_embeddings (
  version_id uuid NOT NULL REFERENCES source_versions(id) ON DELETE CASCADE,
  passage_id text NOT NULL,
  model text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions BETWEEN 8 AND 4096),
  text_hash text NOT NULL,
  embedding real[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, passage_id, model),
  CHECK (cardinality(embedding) = dimensions)
);
