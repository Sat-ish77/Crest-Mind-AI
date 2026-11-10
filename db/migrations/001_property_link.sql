-- =============================================================
-- Migration 001 — link document chunks to properties
--
-- For an EXISTING database (fresh setups get this from schema.sql).
-- Safe to re-run. Does NOT touch match_documents. After this file, run
-- db/match_documents.sql (read its header first: it replaces the live,
-- uncommitted search function) so property-scoped searches also return
-- chunks that have no property link yet.
-- =============================================================

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS documents_property_id_idx ON documents (property_id);

-- Backfill: link chunks whose property_name exactly matches one property
-- (case-insensitive). Ambiguous or fuzzy names are left NULL on purpose —
-- the agent still finds NULL chunks via its unfiltered retry, and a wrong
-- link is worse than none. Review with the query at the bottom.
UPDATE documents d
SET    property_id = p.id
FROM   properties p
WHERE  d.property_id IS NULL
  AND  d.property_name IS NOT NULL
  AND  lower(trim(d.property_name)) = lower(trim(p.name))
  AND  (SELECT count(*) FROM properties p2
        WHERE lower(trim(p2.name)) = lower(trim(p.name))) = 1;

-- Chunks still unlinked, by document (link by hand if needed):
--   SELECT doc_name, property_name, count(*)
--   FROM documents WHERE property_id IS NULL
--   GROUP BY 1, 2 ORDER BY 1;
