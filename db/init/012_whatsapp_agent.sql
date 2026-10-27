CREATE TABLE IF NOT EXISTS whatsapp_integration_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'evolution',
  evolution_base_url TEXT,
  evolution_api_key TEXT,
  evolution_instance_name TEXT,
  evolution_instance_id TEXT,
  evolution_webhook_secret TEXT,
  evolution_connected BOOLEAN NOT NULL DEFAULT FALSE,
  ollama_base_url TEXT,
  ollama_model TEXT NOT NULL DEFAULT 'llama3.1:8b',
  agent_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  booking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  invisible_handoff_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  human_handoff_target TEXT,
  test_phone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_behavior_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  assistant_name TEXT NOT NULL DEFAULT 'Recepcao SC',
  persona_prompt TEXT NOT NULL DEFAULT 'Voce atende em nome da Recepcao SC. Fale com naturalidade, clareza e simpatia. Ajude a cliente com servicos, horarios, localizacao e agendamentos, sempre seguindo a disponibilidade real da agenda. Nunca use linguagem tecnica e nunca diga que e um bot.',
  welcome_message TEXT NOT NULL DEFAULT 'Ola! Recepcao SC por aqui. Como posso te ajudar hoje?',
  fallback_message TEXT NOT NULL DEFAULT 'Consigo te ajudar com servicos, horarios, localizacao e agendamentos. Se preferir, continuo seu atendimento por aqui.',
  handoff_message TEXT NOT NULL DEFAULT 'Perfeito. Vou seguir com seu atendimento por aqui.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  display_name TEXT,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_contacts_org_phone UNIQUE (organization_id, phone_e164)
);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  handoff_state TEXT NOT NULL DEFAULT 'agent',
  assigned_staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_whatsapp_conversation_status CHECK (status IN ('open', 'closed', 'archived')),
  CONSTRAINT chk_whatsapp_handoff_state CHECK (handoff_state IN ('agent', 'queued', 'human'))
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'evolution',
  provider_message_id TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT NOT NULL DEFAULT '',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_whatsapp_message_direction CHECK (direction IN ('inbound', 'outbound')),
  CONSTRAINT chk_whatsapp_message_status CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'received'))
);

CREATE TABLE IF NOT EXISTS agent_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  booking_group_id UUID REFERENCES booking_groups(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'agent',
  action_type TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_agent_action_result CHECK (result_status IN ('success', 'failed', 'handoff'))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_org_phone
  ON whatsapp_contacts (organization_id, phone_e164);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_org_contact
  ON whatsapp_conversations (organization_id, contact_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_created
  ON whatsapp_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_action_logs_conversation_created
  ON agent_action_logs (conversation_id, created_at DESC);
