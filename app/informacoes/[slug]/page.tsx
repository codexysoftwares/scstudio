import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, MapPin, CheckCircle2 } from 'lucide-react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { informacoesPages, getInformacoesPageBySlug, whatsappHrefFor } from '@/lib/informacoes-data'

export const revalidate = 3600

export function generateStaticParams() {
  return informacoesPages.map((p) => ({ slug: p.slug }))
}

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const page = getInformacoesPageBySlug(slug)
  if (!page) return { title: 'Página não encontrada | SC Studio & Esmalteria' }

  const canonical = `https://scstudioeesmalteria.com.br/informacoes/${page.slug}`

  return {
    title: page.seoTitle,
    description: page.seoDescription,
    alternates: { canonical },
    openGraph: {
      title: page.seoTitle,
      description: page.seoDescription,
      url: canonical,
      locale: 'pt_BR',
      type: 'website',
    },
    robots: { index: true, follow: true },
  }
}

const SERVICES = [
  { title: 'Alongamento de unhas', description: 'Fibra, acrigel e gel — moldado no formato que combina com você.' },
  { title: 'Esmaltação em gel', description: 'Cor com brilho e durabilidade, sem lascar em poucos dias.' },
  { title: 'Manutenção', description: 'Retoque e cuidado contínuo pra manter a unha sempre em dia.' },
]

const FAQ = [
  { question: 'Preciso agendar com antecedência?', answer: 'Recomendamos sim, principalmente fim de semana — mas você pode consultar disponibilidade direto pelo WhatsApp.' },
  { question: 'Vocês atendem clientes de fora da Santa Efigênia?', answer: 'Sim! Recebemos clientes de toda a Grande BH, muitas vindas de bairros vizinhos como este.' },
  { question: 'Como funciona o agendamento?', answer: 'É só chamar no WhatsApp — a gente confirma o melhor horário disponível pra você.' },
]

export default async function InformacoesPage({ params }: PageProps) {
  const { slug } = await params
  const page = getInformacoesPageBySlug(slug)
  if (!page) notFound()

  const waHref = whatsappHrefFor(page.bairro)

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-foreground text-background pt-32 pb-20 px-6 sm:px-10 lg:px-16">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-background/10 border border-background/20 text-background/80 text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full mb-6">
            <MapPin className="h-3.5 w-3.5" />
            Perto do {page.bairro}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight mb-5">
            {page.headline}
          </h1>
          <p className="text-background/70 text-lg max-w-2xl mx-auto mb-8">
            Especialistas em Unhas & Alongamento. Beleza que valoriza você.
          </p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-accent text-foreground px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity"
          >
            <Sparkles className="h-4 w-4" />
            Agendar pelo WhatsApp
          </a>
        </div>
      </section>

      {/* Intro */}
      <section className="max-w-3xl mx-auto px-6 sm:px-10 lg:px-16 py-14">
        <p className="text-foreground/70 text-lg leading-relaxed">{page.introParagraph}</p>
      </section>

      {/* Services */}
      <section className="bg-muted/40 py-14 px-6 sm:px-10 lg:px-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-8 text-center">
            O que fazemos
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {SERVICES.map((item) => (
              <div key={item.title} className="bg-background rounded-xl p-6 border border-foreground/10">
                <CheckCircle2 className="text-accent mb-3 h-5 w-5" />
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-foreground/60 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 px-6 sm:px-10 lg:px-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-8 text-center">
            Perguntas frequentes
          </h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div key={item.question} className="bg-muted/30 rounded-xl p-5 border border-foreground/10">
                <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
                <p className="text-foreground/60 text-sm leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 text-center px-6">
        <h2 className="font-display text-2xl font-semibold text-foreground mb-4">
          Vem cuidar da sua unha com a gente
        </h2>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-accent text-foreground px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity"
        >
          <Sparkles className="h-4 w-4" />
          Falar no WhatsApp agora
        </a>
        <p className="text-foreground/50 text-sm mt-6">
          <Link href="/" className="underline hover:text-foreground transition-colors">
            Voltar para a página inicial
          </Link>
        </p>
      </section>

      <Footer />
      <WhatsAppButton />
    </main>
  )
}
