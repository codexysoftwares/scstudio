'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format, isBefore, startOfToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  getTimeSlots,
  SERVICES as DEFAULT_SERVICES,
  type PublicBusinessHour,
  type Service,
} from '@/lib/services'

type Step = 1 | 2 | 3 | 4

type AvailabilityProfessional = {
  id: string
  displayName: string
  specialty: string
  isFeatured: boolean
  availableSlots: string[]
  activeBookingCount: number
}

const STEP_LABELS = ['Serviço', 'Profissional & Horário', 'Seus Dados']

export function BookingForm({
  services: propServices,
  businessHours,
  lockedProfessionalId,
  lockedProfessionalName,
}: {
  services?: Service[]
  businessHours?: PublicBusinessHour[]
  lockedProfessionalId?: string
  lockedProfessionalName?: string
} = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hasMountedRef = useRef(false)

  const services = propServices && propServices.length > 0 ? propServices : DEFAULT_SERVICES
  const categories = useMemo(
    () => [...new Set(services.map((service) => service.category))].filter(Boolean),
    [services]
  )

  const [step, setStep] = useState<Step>(1)
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] ?? 'unhas')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [availabilityProfessionals, setAvailabilityProfessionals] = useState<AvailabilityProfessional[]>([])
  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>([])
  const [allowProfessionalSelection, setAllowProfessionalSelection] = useState(true)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)

  const today = startOfToday()
  const filteredServices = services.filter((service) => service.category === activeCategory)

  const selectedProfessional = availabilityProfessionals.find(
    (professional) => professional.id === selectedProfessionalId
  )

  const timeSlots = useMemo(() => {
    if (!selectedDate || !selectedService) return []

    if (!selectedService.id) {
      return getTimeSlots(selectedDate, selectedService.durationMin, businessHours)
    }

    if (allowProfessionalSelection) {
      return selectedProfessional?.availableSlots ?? []
    }

    return availabilitySlots
  }, [
    allowProfessionalSelection,
    availabilityProfessionals,
    availabilitySlots,
    businessHours,
    selectedDate,
    selectedProfessional,
    selectedService,
  ])

  const formattedDateShort =
    selectedDate ? format(selectedDate, 'dd/MM/yyyy (EEE)', { locale: ptBR }) : ''

  useEffect(() => {
    if (!selectedDate || !selectedService?.id) {
      setAvailabilityProfessionals([])
      setAvailabilitySlots([])
      setAllowProfessionalSelection(true)
      setSelectedProfessionalId(null)
      return
    }

    const date = format(selectedDate, 'yyyy-MM-dd')
    setLoadingAvailability(true)
    setSelectedTime(null)

    const availUrl = `/api/booking/availability?date=${date}&serviceId=${selectedService.id}`
      + (lockedProfessionalId ? `&professionalId=${lockedProfessionalId}` : '')
    fetch(availUrl)
      .then((res) => res.json())
      .then((data) => {
        const professionals = (data.professionals ?? []) as AvailabilityProfessional[]
        const canChooseProfessional = !lockedProfessionalId && data.allowProfessionalSelection !== false
        const slots = (data.allAvailableSlots ?? []) as string[]

        setAvailabilityProfessionals(professionals)
        setAvailabilitySlots(slots)
        setAllowProfessionalSelection(canChooseProfessional)

        if (lockedProfessionalId) {
          setSelectedProfessionalId(lockedProfessionalId)
          return
        }

        if (!canChooseProfessional) {
          setSelectedProfessionalId(null)
          return
        }

        setSelectedProfessionalId((current) => {
          if (current && professionals.some((professional) => professional.id === current)) {
            return current
          }
          return professionals[0]?.id ?? null
        })
      })
      .catch(() => {
        setAvailabilityProfessionals([])
        setAvailabilitySlots([])
        setSelectedProfessionalId(null)
      })
      .finally(() => setLoadingAvailability(false))
  }, [lockedProfessionalId, selectedDate, selectedService?.id])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }

    containerRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [step])

  async function handleSubmit() {
    if (!selectedService || !selectedDate || !selectedTime || !name.trim() || !phone.trim()) return

    if (allowProfessionalSelection && selectedService.id && !selectedProfessionalId) {
      toast.error('Selecione uma profissional para continuar.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = selectedService.id
        ? {
            name: name.trim(),
            phone: phone.trim(),
            serviceId: selectedService.id,
            professionalId: allowProfessionalSelection ? selectedProfessionalId : null,
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: selectedTime,
            notes: notes.trim() || undefined,
          }
        : {
            name: name.trim(),
            phone: phone.trim(),
            serviceName: selectedService.name,
            serviceDuration: selectedService.duration,
            servicePrice: selectedService.price,
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: selectedTime,
            notes: notes.trim() || undefined,
          }

      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Erro ao enviar. Tente agendar pelo WhatsApp.')
        return
      }

      if (!data.ownerSent) setFallbackUrl(data.ownerWhatsAppFallback)
      setStep(4)
    } catch {
      toast.error('Erro de conexão. Tente agendar pelo WhatsApp.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function reset() {
    setStep(1)
    setActiveCategory(categories[0] ?? 'unhas')
    setSelectedService(null)
    setSelectedDate(undefined)
    setSelectedProfessionalId(null)
    setSelectedTime(null)
    setAvailabilityProfessionals([])
    setName('')
    setPhone('')
    setNotes('')
    setFallbackUrl(null)
  }

  function isDateDisabled(date: Date) {
    if (isBefore(date, today)) return true

    if (businessHours && businessHours.length > 0) {
      const dayHours = businessHours.find((hour) => hour.weekday === date.getDay())
      return !dayHours || dayHours.isClosed || !dayHours.opensAt || !dayHours.closesAt
    }

    const day = date.getDay()
    return day === 0 || day === 1
  }

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto scroll-mt-28">
      {step < 4 && (
        <div className="flex items-center justify-center mb-8 gap-1 flex-wrap">
          {STEP_LABELS.map((label, index) => {
            const currentStep = index + 1
            const isActive = step === currentStep
            const isDone = step > currentStep

            return (
              <div key={label} className="flex items-center gap-1">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    isActive && 'bg-primary text-primary-foreground',
                    isDone && 'bg-primary/20 text-primary',
                    !isActive && !isDone && 'bg-muted text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center text-xs border',
                      isActive && 'border-primary-foreground',
                      isDone && 'border-primary',
                      !isActive && !isDone && 'border-muted-foreground'
                    )}
                  >
                    {isDone ? '✓' : currentStep}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {index < STEP_LABELS.length - 1 && (
                  <div className={cn('h-px w-4 mx-1', isDone ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="flex justify-center gap-3 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? 'default' : 'outline'}
                onClick={() => setActiveCategory(category)}
                className="font-medium"
              >
                {category === 'unhas' ? 'Unhas' : category === 'cilios' ? 'Cílios & Sobrancelhas' : category}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredServices.map((service) => (
              <button
                key={service.id ?? service.name}
                onClick={() => {
                  setSelectedService(service)
                  setSelectedDate(undefined)
                  setSelectedProfessionalId(null)
                  setSelectedTime(null)
                  setAvailabilityProfessionals([])
                }}
                className={cn(
                  'text-left p-4 rounded-xl border-2 transition-all duration-200 group',
                  selectedService?.name === service.name
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                )}
              >
                <div className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {service.name}
                </div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {service.duration}
                  </span>
                  <span className="font-semibold text-primary">{service.price}</span>
                </div>
                {service.professionals && service.professionals.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Profissionais: {service.professionals.map((professional) => professional.name).join(', ')}
                  </p>
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!selectedService} className="px-8">
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          {selectedService && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{selectedService.name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {selectedService.duration}
                </p>
              </div>
              <p className="text-lg font-semibold text-primary">{selectedService.price}</p>
            </div>
          )}

          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date)
                setSelectedTime(null)
              }}
              disabled={isDateDisabled}
              locale={ptBR}
              className="rounded-xl border border-border shadow-sm"
            />
          </div>

          {selectedDate && lockedProfessionalId && lockedProfessionalName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="h-4 w-4 text-primary" />
              <span>Atendimento com <span className="font-semibold text-foreground">{lockedProfessionalName}</span></span>
            </div>
          )}

          {selectedDate && allowProfessionalSelection && selectedService?.id && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <UserRound className="h-4 w-4 text-primary" />
                <span>Profissionais disponíveis</span>
                {loadingAvailability && (
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availabilityProfessionals.map((professional) => (
                  <button
                    key={professional.id}
                    onClick={() => {
                      setSelectedProfessionalId(professional.id)
                      setSelectedTime(null)
                    }}
                    className={cn(
                      'text-left rounded-xl border p-4 transition-all',
                      selectedProfessionalId === professional.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-foreground">{professional.displayName}</span>
                      <span className="text-xs text-primary">
                        {professional.availableSlots.length} horário{professional.availableSlots.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    {professional.specialty && (
                      <p className="text-sm text-muted-foreground mt-1">{professional.specialty}</p>
                    )}
                  </button>
                ))}
              </div>

              {!loadingAvailability && availabilityProfessionals.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma profissional habilitada para este serviço nesta data.
                </p>
              )}
            </div>
          )}

          {selectedDate && !allowProfessionalSelection && selectedService?.id && (
            <p className="text-sm text-muted-foreground text-center">
              A agenda vai selecionar automaticamente a profissional disponível para este serviço.
            </p>
          )}

          {selectedDate && timeSlots.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-3">
                Horários disponíveis{' '}
                <span className="text-primary capitalize">
                  {format(selectedDate, 'EEE dd/MM', { locale: ptBR })}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                      selectedTime === slot
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50 text-foreground hover:bg-secondary/50'
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedDate && !loadingAvailability && timeSlots.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Sem horários disponíveis para a combinação de serviço, profissional e data.
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!selectedDate || !selectedTime || (allowProfessionalSelection && selectedService?.id ? !selectedProfessionalId : false)}
              className="px-8"
            >
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Serviço</span>
                <span className="font-medium text-right">{selectedService?.name}</span>
              </div>
              {selectedService?.id && (
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground">Profissional</span>
                  <span className="font-medium text-right">
                    {selectedProfessional?.displayName || 'Automática pela agenda'}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium capitalize">{formattedDateShort}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Horário</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border/50 pt-2 mt-2 gap-3">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-semibold text-primary">{selectedService?.price}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bk-name">Nome completo *</Label>
              <Input
                id="bk-name"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bk-phone">WhatsApp *</Label>
              <Input
                id="bk-phone"
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
            <div className="space-y-2">
              <Label htmlFor="bk-notes">Observações (opcional)</Label>
              <Textarea
                id="bk-notes"
                placeholder="Preferências, alergia a produto ou qualquer informação importante."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
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
                <>
                  Confirmar Agendamento <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="text-center space-y-6 py-6">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>

          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-2">
              Agendamento Solicitado!
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {fallbackUrl
                ? 'Use o botão abaixo para avisar o studio via WhatsApp.'
                : 'Você e o studio receberão a confirmação pelo WhatsApp em breve.'}
            </p>
          </div>

          <Card className="text-left border-border/50 max-w-sm mx-auto">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Serviço</span>
                <span className="font-medium text-right">{selectedService?.name}</span>
              </div>
              {selectedService?.id && (
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground">Profissional</span>
                  <span className="font-medium text-right">
                    {selectedProfessional?.displayName || 'Definida pela agenda'}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium capitalize">{formattedDateShort}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Horário</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-semibold text-primary">{selectedService?.price}</span>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Cancelamentos devem ser avisados com pelo menos 2h de antecedência.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {fallbackUrl ? (
              <Button asChild className="bg-[#25D366] hover:bg-[#20c45e] text-white">
                <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Avisar o Studio via WhatsApp
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
            <Button variant="outline" onClick={reset}>
              <Sparkles className="mr-2 h-4 w-4" />
              Novo Agendamento
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
