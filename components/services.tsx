'use client'

import { useState, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import {
  Sparkles,
  Clock,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, isBefore, startOfToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { fadeUp, staggerContainer, cardReveal } from '@/lib/animations'
import { SERVICES, type Service, type ServiceCategory, getTimeSlots, photoUrl } from '@/lib/services'

type BookStep = 'datetime' | 'info' | 'success'

const CATEGORIES: { key: ServiceCategory; label: string }[] = [
  { key: 'unhas', label: 'Unhas' },
  { key: 'cilios', label: 'Cílios & Sobrancelhas' },
]

export function Services() {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('unhas')
  const [booking, setBooking] = useState<Service | null>(null)
  const [step, setStep] = useState<BookStep>('datetime')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)

  const headerRef = useRef(null)
  const gridRef = useRef(null)
  const headerInView = useInView(headerRef, { once: true, margin: '-80px' })
  const gridInView = useInView(gridRef, { once: true, margin: '-60px' })

  const today = startOfToday()
  const timeSlots = selectedDate && booking ? getTimeSlots(selectedDate, booking.durationMin) : []
  const filteredServices = SERVICES.filter((s) => s.category === activeCategory)

  function openBooking(service: Service) {
    setBooking(service)
    setStep('datetime')
    setSelectedDate(undefined)
    setSelectedTime(null)
    setName('')
    setPhone('')
    setNotes('')
    setFallbackUrl(null)
  }

  function closeModal() {
    setBooking(null)
  }

  async function handleSubmit() {
    if (!booking || !selectedDate || !selectedTime || !name.trim() || !phone.trim()) return
    setIsSubmitting(true)
    const dateStr = format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          serviceName: booking.name,
          serviceDuration: booking.duration,
          servicePrice: booking.price,
          date: dateStr,
          time: selectedTime,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        if (!data.ownerSent) setFallbackUrl(data.ownerWhatsAppFallback)
        setStep('success')
      } else {
        toast.error('Erro ao enviar. Tente pelo WhatsApp.')
      }
    } catch {
      toast.error('Erro de conexão. Tente pelo WhatsApp.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formattedDateShort = selectedDate
    ? format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })
    : ''
  const formattedDateLong = selectedDate
    ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : ''

  return (
    <section id="servicos" className="py-20 md:py-28 bg-secondary/30">
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">

        {/* Header */}
        <motion.div
          ref={headerRef}
          variants={staggerContainer}
          initial="hidden"
          animate={headerInView ? 'visible' : 'hidden'}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium tracking-wide">Serviços & Agendamento</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4 text-balance">
            Escolha seu serviço & agende
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground text-lg">
            Selecione o serviço e agende diretamente pelo site — rápido e fácil
          </motion.p>
        </motion.div>

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex justify-center gap-4 mb-10"
        >
          {CATEGORIES.map((cat) => (
            <motion.div key={cat.key} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Button
                variant={activeCategory === cat.key ? 'default' : 'outline'}
                onClick={() => setActiveCategory(cat.key)}
                className="font-medium tracking-wide"
              >
                {cat.label}
              </Button>
            </motion.div>
          ))}
        </motion.div>

        {/* Cards Grid */}
        <motion.div
          ref={gridRef}
          key={activeCategory}
          variants={staggerContainer}
          initial="hidden"
          animate={gridInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {filteredServices.map((service) => (
            <motion.div key={service.name} variants={cardReveal}>
              <ServiceCard service={service} onBook={() => openBooking(service)} />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── Booking Modal ── */}
      <Dialog open={!!booking} onOpenChange={(open) => { if (!open) closeModal() }}>
        <DialogContent className="max-w-xl w-full p-0 overflow-hidden gap-0 rounded-2xl">
          <DialogTitle className="sr-only">Agendar {booking?.name}</DialogTitle>

          {booking && (
            <div className="flex flex-col max-h-[92vh] overflow-y-auto">

              {/* Photo banner */}
              <div className="relative h-36 shrink-0 overflow-hidden rounded-t-2xl">
                <img
                  src={photoUrl(booking.photo, 800, 288)}
                  alt={booking.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                <div className="absolute bottom-4 left-5 right-14">
                  <p className="text-white font-semibold text-base leading-tight">
                    {booking.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-white/70 text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {booking.duration}
                    </span>
                    <span className="text-white font-bold text-sm">{booking.price}</span>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait">

                {/* ── Step: datetime ── */}
                {step === 'datetime' && (
                  <motion.div
                    key="datetime"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 space-y-5"
                  >
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      Escolha a data e o horário
                    </p>

                    <div className="flex justify-center">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => { setSelectedDate(d); setSelectedTime(null) }}
                        disabled={(d) => {
                          const day = d.getDay()
                          return day === 0 || day === 1 || isBefore(d, today)
                        }}
                        locale={ptBR}
                        className="rounded-xl border border-border w-fit"
                      />
                    </div>

                    {selectedDate && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="text-xs font-medium text-muted-foreground mb-2.5 capitalize">
                          Horários disponíveis — {formattedDateLong}
                        </p>
                        {timeSlots.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {timeSlots.map((slot) => (
                              <button
                                key={slot}
                                onClick={() => setSelectedTime(slot)}
                                className={cn(
                                  'px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all duration-150',
                                  selectedTime === slot
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border hover:border-primary/50 text-foreground hover:bg-secondary/50'
                                )}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Sem horários disponíveis para este serviço nesta data.
                          </p>
                        )}
                      </motion.div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button
                        onClick={() => setStep('info')}
                        disabled={!selectedDate || !selectedTime}
                        className="px-8"
                      >
                        Próximo <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ── Step: info ── */}
                {step === 'info' && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 space-y-4"
                  >
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/15 text-sm">
                      <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                      <span className="capitalize font-medium">{formattedDateShort}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-semibold text-primary">{selectedTime}</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="m-name">Nome completo *</Label>
                        <Input
                          id="m-name"
                          placeholder="Seu nome"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          autoComplete="name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="m-phone">WhatsApp *</Label>
                        <Input
                          id="m-phone"
                          placeholder="(31) 99999-9999"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          type="tel"
                          autoComplete="tel"
                        />
                        <p className="text-xs text-muted-foreground">
                          A confirmação será enviada para este número.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="m-notes">Observações (opcional)</Label>
                        <Textarea
                          id="m-notes"
                          placeholder="Alergia a produto, cor preferida, etc."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setStep('datetime')}>
                        <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={!name.trim() || !phone.trim() || isSubmitting}
                        className="px-8"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                            Enviando...
                          </span>
                        ) : (
                          <>Confirmar <ChevronRight className="ml-1 h-4 w-4" /></>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ── Step: success ── */}
                {step === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="p-6 text-center space-y-5"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                      className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto"
                    >
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-1">
                        Agendamento Solicitado! 🎉
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        {fallbackUrl
                          ? 'Use o botão abaixo para confirmar com o studio via WhatsApp.'
                          : 'Você e o studio receberão a confirmação pelo WhatsApp em breve.'}
                      </p>
                    </div>

                    <Card className="text-left border-border/50 max-w-xs mx-auto">
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Serviço</span>
                          <span className="font-medium">{booking.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Data</span>
                          <span className="font-medium">{formattedDateShort}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Horário</span>
                          <span className="font-medium">{selectedTime}</span>
                        </div>
                        <div className="flex justify-between border-t border-border/50 pt-2">
                          <span className="text-muted-foreground">Valor</span>
                          <span className="font-semibold text-primary">{booking.price}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      ⚠️ Cancelamentos devem ser avisados com pelo menos 2h de antecedência.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      {fallbackUrl ? (
                        <Button asChild className="bg-[#25D366] hover:bg-[#20c45e] text-white">
                          <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Confirmar via WhatsApp
                          </a>
                        </Button>
                      ) : (
                        <Button asChild className="bg-[#25D366] hover:bg-[#20c45e] text-white">
                          <a href="https://wa.me/5531990725053" target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Falar com o Studio
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" onClick={closeModal}>
                        Fechar
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function ServiceCard({ service, onBook }: { service: Service; onBook: () => void }) {
  return (
    <div className="group relative rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-card border border-border/20">
      {/* Photo */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={photoUrl(service.photo)}
          alt={service.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          <h3 className="text-white font-semibold text-sm leading-snug mb-1.5">
            {service.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" /> {service.duration}
            </span>
            <span className="text-white font-bold text-sm">{service.price}</span>
          </div>
        </div>
      </div>

      {/* Agendar button */}
      <div className="p-3">
        <Button
          onClick={onBook}
          size="sm"
          className="w-full text-xs font-medium tracking-wide"
        >
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
          Agendar
        </Button>
      </div>
    </div>
  )
}
