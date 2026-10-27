DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  ELSE
    RAISE NOTICE 'pgvector extension is not available in this Postgres image.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'idle'
    CHECK (phase IN ('idle', 'info', 'collecting', 'offering_slots', 'confirming', 'payment', 'cancel_select', 'cancel_confirm', 'handoff')),
  gathered JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agent_sessions_org_phone UNIQUE (organization_id, phone_e164)
);

CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'preference',
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agent_knowledge_documents_source UNIQUE (organization_id, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS agent_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES agent_knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(content, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agent_knowledge_chunks_doc_idx UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS service_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_service_aliases_org_alias UNIQUE (organization_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS service_bundle_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  trigger_aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  mode TEXT NOT NULL DEFAULT 'sequential'
    CHECK (mode IN ('sequential', 'simultaneous')),
  service_ids UUID[] NOT NULL,
  fallback_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  require_distinct_professionals BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_service_bundle_rules_org_name UNIQUE (organization_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS professional_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at TIME,
  closes_at TIME,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  inherits_business_hours BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_professional_working_hours UNIQUE (organization_id, professional_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_org_phone
  ON agent_sessions (organization_id, phone_e164);

CREATE INDEX IF NOT EXISTS idx_agent_memories_org_phone
  ON agent_memories (organization_id, phone_e164, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_chunks_search
  ON agent_knowledge_chunks USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_service_aliases_org_service
  ON service_aliases (organization_id, service_id);

CREATE INDEX IF NOT EXISTS idx_service_bundle_rules_org_active
  ON service_bundle_rules (organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_professional_working_hours_professional
  ON professional_working_hours (professional_id, weekday);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    ALTER TABLE agent_memories
      ADD COLUMN IF NOT EXISTS embedding vector(1536);
    ALTER TABLE agent_knowledge_chunks
      ADD COLUMN IF NOT EXISTS embedding vector(1536);
  END IF;
END $$;
