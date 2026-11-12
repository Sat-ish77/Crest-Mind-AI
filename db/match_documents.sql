-- =============================================================
-- CrestMind AI — match_documents search RPC
--
-- Run after db/schema.sql. Safe to re-run (CREATE OR REPLACE).
--
-- PRODUCTION: the live database runs a hybrid version that was never
-- committed. Before replacing it, save it:
--     SELECT pg_get_functiondef('match_documents'::regproc);
-- and diff it against this file.
-- =============================================================

-- -------------------------------------------------------------
-- match_documents — hybrid (vector + keyword) search RPC
--
-- This is the signature rag/retriever.py calls. The previous file only
-- defined a 4-argument, vector-only version, so a database built from
-- this repo answered every question with "No relevant documents found".
--
-- Parameters:
--   query_embedding    — 1536-dim vector of the user query
--   query_text         — raw question text for keyword search
--   match_count        — rows to return
--   filter_doc_type    — optional doc_type (NULL = all)
--   filter_doc_name    — optional exact filename (NULL = all)
--   filter_property_id — optional properties.id (NULL = all); also
--                        returns chunks not linked to any property
--
-- similarity is a Reciprocal Rank Fusion score (k = 60):
--   1/(60 + vector_rank) + 1/(60 + keyword_rank)
-- A chunk found by only one search scores <= 1/61; rag/retriever.py
-- derives its confidence bands from that ceiling.
-- -------------------------------------------------------------

DROP FUNCTION IF EXISTS match_documents(VECTOR, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding     VECTOR(1536),
    query_text          TEXT,
    match_count         INT  DEFAULT 15,
    filter_doc_type     TEXT DEFAULT NULL,
    filter_doc_name     TEXT DEFAULT NULL,
    filter_property_id  UUID DEFAULT NULL
)
RETURNS TABLE (
    id             UUID,
    content        TEXT,
    doc_name       TEXT,
    doc_type       TEXT,
    section        TEXT,
    page_number    INT,
    property_name  TEXT,
    metadata       JSONB,
    similarity     FLOAT
)
LANGUAGE sql STABLE
AS $$
WITH base AS (
    SELECT d.*
    FROM documents d
    WHERE d.embedding IS NOT NULL
      AND (filter_doc_type    IS NULL OR d.doc_type    = filter_doc_type)
      AND (filter_doc_name    IS NULL OR d.doc_name    = filter_doc_name)
      -- Unlinked chunks (property_id NULL) stay visible to property-scoped
      -- questions; only chunks known to belong to ANOTHER property are
      -- excluded. Otherwise every document ingested before property
      -- linking existed would be invisible whenever a property is named.
      AND (filter_property_id IS NULL
           OR d.property_id IS NULL
           OR d.property_id = filter_property_id)
),
-- OR the question's lexemes together: AND-ing every word of a natural
-- language question almost never matches a chunk.
q AS (
    SELECT NULLIF(
        replace(plainto_tsquery('english', coalesce(query_text, ''))::text, '&', '|'),
        ''
    ) AS tsq
),
vector_hits AS (
    SELECT b.id,
           row_number() OVER (ORDER BY b.embedding <=> query_embedding) AS rnk
    FROM base b
    ORDER BY b.embedding <=> query_embedding
    LIMIT match_count * 4
),
keyword_hits AS (
    SELECT b.id,
           row_number() OVER (
               ORDER BY ts_rank_cd(to_tsvector('english', b.content),
                                   to_tsquery('english', q.tsq)) DESC
           ) AS rnk
    FROM base b, q
    WHERE q.tsq IS NOT NULL
      AND to_tsvector('english', b.content) @@ to_tsquery('english', q.tsq)
    LIMIT match_count * 4
),
fused AS (
    SELECT COALESCE(v.id, k.id) AS id,
           COALESCE(1.0 / (60 + v.rnk), 0) + COALESCE(1.0 / (60 + k.rnk), 0) AS score
    FROM vector_hits v
    FULL OUTER JOIN keyword_hits k ON v.id = k.id
)
SELECT b.id, b.content, b.doc_name, b.doc_type, b.section, b.page_number,
       b.property_name, b.metadata, f.score::FLOAT AS similarity
FROM fused f
JOIN base b ON b.id = f.id
ORDER BY f.score DESC
LIMIT match_count;
$$;
