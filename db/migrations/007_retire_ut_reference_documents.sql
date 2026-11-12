-- The collection moved to Lipscomb's own documents on 2026-11-12. The three
-- University of Tennessee reference procedures are retired, so they can no
-- longer support an answer. Their versions stay in the table as retired
-- history; nothing is deleted, and an administrator can still see them in the
-- Source library.
UPDATE source_versions
SET state = 'retired', retired_at = now()
WHERE document_id IN ('ut-sags130-k', 'ut-saad022-k', 'ut-saad021-k')
  AND state <> 'retired';
