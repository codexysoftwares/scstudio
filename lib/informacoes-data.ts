// Páginas programáticas de SEO local — nicho fixo (esmalteria/unhas), 1 unidade física,
// variando por bairro de Belo Horizonte. Nunca editar `informacoesPages` à mão — só via BAIRROS.
// Controle em /list.md (raiz do projeto).

export interface BairroInfo {
  slug: string
  label: string
  distanceNote: string
  localFlavor: string
}

const RAW_BAIRROS: BairroInfo[] = [
  {
    slug: 'santa-efigenia',
    label: 'Santa Efigênia',
    distanceNote: 'no coração da Santa Efigênia, a poucos passos do nosso endereço',
    localFlavor: 'é onde fica nossa unidade — cliente do bairro chega andando',
  },
  {
    slug: 'floresta',
    label: 'Floresta',
    distanceNote: 'a poucos minutos da Floresta',
    localFlavor: 'bairro vizinho da Santa Efigênia, trajeto curto até o estúdio',
  },
  {
    slug: 'sagrada-familia',
    label: 'Sagrada Família',
    distanceNote: 'saindo da Sagrada Família',
    localFlavor: 'bairro residencial tradicional, cliente costuma vir de carro ou aplicativo',
  },
  {
    slug: 'cruzeiro',
    label: 'Cruzeiro',
    distanceNote: 'vindo do Cruzeiro',
    localFlavor: 'região conhecida por concentrar salões e clínicas de beleza de BH',
  },
  {
    slug: 'savassi',
    label: 'Savassi',
    distanceNote: 'saindo da Savassi',
    localFlavor: 'polo comercial mais movimentado da cidade, cliente que já circula pela região central',
  },
  {
    slug: 'funcionarios',
    label: 'Funcionários',
    distanceNote: 'vindo do Funcionários',
    localFlavor: 'bairro residencial próximo ao centro, fácil acesso até a Santa Efigênia',
  },
  {
    slug: 'carmo',
    label: 'Carmo',
    distanceNote: 'saindo do Carmo',
    localFlavor: 'point de bares e vida noturna de BH, cliente que cuida da unha antes de sair à noite',
  },
  {
    slug: 'lourdes',
    label: 'Lourdes',
    distanceNote: 'vindo de Lourdes',
    localFlavor: 'um dos bairros mais tradicionais e nobres da cidade',
  },
  {
    slug: 'santo-antonio',
    label: 'Santo Antônio',
    distanceNote: 'saindo do Santo Antônio',
    localFlavor: 'bairro residencial tradicional, familiar',
  },
  {
    slug: 'anchieta',
    label: 'Anchieta',
    distanceNote: 'vindo da Anchieta',
    localFlavor: 'bairro nobre e arborizado, cliente que busca atendimento de padrão elevado',
  },
]

export const BAIRROS: BairroInfo[] = RAW_BAIRROS

export interface InformacoesPageData {
  slug: string
  bairro: string
  headline: string
  introParagraph: string
  seoTitle: string
  seoDescription: string
}

const WHATSAPP_PHONE = '5531990725053'

function buildPage(bairro: BairroInfo): InformacoesPageData {
  return {
    slug: bairro.slug,
    bairro: bairro.label,
    headline: `Esmalteria e Alongamento de Unhas perto do ${bairro.label}`,
    introParagraph: `${bairro.distanceNote.charAt(0).toUpperCase() + bairro.distanceNote.slice(1)}, o SC Studio & Esmalteria fica na Santa Efigênia, em Belo Horizonte — ${bairro.localFlavor}. Trabalhamos com alongamento de unhas, esmaltação e cuidados completos, com agendamento simples direto pelo WhatsApp.`,
    seoTitle: `Esmalteria perto do ${bairro.label} | SC Studio & Esmalteria BH`,
    seoDescription: `Alongamento de unhas e esmalteria a poucos minutos do ${bairro.label}, em Belo Horizonte. Agende seu horário pelo WhatsApp no SC Studio & Esmalteria.`,
  }
}

export const informacoesPages: InformacoesPageData[] = BAIRROS.map(buildPage)

export function getInformacoesPageBySlug(slug?: string): InformacoesPageData | undefined {
  if (!slug) return undefined
  return informacoesPages.find((p) => p.slug === slug)
}

export function whatsappHrefFor(bairro: string): string {
  const msg = `Olá! Vi a página do SC Studio sobre a região do ${bairro} e quero agendar um horário.`
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`
}
