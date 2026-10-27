'use client'

import { useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { CalendarDays, Check, Clock, Sparkles, X } from 'lucide-react'
import Image from 'next/image'

import { SequentialBookingForm } from '@/components/sequential-booking-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fadeUp, staggerContainer, cardReveal } from '@/lib/animations'
import {
  SERVICES as DEFAULT_SERVICES,
  type PublicBusinessHour,
  type Service,
  type ServiceCategory,
  photoUrl,
} from '@/lib/services'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  unhas: 'Unhas',
  cilios: 'Cilios & Sobrancelhas',
}

function categoryLabel(key: string) {
  return CATEGORY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

function priceLabelToCents(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

export function Services({
  services: propServices,
  businessHours,
}: {
  services?: Service[]
  businessHours?: PublicBusinessHour[]
} = {}) {
  const services = (propServices && propServices.length > 0) ? propServices : DEFAULT_SERVICES
  const categories = useMemo(
    () => [...new Set(services.map((service) => service.category))].filter(Boolean),
    [services]
  )

  const [activeCategory, setActiveCategory] = useState<ServiceCategory>(() => categories[0] ?? 'unhas')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])

  const headerRef = useRef(null)
  const gridRef = useRef(null)
  const bookingRef = useRef<HTMLDivElement | null>(null)
  const headerInView = useInView(headerRef, { once: true, margin: '-80px' })
  const gridInView = useInView(gridRef, { once: true, margin: '-60px' })

  const filteredServices = services.filter((service) => service.category === activeCategory)
  const selectedServices = useMemo(
    () => selectedServiceIds
      .map((serviceId) => services.find((service) => service.id === serviceId))
      .filter((service): service is Service => Boolean(service)),
    [selectedServiceIds, services]
  )
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.durationMin, 0)
  const totalPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    selectedServices.reduce((sum, service) => sum + priceLabelToCents(service.price), 0) / 100
  )

  function scrollToBooking() {
    bookingRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  function toggleSelectedService(service: Service) {
    if (!service.id) return

    setSelectedServiceIds((current) => {
      if (current.includes(service.id!)) {
        return current.filter((serviceId) => serviceId !== service.id)
      }
      return [...current, service.id!]
    })
  }

  function handleFormSelectionChange(nextServiceIds: string[]) {
    setSelectedServiceIds((current) => {
      if (JSON.stringify(current) === JSON.stringify(nextServiceIds)) return current
      return nextServiceIds
    })
  }

  return (
    <section id="servicos" className="py-20 md:py-28 bg-secondary/30">
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <motion.div
          ref={headerRef}
          variants={staggerContainer}
          initial="hidden"
          animate={headerInView ? 'visible' : 'hidden'}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium tracking-wide">Servicos & Agendamento</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4 text-balance">
            Agende seu momento
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground text-lg">
            Escolha um ou varios servicos, veja os horarios compativeis da agenda e conclua tudo no mesmo fluxo.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex justify-center gap-4 mb-10 flex-wrap"
        >
          {categories.map((category) => (
            <motion.div key={category} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Button
                variant={activeCategory === category ? 'default' : 'outline'}
                onClick={() => setActiveCategory(category)}
                className="font-medium tracking-wide"
              >
                {categoryLabel(category)}
              </Button>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          ref={gridRef}
          key={activeCategory}
          variants={staggerContainer}
          initial="hidden"
          animate={gridInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {filteredServices.map((service) => (
            <motion.div key={service.id ?? service.name} variants={cardReveal}>
              <ServiceCard
                service={service}
                selected={Boolean(service.id && selectedServiceIds.includes(service.id))}
                onToggle={() => toggleSelectedService(service)}
              />
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-10 space-y-6">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <CalendarDays className="h-4 w-4" />
                    <span>{selectedServices.length > 0 ? 'Resumo da visita' : 'Comece escolhendo seus servicos'}</span>
                  </div>

                  {selectedServices.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {selectedServices.map((service) => (
                          <button
                            key={service.id ?? service.name}
                            type="button"
                            onClick={() => toggleSelectedService(service)}
                            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/40 hover:bg-primary/12"
                          >
                            <span>{service.name}</span>
                            <X className="h-3.5 w-3.5 text-primary" />
                          </button>
                        ))}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {selectedServices.length} servico(s) selecionado(s) • {formatDuration(totalDuration)} • {totalPrice}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Adicione servicos nos cards acima ou use o formulario abaixo para montar sua visita completa.
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedServiceIds([])}
                    disabled={selectedServices.length === 0}
                  >
                    Limpar selecao
                  </Button>
                  <Button onClick={scrollToBooking} className="px-6" disabled={selectedServices.length === 0}>
                    {selectedServices.length > 1 ? 'Escolher horarios' : 'Escolher horario'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div ref={bookingRef} className="scroll-mt-24">
            <Card className="border-border/50 shadow-xl">
              <CardContent className="p-6 md:p-8">
                <SequentialBookingForm
                  services={services}
                  businessHours={businessHours}
                  preselectedServiceIds={selectedServiceIds}
                  onSelectionChange={handleFormSelectionChange}
                  serviceSelectionMode="external"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

function ServiceCard({
  service,
  selected,
  onToggle,
}: {
  service: Service
  selected: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'group relative rounded-2xl overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl bg-card border',
        selected ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border/20'
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={photoUrl(service.photo)}
          alt={service.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

        {selected && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm">
            <Check className="h-3.5 w-3.5" />
            Selecionado
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          <h3 className="text-white font-semibold text-sm leading-snug mb-1.5">
            {service.name}
          </h3>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/70 text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" /> {service.duration}
            </span>
            <span className="text-white font-bold text-sm">{service.price}</span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <Button
          onClick={onToggle}
          size="sm"
          variant={selected ? 'default' : 'outline'}
          className={cn(
            'w-full text-xs font-medium tracking-wide',
            selected ? 'bg-primary hover:bg-primary/90' : 'bg-background'
          )}
        >
          {selected ? 'Selecionado' : 'Selecionar servico'}
        </Button>
      </div>
    </div>
  )
}
