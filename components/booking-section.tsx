'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { CalendarDays } from 'lucide-react'

import { BookingForm } from '@/components/booking-form'
import { Card, CardContent } from '@/components/ui/card'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { PublicBusinessHour, Service } from '@/lib/services'

export function BookingSection({
  services,
  businessHours,
}: {
  services?: Service[]
  businessHours?: PublicBusinessHour[]
} = {}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="agendamento" className="bg-background py-20 md:py-28">
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <motion.div variants={fadeUp} className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <CalendarDays className="h-4 w-4" />
            <span className="text-sm font-medium tracking-wide">Agenda Online</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="mb-4 text-3xl font-semibold text-foreground text-balance md:text-4xl lg:text-5xl">
            Agende seu horario agora
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-muted-foreground">
            Escolha o servico, veja os horarios reais disponiveis e envie seu pedido direto pela landing page.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mx-auto max-w-5xl"
        >
          <Card className="border-border/50 shadow-xl">
            <CardContent className="p-6 md:p-8">
              <BookingForm services={services ?? []} businessHours={businessHours} />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
