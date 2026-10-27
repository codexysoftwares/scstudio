'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Sparkles, ArrowRight } from 'lucide-react'
import { fadeUp, slideInRight, staggerContainer } from '@/lib/animations'
import type { PublicSiteContent } from '@/lib/public-data'

type HeroContent = PublicSiteContent['hero']

const DEFAULTS: HeroContent = {
  title: 'Beleza que valoriza você',
  subtitle: 'Muito mais do que uma esmalteria, nasceu um sonho e um propósito. Elevamos sua autoestima com unhas impecáveis e atendimento cuidadoso, focado em detalhes e elegância.',
  badgeText: 'Especialistas em Unhas & Alongamento',
  titleHighlight: 'valoriza',
  accentColor: '',
  imageUrl: '',
  primaryCtaLabel: 'Agendar Horário',
  secondaryCtaLabel: 'Ver Serviços',
  stat1Value: '5+',
  stat1Label: 'Anos de\nExperiência',
  stat2Value: '1000+',
  stat2Label: 'Clientes\nFelizes',
  stat3Value: '15+',
  stat3Label: 'Serviços\nDisponíveis',
}

function renderTitle(title: string, highlight: string, accentColor: string) {
  if (!highlight || !title.includes(highlight)) {
    return <>{title}</>
  }
  const parts = title.split(highlight)
  const color = accentColor || undefined
  return (
    <>
      {parts[0]}
      <em className={color ? 'not-italic' : 'text-primary not-italic'} style={color ? { color } : undefined}>
        {highlight}
      </em>
      {parts[1]}
    </>
  )
}

export function Hero({ content }: { content?: HeroContent | null }) {
  const c: HeroContent = {
    title: content?.title || DEFAULTS.title,
    subtitle: content?.subtitle || DEFAULTS.subtitle,
    badgeText: content?.badgeText || DEFAULTS.badgeText,
    titleHighlight: content?.titleHighlight ?? DEFAULTS.titleHighlight,
    accentColor: content?.accentColor || DEFAULTS.accentColor,
    imageUrl: content?.imageUrl || DEFAULTS.imageUrl,
    primaryCtaLabel: content?.primaryCtaLabel || DEFAULTS.primaryCtaLabel,
    secondaryCtaLabel: content?.secondaryCtaLabel || DEFAULTS.secondaryCtaLabel,
    stat1Value: content?.stat1Value || DEFAULTS.stat1Value,
    stat1Label: content?.stat1Label || DEFAULTS.stat1Label,
    stat2Value: content?.stat2Value || DEFAULTS.stat2Value,
    stat2Label: content?.stat2Label || DEFAULTS.stat2Label,
    stat3Value: content?.stat3Value || DEFAULTS.stat3Value,
    stat3Label: content?.stat3Label || DEFAULTS.stat3Label,
  }

  const stats = [
    { value: c.stat1Value, label: c.stat1Label },
    { value: c.stat2Value, label: c.stat2Label },
    { value: c.stat3Value, label: c.stat3Label },
  ]

  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const photoY = useTransform(scrollYProgress, [0, 1], ['0%', '12%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '6%'])

  return (
    <section
      ref={sectionRef}
      id="inicio"
      className="relative min-h-screen flex flex-col justify-center overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/60 via-background to-background" />
      <motion.div
        className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-primary/5 blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-28 pb-16 lg:pt-32 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-24 items-center">
          <motion.div
            className="order-1 lg:order-2 flex justify-center"
            style={{ y: photoY, perspective: 1000 }}
            variants={slideInRight}
            initial="hidden"
            animate="visible"
          >
            <div className="relative w-full max-w-[220px] sm:max-w-[300px] lg:max-w-[440px]">
              <motion.div
                className="relative rounded-full overflow-hidden shadow-[0_28px_60px_rgba(78,52,46,0.16)] aspect-square"
                whileHover={{ scale: 1.02, rotateY: -3, rotateX: 2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <Image
                  src={c.imageUrl || '/logosc.jpg'}
                  alt="SC Studio & Esmalteria"
                  fill
                  className="object-cover object-center"
                  priority
                />
                <div className="absolute inset-0 rounded-full ring-1 ring-primary/10" />
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            className="order-2 lg:order-1 flex flex-col items-center lg:items-start text-center lg:text-left"
            style={{ y: contentY }}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs sm:text-sm font-medium tracking-widest uppercase">
                {c.badgeText}
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-[1.1] tracking-tight mb-6 text-foreground"
            >
              {renderTitle(c.title, c.titleHighlight, c.accentColor)}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-base sm:text-lg text-muted-foreground max-w-md mb-9 leading-relaxed"
            >
              {c.subtitle}
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mb-12"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  asChild
                  size="lg"
                  className="w-full sm:w-auto text-sm sm:text-base font-medium tracking-wide px-8 py-6"
                >
                  <a href="#agendamento">
                    {c.primaryCtaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto text-sm sm:text-base font-medium tracking-wide px-8 py-6"
                >
                  <a href="#servicos">{c.secondaryCtaLabel}</a>
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              className="flex items-start gap-8 sm:gap-12 justify-center lg:justify-start"
            >
              {stats.map((stat) => (
                <motion.div key={stat.value + stat.label} variants={fadeUp} className="flex flex-col items-center lg:items-start">
                  <span
                    className={`text-2xl sm:text-3xl font-semibold leading-none ${c.accentColor ? '' : 'text-primary'}`}
                    style={c.accentColor ? { color: c.accentColor } : undefined}
                  >
                    {stat.value}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1.5 leading-snug whitespace-pre-line">{stat.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-7 left-1/2 -translate-x-1/2 hidden lg:flex"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.6 }}
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-9 rounded-full border-2 border-primary/30 flex items-start justify-center pt-1.5"
        >
          <div className="w-0.5 h-2 rounded-full bg-primary/60" />
        </motion.div>
      </motion.div>
    </section>
  )
}
