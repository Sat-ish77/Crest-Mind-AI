-- =============================================================
-- CrestMind AI — Supabase Schema
-- Group 13, UNT Capstone Spring 2026
--
-- Run this SQL in the Supabase SQL Editor to set up the
-- properties and documents tables. The search RPC lives in
-- db/match_documents.sql (run it next).
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

-- -------------------------------------------------------------
-- properties — master list the agent resolves names against
-- (rag/property_resolver.py). Columns match what the resolver reads.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    entity_name  TEXT,
    city         TEXT,
    state        TEXT,
    status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'sold', 'historical', 'held')),
    sold_date    DATE,
    is_external  BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content        TEXT NOT NULL,
    embedding      VECTOR(1536),
    doc_name       TEXT,
    doc_type       TEXT,
    section        TEXT,
    page_number    INT,
    property_name  TEXT,
    -- Set by /ingest when property_name resolves to a properties row.
    -- NULL chunks are still found: the agent retries without the filter.
    property_id    UUID REFERENCES properties(id) ON DELETE SET NULL,
    metadata       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_property_id_idx ON documents (property_id);
CREATE INDEX IF NOT EXISTS documents_doc_name_idx    ON documents (doc_name);
CREATE INDEX IF NOT EXISTS documents_content_fts_idx
    ON documents USING gin (to_tsvector('english', content));

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
-- Next: run db/match_documents.sql (search RPC), then db/audit_logs.sql.
-- -------------------------------------------------------------
