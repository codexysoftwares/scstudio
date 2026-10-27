'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Sparkles, ImageIcon } from 'lucide-react'
import { fadeUp, slideInLeft, staggerContainer } from '@/lib/animations'
import type { PublicSiteContent } from '@/lib/public-data'

type AboutContent = PublicSiteContent['about']

const DEFAULTS: AboutContent = {
  title: 'Muito mais do que uma esmalteria, nasceu um sonho',
  body1: 'O SC Studio & Esmalteria nasceu do propósito de valorizar cada mulher que passa por aqui. Acreditamos que unhas bem cuidadas são uma extensão da personalidade e autoestima de cada cliente.',
  body2: 'Localizado no coração de Santa Efigênia, em Belo Horizonte, nosso espaço foi pensado para proporcionar conforto, relaxamento e uma experiência única de beleza. Cada detalhe é cuidadosamente planejado para que você se sinta especial.',
  accentColor: '',
  imageUrl: '',
  feature1Title: '',
  feature1Desc: '',
  feature2Title: '',
  feature2Desc: '',
  feature3Title: '',
  feature3Desc: '',
}

export function About({ content }: { content?: AboutContent | null }) {
  const c: AboutContent = {
    title: content?.title || DEFAULTS.title,
    body1: content?.body1 || DEFAULTS.body1,
    body2: content?.body2 || DEFAULTS.body2,
    accentColor: content?.accentColor || DEFAULTS.accentColor,
    imageUrl: content?.imageUrl || DEFAULTS.imageUrl,
    feature1Title: content?.feature1Title || DEFAULTS.feature1Title,
    feature1Desc: content?.feature1Desc || DEFAULTS.feature1Desc,
    feature2Title: content?.feature2Title || DEFAULTS.feature2Title,
    feature2Desc: content?.feature2Desc || DEFAULTS.feature2Desc,
    feature3Title: content?.feature3Title || DEFAULTS.feature3Title,
    feature3Desc: content?.feature3Desc || DEFAULTS.feature3Desc,
  }

  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const accentStyle = c.accentColor ? { color: c.accentColor } : undefined

  return (
    <section id="sobre" className="py-20 md:py-28 bg-background overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <motion.div
          ref={ref}
          className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center"
        >
          {/* Content */}
          <motion.div
            className="order-2 lg:order-1"
            variants={staggerContainer}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium tracking-wide">Sobre Nós</span>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-6 text-balance leading-tight"
            >
              {c.title.includes(' nasceu ') ? (
                <>
                  {c.title.split(' nasceu ')[0]}{' '}
                  <span
                    className={accentStyle ? 'italic' : 'text-primary italic'}
                    style={accentStyle}
                  >
                    nasceu {c.title.split(' nasceu ')[1]}
                  </span>
                </>
              ) : (
                <span style={accentStyle}>{c.title}</span>
              )}
            </motion.h2>

            <motion.p variants={fadeUp} className="text-muted-foreground text-lg leading-relaxed mb-6">
              {c.body1}
            </motion.p>

            <motion.p variants={slideInLeft} className="text-muted-foreground text-lg leading-relaxed">
              {c.body2}
            </motion.p>
          </motion.div>

          {/* Photo */}
          <motion.div
            className="order-1 lg:order-2"
            variants={fadeUp}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-full aspect-[4/5] rounded-3xl overflow-hidden border border-primary/15 shadow-[0_32px_80px_rgba(0,0,0,0.12)] ring-1 ring-primary/5 bg-secondary"
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt="Sobre o estúdio"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-primary/30">
                  <ImageIcon className="h-16 w-16" />
                  <p className="text-sm font-medium">Adicione uma foto na gestão</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
