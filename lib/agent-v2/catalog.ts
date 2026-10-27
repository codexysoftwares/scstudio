import 'server-only'

import { query } from '@/lib/db'
import { formatBRL, formatDuration, normalizeText } from '@/lib/agent-v2/utils'

export type AgentService = {
  id: string
  name: string
  normalizedName: string
  category: string
  durationMin: number
  durationLabel: string
  priceCents: number
  priceLabel: string
  description: string
  aliases: string[]
  professionals: Array<{
    id: string
    name: string
    normalizedName: string
    specialty: string
    isFeatured: boolean
  }>
}

export type AgentBundleRule = {
  id: string
  name: string
  normalizedName: string
  triggerAliases: string[]
  mode: 'sequential' | 'simultaneous'
  serviceIds: string[]
  fallbackServiceId: string | null
  requireDistinctProfessionals: boolean
}

export type AgentCatalog = {
  services: AgentService[]
  bundleRules: AgentBundleRule[]
}

type ServiceRow = {
  id: string
  name: string
  category: string
  duration_min: number
  price_cents: number
  description: string | null
  aliases: string[]
  professionals: Array<{
    id: string
    name: string
    specialty: string | null
    isFeatured: boolean
  }>
}

type BundleRuleRow = {
  id: string
  name: string
  normalized_name: string
  trigger_aliases: string[]
  mode: 'sequential' | 'simultaneous'
  service_ids: string[]
  fallback_service_id: string | null
  require_distinct_professionals: boolean
}

const serviceStopwords = new Set(['a', 'as', 'o', 'os', 'de', 'da', 'das', 'do', 'dos', 'e', 'em', 'no', 'na'])

function stemServiceToken(token: string) {
  if (token === 'pes') return 'pe'
  if (token === 'maos') return 'mao'
  if (token === 'cilios') return 'cilio'
  if (token === 'unhas') return 'unha'
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1)
  return token
}

function meaningfulTokens(value: string) {
  return normalizeText(value)
    .split(' ')
    .map(stemServiceToken)
    .filter((token) => token.length > 1 && !serviceStopwords.has(token))
}

function hasWholeTerm(text: string, term: string) {
  return new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(text)
}

function serviceScore(service: AgentService, normalizedText: string) {
  let score = 0
  const reasons: string[] = []
  const textTokens = new Set(meaningfulTokens(normalizedText))

  const normalizedName = service.normalizedName
  const nameTokens = meaningfulTokens(service.name)
  const shortServiceName = normalizedName.length <= 3 || nameTokens.length <= 1
  if (
    normalizedName &&
    (
      shortServiceName
        ? normalizedText === normalizedName || hasWholeTerm(normalizedText, normalizedName)
        : normalizedText.includes(normalizedName)
    )
  ) {
    score = Math.max(score, 220 + normalizedName.length)
    reasons.push('full_service_name')
  }

  if (nameTokens.length >= 2 && nameTokens.every((token) => textTokens.has(token))) {
    score = Math.max(score, 150 + nameTokens.length * 10)
    reasons.push('service_name_tokens')
  }

  for (const alias of service.aliases) {
    const normalizedAlias = normalizeText(alias)
    if (!normalizedAlias) continue

    const aliasTokens = meaningfulTokens(normalizedAlias)
    const isGenericAlias = normalizedAlias.length <= 3 || aliasTokens.length <= 1
    const aliasMatches = isGenericAlias
      ? normalizedText === normalizedAlias || hasWholeTerm(normalizedText, normalizedAlias)
      : normalizedText.includes(normalizedAlias)

    if (aliasMatches) {
      const aliasScore = isGenericAlias ? 30 : 130 + normalizedAlias.length
      score = Math.max(score, aliasScore)
      reasons.push(isGenericAlias ? 'generic_alias' : 'specific_alias')
    }
  }

  const descriptionTokens = meaningfulTokens(service.description)
  const descriptionHits = descriptionTokens.filter((token) => textTokens.has(token))
  if (descriptionHits.length >= 2) {
    score = Math.max(score, 65 + descriptionHits.length * 5)
    reasons.push('description_tokens')
  }

  if (nameTokens.length === 1 && hasWholeTerm(normalizedText, nameTokens[0])) {
    score = Math.max(score, 85)
    reasons.push('single_word_service_name')
  }

  return { service, score, reasons }
}

