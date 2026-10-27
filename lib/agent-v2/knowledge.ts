import 'server-only'

import crypto from 'node:crypto'

import { embed, embedMany } from 'ai'
import { openai } from '@ai-sdk/openai'

import { query, withTransaction } from '@/lib/db'
import { recordAgentModelCall } from '@/lib/agent-v2/llm/usage'
import { getPublicBusinessHours, getPublicServices, getPublicSiteContent } from '@/lib/public-data'
import { normalizeText } from '@/lib/agent-v2/utils'

export type KnowledgeHit = {
  title: string
  content: string
  sourceType: string
}

function hashContent(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function chunkText(text: string, maxLength = 900) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).trim().length > maxLength && current) {
      chunks.push(current)
      current = paragraph
    } else {
      current = (current ? `${current}\n\n${paragraph}` : paragraph).trim()
    }
  }

  if (current) chunks.push(current)
  return chunks.length ? chunks : [text.slice(0, maxLength)]
}

function isEnabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase())
}

async function hasEmbeddingColumn() {
  try {
    const result = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_name = 'agent_knowledge_chunks'
           AND column_name = 'embedding'
       ) AS exists`
    )
    return Boolean(result.rows[0]?.exists)
  } catch {
    return false
  }
}

async function embedKnowledgeChunks(orgId: string, chunks: Array<{ id: string; content: string }>) {
  if (!chunks.length) return
  if (!isEnabled(process.env.AGENT_EMBEDDINGS_ENABLED)) return
  if (!process.env.OPENAI_API_KEY) return
  if (!(await hasEmbeddingColumn())) return

  const model = process.env.AGENT_EMBEDDING_MODEL || 'text-embedding-3-small'
  const started = Date.now()
  try {
    const result = await embedMany({
      model: openai.embedding(model),
      values: chunks.map((chunk) => chunk.content),
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(20_000),
    })

    await Promise.all(result.embeddings.map((embedding, index) =>
      query(
        `UPDATE agent_knowledge_chunks
         SET embedding = $2::vector
         WHERE id = $1`,
        [chunks[index].id, JSON.stringify(embedding)]
      )
    ))

    await recordAgentModelCall({
      orgId,
      callType: 'embedding',
      model,
      status: 'success',
      reason: 'knowledge_reindex_embedding',
      inputTokens: result.usage.tokens,
      outputTokens: 0,
      totalTokens: result.usage.tokens,
      latencyMs: Date.now() - started,
      tags: ['rag:reindex'],
      metadata: { chunks: chunks.length },
    })
  } catch (error) {
    await recordAgentModelCall({
      orgId,
      callType: 'embedding',
      model,
      status: 'failed',
      reason: error instanceof Error ? error.message.slice(0, 500) : 'embedding_failed',
      latencyMs: Date.now() - started,
      tags: ['rag:reindex'],
      metadata: { chunks: chunks.length },
    })
  }
}

async function upsertDocument(input: {
  orgId: string
  sourceType: string
  sourceId: string
  title: string
  body: string
  metadata?: Record<string, unknown>
}) {
  const contentHash = hashContent(input.body)
  const insertedChunks = await withTransaction(async (client) => {
    const documentResult = await client.query<{ id: string }>(
      `INSERT INTO agent_knowledge_documents
         (organization_id, source_type, source_id, title, body, metadata, content_hash, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, TRUE, NOW())
       ON CONFLICT (organization_id, source_type, source_id)
       DO UPDATE SET
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         metadata = EXCLUDED.metadata,
         content_hash = EXCLUDED.content_hash,
         is_active = TRUE,
         updated_at = NOW()
       RETURNING id`,
      [
        input.orgId,
        input.sourceType,
        input.sourceId,
        input.title,
        input.body,
        JSON.stringify(input.metadata ?? {}),
        contentHash,
      ]
    )

    const documentId = documentResult.rows[0].id
    await client.query('DELETE FROM agent_knowledge_chunks WHERE document_id = $1', [documentId])

    const chunks = chunkText(input.body)
    const inserted: Array<{ id: string; content: string }> = []
    for (const [index, chunk] of chunks.entries()) {
      const chunkResult = await client.query<{ id: string }>(
        `INSERT INTO agent_knowledge_chunks
           (organization_id, document_id, chunk_index, content, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING id`,
        [input.orgId, documentId, index, chunk, JSON.stringify(input.metadata ?? {})]
      )
      inserted.push({ id: chunkResult.rows[0].id, content: chunk })
    }

    return inserted
  })

  await embedKnowledgeChunks(input.orgId, insertedChunks)
}

export async function reindexAgentKnowledge(orgId: string) {
  const [services, siteContent, businessHours] = await Promise.all([
    getPublicServices(),
    getPublicSiteContent(),
    getPublicBusinessHours(),
  ])

  for (const service of services) {
    await upsertDocument({
      orgId,
      sourceType: 'service',
      sourceId: service.id ?? service.name,
      title: `Servico: ${service.name}`,
      body: [
        `${service.name}`,
        `Categoria: ${service.category}`,
        `Duracao: ${service.duration}`,
        `Valor: ${service.price}`,
        `Descricao: ${service.description}`,
        service.professionals?.length
          ? `Profissionais: ${service.professionals.map((professional) => professional.name).join(', ')}`
          : '',
      ].filter(Boolean).join('\n'),
      metadata: { serviceId: service.id ?? null },
    })
  }

  if (siteContent?.contact) {
    await upsertDocument({
      orgId,
      sourceType: 'contact',
      sourceId: 'contact',
      title: 'Contato e localizacao',
      body: [
        siteContent.contact.title,
        siteContent.contact.subtitle,
        `WhatsApp: ${siteContent.contact.whatsappDisplay || siteContent.contact.phone}`,
        `Instagram: ${siteContent.contact.instagramHandle}`,
        `Endereco: ${siteContent.contact.addressText}`,
      ].filter(Boolean).join('\n'),
    })
  }

  await upsertDocument({
    orgId,
    sourceType: 'business_hours',
    sourceId: 'business_hours',
    title: 'Horario de funcionamento',
    body: businessHours.map((hour) => {
      if (hour.isClosed || !hour.opensAt || !hour.closesAt) return `${hour.weekday}: fechado`
      return `${hour.weekday}: ${hour.opensAt} as ${hour.closesAt}`
    }).join('\n'),
  })

  await seedDefaultAliasesAndBundles(orgId)

  return { ok: true, documentsIndexed: services.length + 2 }
}

async function seedDefaultAliasesAndBundles(orgId: string) {
  const services = await query<{ id: string; name: string }>(
    `SELECT id, name FROM services WHERE organization_id = $1 AND is_active = TRUE`,
    [orgId]
  )

  for (const service of services.rows) {
    const aliases = new Set<string>([service.name, normalizeText(service.name)])
    const normalizedName = normalizeText(service.name)
    if (normalizedName.includes('manicure') || /\bmao\b/.test(normalizedName)) aliases.add('mao')
    if (normalizedName.includes('pedicure') || /\bpe\b/.test(normalizedName)) aliases.add('pe')
    if (normalizedName.includes('cilio')) aliases.add('cilios')
    if (normalizedName.includes('sobrancelha') || normalizedName.includes('designer')) aliases.add('sobrancelha')

    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias)
      if (!normalizedAlias) continue
      await query(
        `INSERT INTO service_aliases (organization_id, service_id, alias, normalized_alias, source)
         VALUES ($1, $2, $3, $4, 'auto')
         ON CONFLICT (organization_id, normalized_alias) DO NOTHING`,
        [orgId, service.id, alias, normalizedAlias]
      )
    }
  }

  const foot = services.rows.find((service) => {
    const name = normalizeText(service.name)
    return /\b(pe|pedicure)\b/.test(name) && !/\bmao\b/.test(name)
  })
  const hand = services.rows.find((service) => {
    const name = normalizeText(service.name)
    return /\b(mao|manicure)\b/.test(name) && !/\bpe\b/.test(name)
  })
  const fallback = services.rows.find((service) => {
    const name = normalizeText(service.name)
    return /\bpe\b/.test(name) && /\bmao\b/.test(name)
  })

  if (foot && hand) {
    await query(
      `INSERT INTO service_bundle_rules
         (organization_id, name, normalized_name, trigger_aliases, mode, service_ids, fallback_service_id, require_distinct_professionals)
       VALUES ($1, 'Pe e Mao', 'pe e mao', $2::text[], 'simultaneous', $3::uuid[], $4, TRUE)
       ON CONFLICT (organization_id, normalized_name)
       DO UPDATE SET
         trigger_aliases = EXCLUDED.trigger_aliases,
         mode = EXCLUDED.mode,
         service_ids = EXCLUDED.service_ids,
         fallback_service_id = EXCLUDED.fallback_service_id,
         require_distinct_professionals = TRUE,
         is_active = TRUE,
         updated_at = NOW()`,
      [
        orgId,
        ['pe e mao', 'mao e pe', 'manicure e pedicure', 'pedicure e manicure'],
        [foot.id, hand.id],
        fallback?.id ?? null,
      ]
    )
  }
}

export async function searchAgentKnowledge(orgId: string, text: string, limit = 4): Promise<KnowledgeHit[]> {
  const normalized = normalizeText(text)
  if (!normalized) return []

  if (isEnabled(process.env.AGENT_EMBEDDINGS_ENABLED) && process.env.OPENAI_API_KEY && await hasEmbeddingColumn()) {
    const model = process.env.AGENT_EMBEDDING_MODEL || 'text-embedding-3-small'
    const started = Date.now()
    try {
      const embedded = await embed({
        model: openai.embedding(model),
        value: text,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(12_000),
      })
      await recordAgentModelCall({
        orgId,
        callType: 'embedding',
        model,
        status: 'success',
        reason: 'knowledge_search_embedding',
        inputTokens: embedded.usage.tokens,
        totalTokens: embedded.usage.tokens,
        latencyMs: Date.now() - started,
        tags: ['rag:search'],
      })

      const vectorResult = await query<{
        title: string
        content: string
        source_type: string
      }>(
        `SELECT d.title,
                c.content,
                d.source_type
         FROM agent_knowledge_chunks c
         INNER JOIN agent_knowledge_documents d ON d.id = c.document_id
         WHERE c.organization_id = $1
           AND d.is_active = TRUE
           AND c.embedding IS NOT NULL
         ORDER BY c.embedding <-> $2::vector
         LIMIT $3`,
        [orgId, JSON.stringify(embedded.embedding), limit]
      )

      if (vectorResult.rows.length) {
        return vectorResult.rows.map((row) => ({
          title: row.title,
          content: row.content,
          sourceType: row.source_type,
        }))
      }
    } catch (error) {
      await recordAgentModelCall({
        orgId,
        callType: 'embedding',
        model,
        status: 'failed',
        reason: error instanceof Error ? error.message.slice(0, 500) : 'knowledge_search_embedding_failed',
        latencyMs: Date.now() - started,
        tags: ['rag:search'],
      })
    }
  }

  const result = await query<{
    title: string
    content: string
    source_type: string
  }>(
    `SELECT d.title,
            c.content,
            d.source_type
     FROM agent_knowledge_chunks c
     INNER JOIN agent_knowledge_documents d ON d.id = c.document_id
     WHERE c.organization_id = $1
       AND d.is_active = TRUE
       AND (
         c.search_vector @@ plainto_tsquery('portuguese', $2)
         OR lower(c.content) LIKE '%' || lower($2) || '%'
       )
     ORDER BY ts_rank(c.search_vector, plainto_tsquery('portuguese', $2)) DESC,
              c.created_at DESC
     LIMIT $3`,
    [orgId, normalized, limit]
  )

  return result.rows.map((row) => ({
    title: row.title,
    content: row.content,
    sourceType: row.source_type,
  }))
}
