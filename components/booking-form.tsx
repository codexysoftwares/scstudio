'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Clock,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, isBefore, startOfToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

type ServiceCategory = 'unhas' | 'cilios'

interface Service {
  name: string
  duration: string
  durationMin: number
  price: string
  category: ServiceCategory
}

const SERVICES: Service[] = [
  { name: 'Alongamento (novo)', duration: '1h 15min', durationMin: 75, price: 'R$ 140,00', category: 'unhas' },
  { name: 'Manutenção + Mão', duration: '1h 15min', durationMin: 75, price: 'R$ 120,00', category: 'unhas' },
  { name: 'Esmaltação em Gel', duration: '1h', durationMin: 60, price: 'R$ 60,00', category: 'unhas' },
  { name: 'Spa dos Pés', duration: '1h 30min', durationMin: 90, price: 'R$ 90,00', category: 'unhas' },
  { name: 'Pé e Mão', duration: '1h 10min', durationMin: 70, price: 'R$ 60,00', category: 'unhas' },
  { name: 'Manicure', duration: '50min', durationMin: 50, price: 'R$ 35,00', category: 'unhas' },
  { name: 'Pedicure', duration: '50min', durationMin: 50, price: 'R$ 35,00', category: 'unhas' },
  { name: 'Remoção de Alongamento', duration: '30min', durationMin: 30, price: 'R$ 40,00', category: 'unhas' },
  { name: 'Decoração', duration: '30min', durationMin: 30, price: 'R$ 10,00', category: 'unhas' },
  { name: 'Francesa Definitiva', duration: '20min', durationMin: 20, price: 'R$ 20,00', category: 'unhas' },
  { name: 'Cílios Brasileiro', duration: '1h 50min', durationMin: 110, price: 'R$ 110,00', category: 'cilios' },
  { name: 'Manutenção de Cílios', duration: '1h', durationMin: 60, price: 'R$ 90,00', category: 'cilios' },
  { name: 'Designer Comum', duration: '30min', durationMin: 30, price: 'R$ 40,00', category: 'cilios' },
  { name: 'Designer com Henna', duration: '45min', durationMin: 45, price: 'R$ 50,00', category: 'cilios' },
]

// day 0=Sun, minutes from midnight
const DAY_HOURS: Record<number, { open: number; close: number } | null> = {
  0: null,
  1: null,
  2: { open: 9 * 60, close: 16 * 60 },
  3: { open: 8 * 60, close: 16 * 60 },
  4: { open: 8 * 60, close: 16 * 60 },
  5: { open: 8 * 60, close: 18 * 60 },
  6: { open: 8 * 60, close: 16 * 60 },
}

function getTimeSlots(date: Date, durationMin: number): string[] {
  const cfg = DAY_HOURS[date.getDay()]
  if (!cfg) return []
  const slots: string[] = []
  for (let m = cfg.open; m + durationMin <= cfg.close; m += 30) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
  }
  return slots
}

type Step = 1 | 2 | 3 | 4

const STEP_LABELS = ['Serviço', 'Data & Hora', 'Seus Dados']

export function BookingForm() {
  const [step, setStep] = useState<Step>(1)
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('unhas')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)

  const today = startOfToday()
  const timeSlots =
    selectedDate && selectedService ? getTimeSlots(selectedDate, selectedService.durationMin) : []

  const formattedDate =
    selectedDate
      ? format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : ''

  const formattedDateShort =
    selectedDate ? format(selectedDate, "dd/MM/yyyy (EEE)", { locale: ptBR }) : ''

  async function handleSubmit() {
    if (!selectedService || !selectedDate || !selectedTime || !name.trim() || !phone.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          serviceName: selectedService.name,
          serviceDuration: selectedService.duration,
          servicePrice: selectedService.price,
          date: formattedDate,
          time: selectedTime,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        if (!data.ownerSent) setFallbackUrl(data.ownerWhatsAppFallback)
        setStep(4)
      } else {
        toast.error('Erro ao enviar. Tente agendar pelo WhatsApp.')
      }
    } catch {
      toast.error('Erro de conexão. Tente agendar pelo WhatsApp.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function reset() {
    setStep(1)
    setSelectedService(null)
    setSelectedDate(undefined)
    setSelectedTime(null)
    setName('')
    setPhone('')
    setNotes('')
    setFallbackUrl(null)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      {step < 4 && (
        <div className="flex items-center justify-center mb-8 gap-1">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1
            const isActive = step === n
            const isDone = step > n
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
                    {isDone ? '✓' : n}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={cn('h-px w-4 mx-1', isDone ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* STEP 1 — Choose service */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex justify-center gap-3">
            {(['unhas', 'cilios'] as const).map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? 'default' : 'outline'}
                onClick={() => setActiveCategory(cat)}
                className="font-medium"
              >
                {cat === 'unhas' ? 'Unhas' : 'Cílios & Sobrancelhas'}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SERVICES.filter((s) => s.category === activeCategory).map((service) => (
              <button
                key={service.name}
                onClick={() => setSelectedService(service)}
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {service.duration}
                  </span>
                  <span className="font-semibold text-primary">{service.price}</span>
                </div>
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

      {/* STEP 2 — Date & time */}
      {step === 2 && (
        <div className="space-y-5">
          {selectedService && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
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
              disabled={(date) => {
                const day = date.getDay()
                return day === 0 || day === 1 || isBefore(date, today)
              }}
              locale={ptBR}
              className="rounded-xl border border-border shadow-sm"
            />
          </div>

          {selectedDate && timeSlots.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-3">
                Horários disponíveis —{' '}
                <span className="text-primary capitalize">
                  {format(selectedDate, "EEE dd/MM", { locale: ptBR })}
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

          {selectedDate && timeSlots.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Sem horários disponíveis para o serviço selecionado nesta data.
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!selectedDate || !selectedTime}
              className="px-8"
            >
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — Personal info */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Summary */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serviço</span>
                <span className="font-medium">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium capitalize">{formattedDateShort}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horário</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border/50 pt-2 mt-2">
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
                placeholder="Preferências, alergia a produto, ou qualquer informação importante..."
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

      {/* STEP 4 — Success */}
      {step === 4 && (
        <div className="text-center space-y-6 py-6">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>

          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-2">
              Agendamento Solicitado! 🎉
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {fallbackUrl
                ? 'Use o botão abaixo para avisar o studio via WhatsApp.'
                : 'Você e o studio receberão a confirmação pelo WhatsApp em breve.'}
            </p>
          </div>

          <Card className="text-left border-border/50 max-w-sm mx-auto">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serviço</span>
                <span className="font-medium">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium capitalize">{formattedDateShort}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horário</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-semibold text-primary">{selectedService?.price}</span>
              </div>
              <div className="text-xs text-muted-foreground border-t border-border/50 pt-2 mt-1">
                📍 Rua Padre Correia de Almeida, 38 — Santa Efigênia, BH
              </div>
            </CardContent>
          </Card>

          {/* Cancelamento policy reminder */}
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            ⚠️ Em caso de cancelamento, avise com pelo menos 2h de antecedência para evitar cobranças.
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
