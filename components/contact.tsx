'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, MapPin, Phone, Instagram, MessageCircle } from 'lucide-react'
import { fadeUp, staggerContainer, cardReveal } from '@/lib/animations'
import type { PublicSiteContent } from '@/lib/public-data'

type ContactContent = PublicSiteContent['contact']

const DEFAULTS: ContactContent = {
  title: 'Vem nos visitar',
  subtitle: 'Estamos esperando você para cuidar da sua beleza',
  phone: '5531990725053',
  whatsappDisplay: '(31) 99072-5053',
  instagramHandle: 'scstudioeesmalteria',
  addressText: 'Rua Padre Correia de Almeida, 38\nSanta Efigênia, Belo Horizonte - MG\nCEP: 30260-350',
  mapsEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3750.8835!2d-43.9180!3d-19.9167!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDU1JzAwLjEiUyA0M8KwNTUnMDQuOCJX!5e0!3m2!1spt-BR!2sbr!4v1234567890',
}

export function Contact({ content }: { content?: ContactContent | null }) {
  const c: ContactContent = {
    title: content?.title || DEFAULTS.title,
    subtitle: content?.subtitle || DEFAULTS.subtitle,
    phone: content?.phone || DEFAULTS.phone,
    whatsappDisplay: content?.whatsappDisplay || DEFAULTS.whatsappDisplay,
    instagramHandle: content?.instagramHandle || DEFAULTS.instagramHandle,
    addressText: content?.addressText || DEFAULTS.addressText,
    mapsEmbedUrl: content?.mapsEmbedUrl || DEFAULTS.mapsEmbedUrl,
  }

  const whatsappHref = `https://wa.me/${c.phone.replace(/\D/g, '')}`
  const instagramHref = `https://instagram.com/${c.instagramHandle.replace('@', '')}`
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(c.addressText)}`

  const cards = [
    {
      icon: MapPin,
      title: 'Localização',
      body: (
        <p className="text-muted-foreground text-sm leading-relaxed mb-4 whitespace-pre-line">
          {c.addressText}
        </p>
      ),
      cta: (
        <Button asChild variant="outline" size="sm" className="font-medium">
          <a href={mapsHref} target="_blank" rel="noopener noreferrer">Como Chegar</a>
        </Button>
      ),
    },
    {
      icon: MessageCircle,
      title: 'WhatsApp',
      body: (
        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
          Entre em contato pelo WhatsApp<br />
          para tirar dúvidas ou agendar<br />
          seu horário
        </p>
      ),
      cta: (
        <Button asChild size="sm" className="font-medium">
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <Phone className="h-4 w-4 mr-2" />
            {c.whatsappDisplay}
          </a>
        </Button>
      ),
    },
    {
      icon: Instagram,
      title: 'Instagram',
      body: (
        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
          Siga nosso Instagram para ver<br />
          nossos trabalhos e ficar por<br />
          dentro das novidades
        </p>
      ),
      cta: (
        <Button asChild variant="outline" size="sm" className="font-medium">
          <a href={instagramHref} target="_blank" rel="noopener noreferrer">
            @{c.instagramHandle.replace('@', '')}
          </a>
        </Button>
      ),
      span: true,
    },
  ]

  const ref = useRef(null)
  const mapRef = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const mapInView = useInView(mapRef, { once: true, margin: '-60px' })

  return (
    <section id="contato" className="py-20 md:py-28 bg-secondary/30">
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">

        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium tracking-wide">Contato</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4 text-balance">
            {c.title}
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground text-lg">
            {c.subtitle}
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          {cards.map((card) => (
            <motion.div
              key={card.title}
              variants={cardReveal}
              className={card.span ? 'md:col-span-2 lg:col-span-1' : ''}
            >
              <motion.div
                whileHover={{ y: -6, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.12)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="h-full"
              >
                <Card className="bg-card border-border/50 shadow-lg h-full group">
                  <CardContent className="p-6 text-center">
                    <motion.div
                      whileHover={{ scale: 1.12, rotate: 6 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                      className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors"
                    >
                      <card.icon className="h-6 w-6 text-primary" />
                    </motion.div>
                    <h3 className="font-semibold text-foreground mb-2">{card.title}</h3>
                    {card.body}
                    {card.cta}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Map */}
        {c.mapsEmbedUrl && (
          <motion.div
            ref={mapRef}
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={mapInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-12 max-w-5xl mx-auto"
          >
            <div className="aspect-video rounded-2xl overflow-hidden border border-border/50 shadow-lg bg-muted">
              <iframe
                src={c.mapsEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização SC Studio & Esmalteria"
                className="grayscale hover:grayscale-0 transition-all duration-500"
              />
            </div>
          </motion.div>
        )}

      </div>
    </section>
  )
}