export async function getAgentCatalog(orgId: string): Promise<AgentCatalog> {
  const [serviceResult, bundleResult] = await Promise.all([
    query<ServiceRow>(
      `SELECT s.id,
              s.name,
              s.category,
              s.duration_min,
              s.price_cents,
              s.description,
              COALESCE(array_agg(DISTINCT sa.alias) FILTER (WHERE sa.id IS NOT NULL), ARRAY[]::text[]) AS aliases,
              COALESCE(
                json_agg(
                  DISTINCT jsonb_build_object(
                    'id', p.id,
                    'name', p.display_name,
                    'specialty', COALESCE(p.specialty, ''),
                    'isFeatured', p.is_featured
                  )
                ) FILTER (WHERE p.id IS NOT NULL),
                '[]'::json
              ) AS professionals
       FROM services s
       LEFT JOIN service_aliases sa ON sa.service_id = s.id
       LEFT JOIN service_professionals sp ON sp.service_id = s.id
       LEFT JOIN professionals p
         ON p.id = sp.professional_id
        AND p.accepts_online_booking = TRUE
       WHERE s.organization_id = $1
         AND s.is_active = TRUE
         AND s.online_booking_enabled = TRUE
       GROUP BY s.id
       ORDER BY s.is_featured DESC, s.name ASC`,
      [orgId]
    ),
    query<BundleRuleRow>(
      `SELECT id,
              name,
              normalized_name,
              trigger_aliases,
              mode,
              service_ids,
              fallback_service_id,
              require_distinct_professionals
       FROM service_bundle_rules
       WHERE organization_id = $1
         AND is_active = TRUE
       ORDER BY name ASC`,
      [orgId]
    ),
  ])

  const services = serviceResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    normalizedName: normalizeText(row.name),
    category: row.category,
    durationMin: row.duration_min,
    durationLabel: formatDuration(row.duration_min),
    priceCents: row.price_cents,
    priceLabel: formatBRL(row.price_cents),
    description: row.description ?? row.name,
    aliases: row.aliases ?? [],
    professionals: (row.professionals ?? []).map((professional) => ({
      id: professional.id,
      name: professional.name,
      normalizedName: normalizeText(professional.name),
      specialty: professional.specialty ?? '',
      isFeatured: professional.isFeatured,
    })),
  }))

  const bundleRules = bundleResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    triggerAliases: row.trigger_aliases ?? [],
    mode: row.mode,
    serviceIds: row.service_ids ?? [],
    fallbackServiceId: row.fallback_service_id,
    requireDistinctProfessionals: row.require_distinct_professionals,
  }))

  return { services, bundleRules }
}

export type ServiceResolution =
  | { type: 'none' }
  | { type: 'ambiguous'; matches: AgentService[] }
  | { type: 'single'; service: AgentService }
  | { type: 'bundle'; rule: AgentBundleRule; services: AgentService[]; fallbackService: AgentService | null }

export function resolveServiceFromText(text: string, catalog: AgentCatalog): ServiceResolution {
  const normalized = normalizeText(text)
  if (!normalized) return { type: 'none' }

  const rule = catalog.bundleRules.find((item) => {
    const terms = [item.name, item.normalizedName, ...item.triggerAliases].map(normalizeText)
    return terms.some((term) => term && normalized.includes(term))
  })
  if (rule) {
    return {
      type: 'bundle',
      rule,
      services: rule.serviceIds
        .map((serviceId) => catalog.services.find((service) => service.id === serviceId))
        .filter((service): service is AgentService => Boolean(service)),
      fallbackService: rule.fallbackServiceId
        ? catalog.services.find((service) => service.id === rule.fallbackServiceId) ?? null
        : null,
    }
  }

  const wantsFootAndHand =
    /\b(pe|pes|pedicure)\b/.test(normalized) &&
    /\b(mao|maos|manicure)\b/.test(normalized)

  if (wantsFootAndHand) {
    const foot = catalog.services.find((service) =>
      /\b(pe|pes|pedicure)\b/.test(service.normalizedName) &&
      !/\b(mao|maos|manicure)\b/.test(service.normalizedName)
    )
    const hand = catalog.services.find((service) =>
      /\b(mao|maos|manicure)\b/.test(service.normalizedName) &&
      !/\b(pe|pes|pedicure)\b/.test(service.normalizedName)
    )
    const fallback = catalog.services.find((service) =>
      /\b(pe|pes)\b/.test(service.normalizedName) &&
      /\b(mao|maos)\b/.test(service.normalizedName)
    ) ?? null

    if (foot && hand) {
      return {
        type: 'bundle',
        rule: {
          id: 'implicit-pe-mao',
          name: 'Pe e Mao',
          normalizedName: 'pe e mao',
          triggerAliases: ['pe e mao', 'mao e pe', 'manicure e pedicure'],
          mode: 'simultaneous',
          serviceIds: [foot.id, hand.id],
          fallbackServiceId: fallback?.id ?? null,
          requireDistinctProfessionals: true,
        },
        services: [foot, hand],
        fallbackService: fallback,
      }
    }

    if (fallback) return { type: 'single', service: fallback }
  }

  const scored = catalog.services
    .map((service) => serviceScore(service, normalized))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)

  const strongMatches = scored.filter((match) => match.score >= 100)
  const matches = strongMatches.length ? strongMatches : scored

  if (matches.length === 1) return { type: 'single', service: matches[0].service }
  if (matches.length > 1) {
    const [best, second] = matches
    if (best.score >= 100 && best.score - second.score >= 40) {
      return { type: 'single', service: best.service }
    }
    return { type: 'ambiguous', matches: matches.slice(0, 5).map((match) => match.service) }
  }

  return { type: 'none' }
}

export function findProfessionalFromText(text: string, services: AgentService[]) {
  const normalized = normalizeText(text)
  const professionals = services.flatMap((service) => service.professionals)
  const unique = [...new Map(professionals.map((professional) => [professional.id, professional])).values()]

  return unique.find((professional) => {
    const firstName = professional.normalizedName.split(' ')[0]
    return firstName.length > 2 && normalized.includes(firstName)
  }) ?? null
}
