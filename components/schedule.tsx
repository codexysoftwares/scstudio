'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, X, Sparkles } from 'lucide-react'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { PublicBusinessHour } from '@/lib/services'

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

const STATIC_SCHEDULE = [
  { day: 'Segunda-feira', hours: 'Fechado', closed: true },
  { day: 'Terça-feira', hours: '09:00 – 16:00', closed: false },
  { day: 'Quarta-feira', hours: '08:00 – 16:00', closed: false },
  { day: 'Quinta-feira', hours: '08:00 – 16:00', closed: false },
  { day: 'Sexta-feira', hours: '08:00 – 18:00', closed: false },
  { day: 'Sábado', hours: '08:00 – 16:00', closed: false },
  { day: 'Domingo', hours: 'Fechado', closed: true },
]

const rowVariant = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export function Schedule({ hours }: { hours?: PublicBusinessHour[] } = {}) {
  const schedule = hours && hours.length > 0
    ? [...hours]
        .sort((a, b) => (a.weekday === 0 ? 7 : a.weekday) - (b.weekday === 0 ? 7 : b.weekday))
        .map((h) => ({
          day: WEEKDAY_NAMES[h.weekday],
          hours: h.isClosed || !h.opensAt || !h.closesAt
            ? 'Fechado'
            : `${h.opensAt} – ${h.closesAt}`,
          closed: h.isClosed || !h.opensAt,
        }))
    : STATIC_SCHEDULE

  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-20 md:py-28 bg-background overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">

        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium tracking-wide">Horários</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4 text-balance">
            Horário de Atendimento
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground text-lg">
            Atendemos com hora marcada — agende pelo site ou WhatsApp
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="max-w-md mx-auto"
        >
          <Card className="bg-card border-border/50 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate={inView ? 'visible' : 'hidden'}
              >
                {schedule.map((item, index) => (
                  <motion.div
                    key={item.day}
                    variants={rowVariant}
                    transition={{ delay: index * 0.06 }}
                    whileHover={!item.closed ? { backgroundColor: 'oklch(0.94 0.015 80 / 0.5)', x: 4 } : {}}
                    className={`flex items-center justify-between px-6 py-4 transition-colors ${
                      index !== schedule.length - 1 ? 'border-b border-border/50' : ''
                    } ${item.closed ? 'bg-muted/30' : ''}`}
                  >
                    <span className={`font-medium ${item.closed ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {item.day}
                    </span>
                    <span className={`flex items-center gap-2 ${item.closed ? 'text-muted-foreground' : 'text-primary font-semibold'}`}>
                      {item.closed
                        ? <><X className="h-4 w-4" />{item.hours}</>
                        : <><Sparkles className="h-4 w-4" />{item.hours}</>
                      }
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </CardContent>
          </Card>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.9 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            * Agende pelo botão em cada serviço ou pelo WhatsApp.
          </motion.p>
        </motion.div>

      </div>
    </section>
  )
}
