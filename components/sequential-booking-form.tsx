'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format, isBefore, startOfToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Clock, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { type PublicBusinessHour, type Service } from '@/lib/services'

type Step = 1 | 2 | 3 | 4

type BookingAutomationResult = {
  requiresDeposit: boolean
  paymentStatus: 'confirmed' | 'pending_payment'
  paymentMessage: string | null
  bookingSummaryMessage: string
}

type BundleAssignment = {
  serviceId: string
  serviceName: string
  professionalId: string
  professionalName: string
  startsAt: string
  sequence: number
  durationMin: number
}

type AvailabilityProfessional = {
  id: string
  displayName: string
  specialty: string
  isFeatured: boolean
  availableSlots: string[]
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

function formatCategoryLabel(category: string) {
  if (category === 'unhas') return 'Unhas'
  if (category === 'cilios') return 'Cilios & Sobrancelhas'
  return category
}

function sortAvailabilityProfessionals(a: AvailabilityProfessional, b: AvailabilityProfessional) {
  if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1
  return a.displayName.localeCompare(b.displayName, 'pt-BR')
}

function resolvePreselectedServices(services: Service[], preselectedServiceIds?: string[]) {
  if (!preselectedServiceIds || preselectedServiceIds.length === 0) return []

  return preselectedServiceIds
    .map((serviceId) => services.find((service) => service.id === serviceId))
    .filter((service): service is Service => Boolean(service))
}

export function SequentialBookingForm({
  services,
  businessHours,
  lockedProfessionalId,
  lockedProfessionalName,
  preselectedServiceIds,
  onSelectionChange,
  serviceSelectionMode = 'internal',
}: {
  services: Service[]
  businessHours?: PublicBusinessHour[]
  lockedProfessionalId?: string
  lockedProfessionalName?: string
  preselectedServiceIds?: string[]
  onSelectionChange?: (serviceIds: string[]) => void
  serviceSelectionMode?: 'internal' | 'external'
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hasMountedRef = useRef(false)

  const visibleServices = useMemo(() => {
    if (!lockedProfessionalId) return services

    return services.filter((service) => {
      if (!service.professionals || service.professionals.length === 0) return true
      return service.professionals.some((professional) => professional.id === lockedProfessionalId)
    })
  }, [lockedProfessionalId, services])

  const categories = useMemo(
    () => [...new Set(visibleServices.map((service) => service.category))].filter(Boolean),
    [visibleServices]
  )
  const preselectedIdsKey = useMemo(
    () => JSON.stringify(preselectedServiceIds ?? []),
    [preselectedServiceIds]
  )

  const [step, setStep] = useState<Step>(1)
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] ?? '')
  const [selectedServices, setSelectedServices] = useState<Service[]>(
    () => resolvePreselectedServices(visibleServices, preselectedServiceIds)
  )
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<Record<string, string>>({})
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [slotAssignments, setSlotAssignments] = useState<Record<string, BundleAssignment[]>>({})
  const [singleServiceProfessionals, setSingleServiceProfessionals] = useState<AvailabilityProfessional[]>([])
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingAutomation, setBookingAutomation] = useState<BookingAutomationResult | null>(null)

  const filteredServices = visibleServices.filter((service) => service.category === activeCategory)
  const today = startOfToday()
  const selectedServiceIds = useMemo(
    () => selectedServices.map((service) => service.id).filter((id): id is string => Boolean(id)),
    [selectedServices]
  )
  const selectedServiceIdsKey = useMemo(
    () => JSON.stringify(selectedServiceIds),
    [selectedServiceIds]
  )
  const selectedAssignments = selectedTime ? slotAssignments[selectedTime] ?? [] : []
  const totalDuration = selectedServices.reduce((total, service) => total + service.durationMin, 0)
  const usesExternalSelection = serviceSelectionMode === 'external'
  const visibleSteps = usesExternalSelection
    ? ['Horario', 'Seus Dados']
    : ['Servicos', 'Horario', 'Seus Dados']
  const currentVisibleStep = usesExternalSelection ? Math.max(step - 1, 1) : step
  const totalPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    selectedServices.reduce((total, service) => total + priceLabelToCents(service.price), 0) / 100
  )

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(categories[0] ?? '')
    }
  }, [activeCategory, categories])

  useEffect(() => {
    if (!preselectedServiceIds) return

    const nextSelected = resolvePreselectedServices(visibleServices, preselectedServiceIds)
    const nextKey = JSON.stringify(nextSelected.map((service) => service.id ?? service.name))
    const currentKey = JSON.stringify(selectedServices.map((service) => service.id ?? service.name))

    if (nextKey !== currentKey) {
      setSelectedServices(nextSelected)
      setSelectedProfessionalIds({})
      setSelectedDate(undefined)
      setSelectedTime(null)
      setSlotAssignments({})
      setSingleServiceProfessionals([])
      setStep(usesExternalSelection && nextSelected.length > 0 ? 2 : 1)
    }

    if (nextSelected[0]?.category && categories.includes(nextSelected[0].category)) {
      setActiveCategory(nextSelected[0].category)
    }
  }, [categories, preselectedIdsKey, preselectedServiceIds, selectedServices, usesExternalSelection, visibleServices])

  useEffect(() => {
    if (!usesExternalSelection) return

    if (selectedServiceIds.length === 0 && step !== 1) {
      setStep(1)
      return
    }

    if (selectedServiceIds.length > 0 && step === 1) {
      setStep(2)
    }
  }, [selectedServiceIds.length, step, usesExternalSelection])

  useEffect(() => {
    if (usesExternalSelection) return
    onSelectionChange?.(selectedServiceIds)
  }, [onSelectionChange, selectedServiceIds, usesExternalSelection])

  useEffect(() => {
    if (!lockedProfessionalId) return

    setSelectedProfessionalIds((current) => {
      const next = { ...current }
      let changed = false
      for (const service of selectedServices) {
        if (!service.id) continue
        if (next[service.id] !== lockedProfessionalId) {
          next[service.id] = lockedProfessionalId
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [lockedProfessionalId, selectedServices])

  const selectedProfessionalMap = useMemo(() => {
    const next: Record<string, string> = {}
    for (const service of selectedServices) {
      if (!service.id) continue
      const professionalId = lockedProfessionalId || selectedProfessionalIds[service.id]
      if (professionalId) next[service.id] = professionalId
    }
    return next
  }, [lockedProfessionalId, selectedProfessionalIds, selectedServices])

  const selectedProfessionalMapKey = useMemo(
    () => JSON.stringify(selectedProfessionalMap),
    [selectedProfessionalMap]
  )

  useEffect(() => {
    if (!selectedDate || selectedServiceIds.length === 0) {
      setSlotAssignments({})
      setSingleServiceProfessionals([])
      setSelectedTime(null)
      return
    }

    const params = new URLSearchParams({ date: format(selectedDate, 'yyyy-MM-dd') })
    for (const serviceId of selectedServiceIds) params.append('serviceId', serviceId)

    if (selectedServiceIds.length === 1) {
      const professionalId = selectedProfessionalMap[selectedServiceIds[0]]
      if (professionalId) params.set('professionalId', professionalId)
    } else if (Object.keys(selectedProfessionalMap).length > 0) {
      params.set(
        'professionalSelections',
        JSON.stringify(
          Object.entries(selectedProfessionalMap).map(([serviceId, professionalId]) => ({
            serviceId,
            professionalId,
          }))
        )
      )
    }

    setLoadingAvailability(true)
    setSelectedTime(null)

    fetch(`/api/booking/availability?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        // Bundle response (expanded service or multi-service) — use slotAssignments directly
        const bundleSlots = data.slotAssignments as Record<string, BundleAssignment[]> | undefined
        if (bundleSlots && Object.keys(bundleSlots).length > 0) {
          setSingleServiceProfessionals([])
          setSlotAssignments(bundleSlots)
          return
        }

        // Single-service response — build slotMap from professionals list
        const service = selectedServices[0]
        const professionals = ((data.professionals ?? []) as AvailabilityProfessional[]).sort(sortAvailabilityProfessionals)
        const slotMap: Record<string, BundleAssignment[]> = {}

        for (const slot of (data.allAvailableSlots ?? []) as string[]) {
          const professional =
            professionals.find((item) => item.availableSlots.includes(slot)) ??
            professionals[0]

          if (!service?.id || !professional) continue

          slotMap[slot] = [{
            serviceId: service.id,
            serviceName: service.name,
            professionalId: professional.id,
            professionalName: professional.displayName,
            startsAt: slot,
            sequence: 1,
            durationMin: service.durationMin,
          }]
        }

        setSingleServiceProfessionals(professionals)
        setSlotAssignments(slotMap)
      })
      .catch(() => {
        setSingleServiceProfessionals([])
        setSlotAssignments({})
      })
      .finally(() => setLoadingAvailability(false))
  }, [selectedDate, selectedProfessionalMap, selectedProfessionalMapKey, selectedServiceIds, selectedServiceIdsKey, selectedServices])

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

  const timeSlots = useMemo(
    () => Object.keys(slotAssignments).sort(),
    [slotAssignments]
  )

  async function handleSubmit() {
    if (!selectedDate || !selectedTime || selectedServiceIds.length === 0 || !name.trim() || !phone.trim()) return

    const professionalSelections = selectedServiceIds
      .map((serviceId) => ({
        serviceId,
        professionalId: selectedProfessionalMap[serviceId] ?? null,
      }))
      .filter((item) => item.professionalId)

    setIsSubmitting(true)
    try {
      const payload = selectedServiceIds.length === 1
        ? {
            name: name.trim(),
            phone: phone.trim(),
            serviceId: selectedServiceIds[0],
            professionalId: selectedProfessionalMap[selectedServiceIds[0]] ?? null,
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: selectedTime,
            notes: notes.trim() || undefined,
          }
        : {
            name: name.trim(),
            phone: phone.trim(),
            serviceIds: selectedServiceIds,
            professionalSelections,
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: selectedTime,
            notes: notes.trim() || undefined,
          }

      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.error || 'Nao foi possivel criar o agendamento.')
        return
      }

      setBookingAutomation(data.automation ?? null)
      toast.success(selectedServiceIds.length === 1 ? 'Agendamento enviado com sucesso.' : 'Sequencia de servicos enviada com sucesso.')
      setStep(4)
    } catch {
      toast.error('Erro de conexao. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleService(service: Service) {
    setSelectedServices((current) => {
      const selected = current.some((item) => (item.id ?? item.name) === (service.id ?? service.name))
      if (selected) {
        return current.filter((item) => (item.id ?? item.name) !== (service.id ?? service.name))
      }
      return [...current, service]
    })

    if (service.id) {
      setSelectedProfessionalIds((current) => {
        if (lockedProfessionalId) {
          return {
            ...current,
            [service.id!]: lockedProfessionalId,
          }
        }

        const next = { ...current }
        if (next[service.id]) {
          delete next[service.id]
        }
        return next
      })
    }

    setSelectedDate(undefined)
    setSelectedTime(null)
    setSlotAssignments({})
    setSingleServiceProfessionals([])
  }

  function updateSelectedProfessional(serviceId: string, professionalId: string) {
    setSelectedProfessionalIds((current) => {
      const next = { ...current }
      if (professionalId) next[serviceId] = professionalId
      else delete next[serviceId]
      return next
    })
    setSelectedTime(null)
    setSlotAssignments({})
  }

  function resetForm() {
    setStep(1)
    setSelectedServices([])
    setSelectedProfessionalIds({})
    setSelectedDate(undefined)
    setSelectedTime(null)
    setSlotAssignments({})
    setSingleServiceProfessionals([])
    setName('')
    setPhone('')
    setNotes('')
    setBookingAutomation(null)
  }

  const formattedDate = selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: ptBR }) : ''
  const visitLabel = selectedServiceIds.length === 1 ? 'Atendimento' : 'Visita sequencial'
  const selectedSingleServiceId = selectedServiceIds[0]

  return (
    <div ref={containerRef} className="space-y-6 scroll-mt-28">
      {step < 4 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {visibleSteps.map((label, index) => {
            const current = index + 1
            const active = currentVisibleStep === current
            const done = currentVisibleStep > current
            return (
              <div
                key={label}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border',
                  active && 'bg-primary text-primary-foreground border-primary',
                  done && 'bg-primary/15 text-primary border-primary/30',
                  !active && !done && 'bg-muted text-muted-foreground border-border'
                )}
              >
                {label}
              </div>
            )
          })}
        </div>
      )}

      {usesExternalSelection && step === 1 && (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-lg font-semibold text-foreground">Escolha seus servicos acima</p>
            <p className="text-sm text-muted-foreground">
              Monte sua visita nos cards da secao de servicos e a agenda vai liberar os horarios compativeis aqui embaixo.
            </p>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        !usesExternalSelection && (
        <div className="space-y-5">
          <div className="flex justify-center gap-3 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? 'default' : 'outline'}
                onClick={() => setActiveCategory(category)}
              >
                {formatCategoryLabel(category)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredServices.map((service) => {
              const selected = selectedServices.some((item) => (item.id ?? item.name) === (service.id ?? service.name))
              return (
                <button
                  key={service.id ?? service.name}
                  type="button"
                  onClick={() => toggleService(service)}
                  className={cn(
                    'text-left p-4 rounded-xl border-2 transition-all duration-200',
                    selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40'
                  )}
                >
                  <div className="font-semibold text-foreground">{service.name}</div>
                  <div className="flex items-center justify-between gap-3 mt-2 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {service.duration}
                    </span>
                    <span className="font-semibold text-primary">{service.price}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {selectedServices.length > 0 && (
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-foreground">Resumo da visita</span>
                  <span className="font-semibold text-primary">{totalPrice}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedServices.length} servico(s) · {formatDuration(totalDuration)}
                </p>

                <div className="space-y-3">
                  {selectedServices.map((service, index) => {
                    const serviceId = service.id ?? ''
                    const serviceProfessionals = lockedProfessionalId
                      ? []
                      : service.professionals ?? []
                    const selectedProfessionalId = serviceId ? selectedProfessionalMap[serviceId] ?? '' : ''

                    return (
                      <div key={`${service.id ?? service.name}-${index}`} className="rounded-xl border border-border/60 p-3">
                        <p className="text-sm font-medium text-foreground">
                          {index + 1}. {service.name}
                        </p>

                        {lockedProfessionalId && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Profissional: <span className="font-medium text-foreground">{lockedProfessionalName ?? 'Agenda da profissional'}</span>
                          </p>
                        )}

                        {!lockedProfessionalId && serviceId && serviceProfessionals.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <Label htmlFor={`professional-${serviceId}`}>Profissional deste servico</Label>
                            <select
                              id={`professional-${serviceId}`}
                              value={selectedProfessionalId}
                              onChange={(event) => updateSelectedProfessional(serviceId, event.target.value)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Agenda escolhe automaticamente</option>
                              {serviceProfessionals.map((professional) => (
                                <option key={professional.id} value={professional.id}>
                                  {professional.name}{professional.specialty ? ` · ${professional.specialty}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={selectedServiceIds.length === 0}>
              Proximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
        )
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{visitLabel}</p>
                  <p className="text-sm text-muted-foreground">{selectedServices.map((service) => service.name).join(' + ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary">{totalPrice}</p>
                  <p className="text-sm text-muted-foreground">{formatDuration(totalDuration)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => {
                if (isBefore(date, today)) return true
                if (businessHours && businessHours.length > 0) {
                  const dayHours = businessHours.find((hour) => hour.weekday === date.getDay())
                  return !dayHours || dayHours.isClosed || !dayHours.opensAt || !dayHours.closesAt
                }
                const day = date.getDay()
                return day === 0 || day === 1
              }}
              locale={ptBR}
              className="rounded-xl border border-border shadow-sm"
            />
          </div>

          {selectedDate && selectedServiceIds.length === 1 && !lockedProfessionalId && singleServiceProfessionals.length > 0 && selectedSingleServiceId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <UserRound className="h-4 w-4 text-primary" />
                <span>Profissionais disponiveis</span>
              </div>
              <select
                value={selectedProfessionalMap[selectedSingleServiceId] ?? ''}
                onChange={(event) => updateSelectedProfessional(selectedSingleServiceId, event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Agenda escolhe automaticamente</option>
                {singleServiceProfessionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.displayName}{professional.specialty ? ` · ${professional.specialty}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedDate && lockedProfessionalId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="h-4 w-4 text-primary" />
              <span>
                Atendimento com <span className="font-semibold text-foreground">{lockedProfessionalName ?? 'profissional selecionada'}</span>
              </span>
            </div>
          )}

          {selectedDate && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <UserRound className="h-4 w-4 text-primary" />
                <span>{selectedServiceIds.length === 1 ? 'Horarios disponiveis' : 'Horarios iniciais disponiveis'}</span>
                {loadingAvailability && (
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                )}
              </div>

              {!loadingAvailability && timeSlots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                        selectedTime === slot
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/50 text-foreground'
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}

              {selectedTime && selectedAssignments.length > 0 && (
                <Card className="border-border/50">
                  <CardContent className="p-4 space-y-2">
                    <p className="font-semibold text-foreground">
                      {selectedAssignments.length === 1 ? 'Atendimento previsto' : 'Sequencia prevista'}
                    </p>
                    {selectedAssignments.map((assignment) => (
                      <div key={`${assignment.serviceId}-${assignment.sequence}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{assignment.startsAt}</span>
                        <span className="flex-1 font-medium text-foreground">{assignment.serviceName}</span>
                        <span className="text-primary">{assignment.professionalName}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {selectedDate && !loadingAvailability && timeSlots.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Sem disponibilidade para essa combinacao de servicos, profissionais e data.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(usesExternalSelection ? 1 : 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime}>
              Proximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">{formattedDate}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Horario inicial</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="border-t border-border/50 pt-2 mt-2 space-y-2">
                {selectedAssignments.map((assignment) => (
                  <div key={`${assignment.serviceId}-${assignment.sequence}`} className="flex justify-between text-sm gap-3">
                    <span className="text-muted-foreground">{assignment.startsAt}</span>
                    <span className="font-medium text-right">
                      {assignment.serviceName} · {assignment.professionalName}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm border-t border-border/50 pt-2 mt-2 gap-3">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-semibold text-primary">{totalPrice}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seq-name">Nome completo *</Label>
              <Input id="seq-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seq-phone">WhatsApp *</Label>
              <Input id="seq-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seq-notes">Observacoes</Label>
              <Textarea id="seq-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || !phone.trim() || isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Confirmar agendamento'}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 py-6 text-center">
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-2">Agendamento solicitado com sucesso</h3>
            <p className="mx-auto max-w-md text-muted-foreground">
              {bookingAutomation?.requiresDeposit
                ? 'Seu horario foi reservado e agora falta o envio do sinal para confirmar de vez. Os dados do pagamento tambem foram enviados no WhatsApp informado.'
                : 'A agenda ja validou o horario e salvou sua solicitacao. Se precisar cancelar ou remarcar, fale com o studio com antecedencia.'}
            </p>
          </div>

          <Card className="mx-auto max-w-lg border-border/50 text-left">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">{formattedDate}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted-foreground">Horario inicial</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="border-t border-border/50 pt-2 mt-2 space-y-2">
                {selectedAssignments.map((assignment) => (
                  <div key={`${assignment.serviceId}-${assignment.sequence}`} className="flex justify-between text-sm gap-3">
                    <span className="text-muted-foreground">{assignment.startsAt}</span>
                    <span className="font-medium text-right">
                      {assignment.serviceName} · {assignment.professionalName}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm border-t border-border/50 pt-2 mt-2 gap-3">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-primary">
                  {bookingAutomation?.requiresDeposit ? 'Aguardando sinal' : 'Confirmado'}
                </span>
              </div>
            </CardContent>
          </Card>

          {bookingAutomation?.requiresDeposit && bookingAutomation.paymentMessage && (
            <Card className="mx-auto max-w-lg border-primary/30 bg-primary/5 text-left">
              <CardContent className="p-4 space-y-3">
                <p className="font-semibold text-foreground">Pagamento do sinal</p>
                <p className="text-sm text-muted-foreground">
                  Para concluir a confirmacao, envie o sinal usando a chave PIX abaixo. Assim que pagar, mande o comprovante no WhatsApp.
                </p>
                <div className="rounded-lg border border-border/60 bg-background p-3 text-sm whitespace-pre-line text-foreground">
                  {bookingAutomation.paymentMessage}
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <Button variant="outline" onClick={resetForm}>
              Novo agendamento
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
