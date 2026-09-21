-- =============================================================
-- CrestMind AI — Human-in-the-Loop Audit Log
-- CR-CAP2-001 | Requested by Eric Tank
--             | Signed off by Sushil Dahal (PM), David Rowe
--
-- Records every human verification / error flag on an AI answer.
-- FLAGGING + LOGGING ONLY — nothing here feeds model retraining.
--
-- Run this in the Supabase SQL Editor.
--
-- ON-PREMISE SWAP: plain PostgreSQL, no extensions required.
-- =============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Who clicked. Currently comes from the frontend's localStorage
    -- session, so it is self-reported and NOT authenticated.
    -- When real auth lands, this column backfills instead of migrating.
    username           TEXT,

    query              TEXT NOT NULL,
    answer             TEXT NOT NULL,

    -- The confidence label shown to the user at the moment they judged
    -- the answer — stored as displayed, so the log stays honest even if
    -- the scoring bands are later recalibrated.
    overall_confidence TEXT,

    -- Source list snapshotted at answer time. Documents get deleted and
    -- re-ingested; a flagged answer has to stay reproducible without them.
    sources            JSONB NOT NULL DEFAULT '[]'::jsonb,

    action             TEXT NOT NULL CHECK (action IN ('verified', 'flagged')),
    note               TEXT
);

-- The API accesses this table with a server-side service-role key.
-- Enabling RLS prevents browser/anon clients from reading answer history
-- directly. Do not expose the service-role key in the frontend.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- These match the Review page's two access patterns: newest-first and
-- newest-first filtered by action.
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
    ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_idx
    ON audit_logs (action, created_at DESC);

COMMENT ON TABLE audit_logs IS
    'Immutable snapshots of property-manager verification and flagging decisions.';
