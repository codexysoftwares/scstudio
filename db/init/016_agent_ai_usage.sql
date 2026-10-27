CREATE TABLE IF NOT EXISTS agent_model_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  phone_hash TEXT,
  call_type TEXT NOT NULL,
  model TEXT NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_from TEXT,
  status TEXT NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'failed', 'blocked', 'unavailable')),
  reason TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  estimated_cost_brl NUMERIC(12, 4) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  model TEXT NOT NULL,
  call_type TEXT NOT NULL,
  total_calls INTEGER NOT NULL DEFAULT 0,
  successful_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(14, 6) NOT NULL DEFAULT 0,
  estimated_cost_brl NUMERIC(14, 4) NOT NULL DEFAULT 0,
  bookings_created INTEGER NOT NULL DEFAULT 0,
  handoffs INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agent_usage_daily UNIQUE (organization_id, usage_date, model, call_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_model_calls_org_created
  ON agent_model_calls (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_model_calls_session
  ON agent_model_calls (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_usage_daily_org_date
  ON agent_usage_daily (organization_id, usage_date DESC);
