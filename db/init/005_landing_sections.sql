-- Hero extensions
ALTER TABLE landing_page_settings
  ADD COLUMN IF NOT EXISTS hero_badge_text TEXT DEFAULT 'Especialistas em Unhas & Alongamento',
  ADD COLUMN IF NOT EXISTS hero_title_highlight TEXT DEFAULT 'valoriza',
  ADD COLUMN IF NOT EXISTS hero_accent_color TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_stat_1_value TEXT DEFAULT '5+',
  ADD COLUMN IF NOT EXISTS hero_stat_1_label TEXT DEFAULT 'Anos de Experiência',
  ADD COLUMN IF NOT EXISTS hero_stat_2_value TEXT DEFAULT '1000+',
  ADD COLUMN IF NOT EXISTS hero_stat_2_label TEXT DEFAULT 'Clientes Felizes',
  ADD COLUMN IF NOT EXISTS hero_stat_3_value TEXT DEFAULT '15+',
  ADD COLUMN IF NOT EXISTS hero_stat_3_label TEXT DEFAULT 'Serviços Disponíveis';

-- About section
ALTER TABLE landing_page_settings
  ADD COLUMN IF NOT EXISTS about_title TEXT DEFAULT 'Muito mais do que uma esmalteria, nasceu um sonho',
  ADD COLUMN IF NOT EXISTS about_body_1 TEXT DEFAULT 'O SC Studio & Esmalteria nasceu do propósito de valorizar cada mulher que passa por aqui. Acreditamos que unhas bem cuidadas são uma extensão da personalidade e autoestima de cada cliente.',
  ADD COLUMN IF NOT EXISTS about_body_2 TEXT DEFAULT 'Localizado no coração de Santa Efigênia, em Belo Horizonte, nosso espaço foi pensado para proporcionar conforto, relaxamento e uma experiência única de beleza.',
  ADD COLUMN IF NOT EXISTS about_accent_color TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS about_feature_1_title TEXT DEFAULT 'Atendimento Acolhedor',
  ADD COLUMN IF NOT EXISTS about_feature_1_desc TEXT DEFAULT 'Cada cliente é única e merece um atendimento personalizado e carinhoso.',
  ADD COLUMN IF NOT EXISTS about_feature_2_title TEXT DEFAULT 'Qualidade Premium',
  ADD COLUMN IF NOT EXISTS about_feature_2_desc TEXT DEFAULT 'Utilizamos apenas produtos de alta qualidade para garantir durabilidade e beleza.',
  ADD COLUMN IF NOT EXISTS about_feature_3_title TEXT DEFAULT 'Profissionais Especializados',
  ADD COLUMN IF NOT EXISTS about_feature_3_desc TEXT DEFAULT 'Nossa equipe é constantemente atualizada nas últimas técnicas e tendências.';

-- Contact section titles
ALTER TABLE landing_page_settings
  ADD COLUMN IF NOT EXISTS contact_title TEXT DEFAULT 'Vem nos visitar',
  ADD COLUMN IF NOT EXISTS contact_subtitle TEXT DEFAULT 'Estamos esperando você para cuidar da sua beleza';

-- Organization contact info (used across footer + contact section)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT DEFAULT 'scstudioeesmalteria',
  ADD COLUMN IF NOT EXISTS address_text TEXT DEFAULT 'Rua Padre Correia de Almeida, 38 - Santa Efigênia, Belo Horizonte - MG',
  ADD COLUMN IF NOT EXISTS maps_embed_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_display TEXT DEFAULT '(31) 99072-5053';

-- Testimonials CRUD table
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  service_name TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
