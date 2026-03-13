-- =============================================================
-- CrestMind AI — Supabase Schema
-- Group 13, UNT Capstone Spring 2026
--
-- Run this SQL in the Supabase SQL Editor to set up the
-- documents table and similarity-search RPC function.
--
-- ON-PREMISE SWAP: This same SQL works on any PostgreSQL
-- instance with the pgvector extension installed.
-- =============================================================

-- Enable pgvector for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- -------------------------------------------------------------
-- documents table
-- Stores every text chunk, its embedding, and flexible metadata.
-- The JSONB "metadata" column absorbs all doc-type-specific
-- fields so adding new document types requires ZERO schema changes.
--
-- Supported doc_type values (extend freely):
--   lease, amendment, invoice, inspection, quote,
--   work_order, rent_roll
--
-- Example metadata by doc_type:
--   lease      → tenant_name, landlord_name, rent_amount,
--                 square_footage, lease_start, lease_end,
--                 nnn, hvac_responsible, exclusive_use,
--                 cam_charges, prorata_share
--   amendment  → amendment_number, original_lease_date,
--                 changes_summary, effective_date
--   invoice    → vendor_name, total_cost, work_type,
--                 invoice_date, contractor_number, address
--   inspection → equipment, issue_found, inspector_name,
--                 inspection_date, cost, equipment_age
--   quote      → vendor_name, cost_estimate,
--                 work_description, quote_date
--   work_order → work_order_number, cost_estimate,
--                 status, requested_by, work_type
--   rent_roll  → total_units, occupied_units,
--                 total_monthly_rent, vacancy_rate
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS documents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content        TEXT NOT NULL,
    embedding      VECTOR(1536),
    doc_name       TEXT,
    doc_type       TEXT,
    section        TEXT,
    page_number    INT,
    property_name  TEXT,
    metadata       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- IMPORTANT: Do NOT create an IVFFlat or HNSW index yet.
-- With fewer than 10,000 rows the sequential scan is faster
-- and an index would add write overhead with no read benefit.
--
-- When chunks exceed 10,000 rows, add one of:
--   CREATE INDEX ON documents
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);
--
--   CREATE INDEX ON documents
--     USING hnsw (embedding vector_cosine_ops);

-- -------------------------------------------------------------
-- match_documents  — Supabase RPC for similarity search
--
-- Parameters:
--   query_embedding  — the 1536-dim vector of the user query
--   match_count      — how many results to return
--   filter_doc_type  — optional: restrict to a specific doc_type
--                      (NULL = search all document types)
--   filter_doc_name  — optional: restrict to a specific document
--                      by filename (NULL = search all documents)
--
-- Returns rows ordered by cosine similarity (highest first).
-- Cosine similarity = 1 - cosine distance; pgvector's <=>
-- operator returns cosine distance, so we subtract from 1.
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding  VECTOR(1536),
    match_count      INT DEFAULT 5,
    filter_doc_type  TEXT DEFAULT NULL,
    filter_doc_name  TEXT DEFAULT NULL
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
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.doc_name,
        d.doc_type,
        d.section,
        d.page_number,
        d.property_name,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM documents d
    WHERE
        d.embedding IS NOT NULL
        AND (filter_doc_type IS NULL OR d.doc_type = filter_doc_type)
        AND (filter_doc_name IS NULL OR d.doc_name = filter_doc_name)
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
