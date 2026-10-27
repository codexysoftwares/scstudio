import { NextResponse } from 'next/server'

import { isAgentRequestAuthorized } from '@/lib/agent-auth'
import { getAgentCatalog } from '@/lib/agent-v2/catalog'
import { getPublicBusinessHours, getPublicServices, getPublicSiteContent } from '@/lib/public-data'
import { resolveDefaultOrgId } from '@/lib/whatsapp-service'

export async function GET(req: Request) {
  if (!isAgentRequestAuthorized(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const orgId = await resolveDefaultOrgId()
  const [services, siteContent, businessHours, catalog] = await Promise.all([
    getPublicServices(),
    getPublicSiteContent(),
    getPublicBusinessHours(),
    orgId ? getAgentCatalog(orgId) : Promise.resolve({ services: [], bundleRules: [] }),
  ])

  const servicesWithAgentMetadata = services.map((service) => {
    const agentService = catalog.services.find((item) => item.id === service.id)
    return {
      ...service,
      aliases: agentService?.aliases ?? [],
      professionals: agentService?.professionals.map((professional) => ({
        id: professional.id,
        name: professional.name,
        specialty: professional.specialty,
        isFeatured: professional.isFeatured,
      })) ?? service.professionals ?? [],
    }
  })

  return NextResponse.json({
    services: servicesWithAgentMetadata,
    bundleRules: catalog.bundleRules,
    contact: siteContent?.contact ?? null,
    businessHours,
    requireDeposit: siteContent?.requireDeposit ?? false,
    testimonials: siteContent?.testimonials ?? [],
  })
}
