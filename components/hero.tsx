'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Sparkles, ArrowRight } from 'lucide-react'
import { fadeUp, scaleIn, slideInRight, staggerContainer } from '@/lib/animations'

export function Hero() {
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
      {/* Background */}
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

          {/* RIGHT: photo — appears first on mobile */}
          <motion.div
            className="order-1 lg:order-2 flex justify-center"
            style={{ y: photoY, perspective: 1000 }}
            variants={slideInRight}
            initial="hidden"
            animate="visible"
          >
            <div className="relative w-full max-w-[160px] sm:max-w-[200px] lg:max-w-[380px]">
              <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl border border-primary/20 pointer-events-none" />
              <motion.div
                className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[3/4]"
                whileHover={{ scale: 1.02, rotateY: -3, rotateX: 2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <Image
                  src="/hero.png"
                  alt="Espaço SC Studio & Esmalteria"
                  fill
                  className="object-cover object-top"
                  priority
                />
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-background/20 to-transparent" />
              </motion.div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full border border-primary/20 pointer-events-none" />
            </div>
          </motion.div>

          {/* LEFT: content */}
          <motion.div
            className="order-2 lg:order-1 flex flex-col items-center lg:items-start text-center lg:text-left"
            style={{ y: contentY }}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Logo */}
            <motion.div variants={scaleIn} className="mb-7">
              <Image
                src="/logosc.jpg"
                alt="SC Studio & Esmalteria"
                width={110}
                height={110}
                className="rounded-full object-cover shadow-lg ring-2 ring-primary/20"
                priority
              />
            </motion.div>

            {/* Badge */}
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs sm:text-sm font-medium tracking-widest uppercase">
                Especialistas em Unhas & Alongamento
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-[1.1] tracking-tight mb-6 text-foreground"
            >
              Beleza que{' '}
              <em className="text-primary not-italic">valoriza</em>{' '}
              você
            </motion.h1>

            {/* Description */}
            <motion.p
              variants={fadeUp}
              className="text-base sm:text-lg text-muted-foreground max-w-md mb-9 leading-relaxed"
            >
              Muito mais do que uma esmalteria, nasceu um sonho e um propósito.
              Elevamos sua autoestima com unhas impecáveis e atendimento cuidadoso,
              focado em detalhes e elegância.
            </motion.p>

            {/* CTAs */}
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
                  <a href="#servicos">
                    Agendar Horário
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
                  <a href="#servicos">Ver Serviços</a>
                </Button>
              </motion.div>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={staggerContainer}
              className="flex items-start gap-8 sm:gap-12 justify-center lg:justify-start"
            >
              {[
                { value: '5+', label: 'Anos de\nExperiência' },
                { value: '1000+', label: 'Clientes\nFelizes' },
                { value: '15+', label: 'Serviços\nDisponíveis' },
              ].map((stat) => (
                <motion.div key={stat.value} variants={fadeUp} className="flex flex-col items-center lg:items-start">
                  <span className="text-2xl sm:text-3xl font-semibold text-primary leading-none">{stat.value}</span>
                  <span className="text-xs text-muted-foreground mt-1.5 leading-snug whitespace-pre-line">{stat.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

        </div>
      </div>

      {/* Scroll cue */}
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
