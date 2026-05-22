'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  LayoutDashboard, Globe, CalendarDays, Wrench,
  DollarSign, Users, Scissors, Shield,
  CheckCircle, XCircle, Clock, RefreshCw,
  Plus, Trash2, ChevronLeft, ChevronRight, Pencil, Save,
  TrendingUp, Star, Package, UserCheck,
  Settings, ArrowUpRight, Minus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type {
  ManagementDashboardData,
  DashboardMetric,
  DashboardFinance,
  DashboardProfessional,
  DashboardBooking,
  DashboardBlock,
  DashboardOrgSettings,
  DashboardLandingSettings,
  DashboardBusinessHour,
  DashboardService,
} from '@/lib/management-dashboard-data'

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_DB: Record<string, string> = {
  'Confirmado': 'confirmed',
  'Pendente': 'pending',
  'Cancelado': 'cancelled',
  'Concluído': 'completed',
  'Reagendado': 'rescheduled',
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  rescheduled: 'Reagendado',
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Confirmado': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    'Concluído': 'bg-emerald-600/15 text-emerald-300 border-emerald-600/20',
    'Pendente': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    'Cancelado': 'bg-rose-500/15 text-rose-400 border-rose-500/20',
    'Reagendado': 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20'}`}>
      {status}
    </span>
  )
}

function toCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function addDays(date: string, amount: number) {
  const base = new Date(`${date}T12:00:00`)
  base.setDate(base.getDate() + amount)
  return base.toISOString().slice(0, 10)
}

function formatSelectedDateLabel(date: string) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10)
  const tomorrow = addDays(today, 1)

  if (date === today) return 'Hoje'
  if (date === tomorrow) return 'Amanhã'

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${date}T12:00:00`))
}

// ─── Tabs config ───────────────────────────────────────────────────────────────

const TABS = [
  { value: 'visao-geral',  icon: LayoutDashboard, label: 'Visão geral' },
  { value: 'landing-page', icon: Globe,            label: 'Landing page' },
  { value: 'agenda',       icon: CalendarDays,      label: 'Agenda' },
  { value: 'operacao',     icon: Wrench,            label: 'Operação' },
  { value: 'financeiro',   icon: DollarSign,        label: 'Financeiro' },
  { value: 'profissionais',icon: Users,             label: 'Profissionais' },
  { value: 'servicos',     icon: Scissors,          label: 'Serviços' },
  { value: 'acessos',      icon: Shield,            label: 'Acessos' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManagementDashboard({ data }: { data: ManagementDashboardData }) {
  const [activeTab, setActiveTab] = useState('visao-geral')

  // Mutable state from server data
  const [selectedDate, setSelectedDate] = useState(data.overview.selectedDate)
  const [overviewMetrics, setOverviewMetrics] = useState<DashboardMetric[]>(data.overview.metrics)
  const [bookings, setBookings] = useState<DashboardBooking[]>(data.overview.bookings)
  const [overviewProfessionals, setOverviewProfessionals] = useState<DashboardProfessional[]>(data.overview.professionals)
  const [overviewFinance, setOverviewFinance] = useState<DashboardFinance>(data.overview.finance)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [blocks, setBlocks] = useState<DashboardBlock[]>(data.blocks)
  const [orgSettings, setOrgSettings] = useState<DashboardOrgSettings>(data.orgSettings)
  const [landingSettings, setLandingSettings] = useState<DashboardLandingSettings>(data.landingSettings)
  const [businessHours, setBusinessHours] = useState<DashboardBusinessHour[]>(data.businessHours)
  const [services, setServices] = useState<DashboardService[]>(data.services)

  // Saving states
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingLanding, setSavingLanding] = useState(false)
  const [savingBusinessHours, setSavingBusinessHours] = useState(false)
  const [creatingBlock, setCreatingBlock] = useState(false)
  const [creatingService, setCreatingService] = useState(false)

  // Block form
  const [blockForm, setBlockForm] = useState({ professional: '', startsAt: '', endsAt: '', reason: '' })

  // Service create form
  const [serviceForm, setServiceForm] = useState({ name: '', category: 'unhas' as 'unhas' | 'cilios', durationMin: '', priceCents: '' })

  // ── Handlers ────────────────────────────────────────────────────────────────

  const goToTab = useCallback((value: string) => {
    setActiveTab(value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const loadOverview = useCallback(async (date: string, options?: { silent?: boolean; showError?: boolean }) => {
    if (!options?.silent) setLoadingOverview(true)

    try {
      const res = await fetch(`/api/management/bookings?date=${encodeURIComponent(date)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()

      const json = await res.json() as {
        selectedDate: string
        metrics: DashboardMetric[]
        bookings: DashboardBooking[]
        professionals: DashboardProfessional[]
        finance: DashboardFinance
      }

      setSelectedDate(json.selectedDate)
      setOverviewMetrics(json.metrics)
      setBookings(json.bookings)
      setOverviewProfessionals(json.professionals)
      setOverviewFinance(json.finance)
    } catch {
      if (options?.showError !== false) {
        toast.error('Erro ao carregar agenda do dia')
      }
    } finally {
      if (!options?.silent) setLoadingOverview(false)
    }
  }, [])

  useEffect(() => {
    setSelectedDate(data.overview.selectedDate)
    setOverviewMetrics(data.overview.metrics)
    setBookings(data.overview.bookings)
    setOverviewProfessionals(data.overview.professionals)
    setOverviewFinance(data.overview.finance)
  }, [data])

  const navigateOverviewDate = useCallback(async (offset: number) => {
    const nextDate = addDays(selectedDate, offset)
    await loadOverview(nextDate)
  }, [loadOverview, selectedDate])

  const updateBookingStatus = useCallback(async (id: string, statusLabel: string) => {
    const dbStatus = STATUS_DB[statusLabel] ?? 'pending'
    const prev = bookings
    setBookings((bs) => bs.map((b) => b.id === id ? { ...b, status: statusLabel } : b))
    try {
      const res = await fetch(`/api/management/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: dbStatus }),
      })
      if (!res.ok) throw new Error()
      await loadOverview(selectedDate, { silent: true, showError: false })
      toast.success('Status atualizado')
    } catch {
      setBookings(prev)
      toast.error('Erro ao atualizar status')
    }
  }, [bookings, loadOverview, selectedDate])

  const saveOrgSettings = useCallback(async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/management/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org: orgSettings }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configurações salvas')
    } catch {
      toast.error('Erro ao salvar configurações')
    } finally {
      setSavingSettings(false)
    }
  }, [orgSettings])

  const saveLandingSettings = useCallback(async () => {
    setSavingLanding(true)
    try {
      const res = await fetch('/api/management/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lp: landingSettings }),
      })
      if (!res.ok) throw new Error()
      toast.success('Landing page salva')
    } catch {
      toast.error('Erro ao salvar landing page')
    } finally {
      setSavingLanding(false)
    }
  }, [landingSettings])

  const createBlock = useCallback(async () => {
    if (!blockForm.startsAt || !blockForm.endsAt || !blockForm.reason.trim()) {
      toast.error('Preencha início, fim e motivo')
      return
    }
    setCreatingBlock(true)
    try {
      const res = await fetch('/api/management/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalId: blockForm.professional && blockForm.professional !== 'all' ? blockForm.professional : undefined,
          startsAt: blockForm.startsAt,
          endsAt: blockForm.endsAt,
          reason: blockForm.reason,
        }),
      })
      if (!res.ok) throw new Error()
      const newBlock: DashboardBlock = {
        id: `blk-${Date.now()}`,
        professional: blockForm.professional || 'Todas',
        period: `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(blockForm.startsAt))} — ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(blockForm.endsAt))}`,
        reason: blockForm.reason,
        action: 'Bloquear agenda online',
      }
      setBlocks((b) => [newBlock, ...b])
      setBlockForm({ professional: '', startsAt: '', endsAt: '', reason: '' })
      toast.success('Bloqueio criado')
    } catch {
      toast.error('Erro ao criar bloqueio')
    } finally {
      setCreatingBlock(false)
    }
  }, [blockForm])

  const deleteBlock = useCallback(async (id: string) => {
    const prev = blocks
    setBlocks((b) => b.filter((x) => x.id !== id))
    try {
      const res = await fetch('/api/management/blocks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Bloqueio removido')
    } catch {
      setBlocks(prev)
      toast.error('Erro ao remover bloqueio')
    }
  }, [blocks])

  const toggleOrgSwitch = useCallback((field: keyof DashboardOrgSettings, value: boolean) => {
    setOrgSettings((s) => ({ ...s, [field]: value }))
  }, [])

  const toggleLandingSwitch = useCallback((field: keyof DashboardLandingSettings, value: boolean) => {
    setLandingSettings((s) => ({ ...s, [field]: value }))
  }, [])

  const saveBusinessHours = useCallback(async () => {
    setSavingBusinessHours(true)
    try {
      const res = await fetch('/api/management/business-hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: businessHours }),
      })
      if (!res.ok) throw new Error()
      toast.success('Horários salvos — landing atualizada')
    } catch {
      toast.error('Erro ao salvar horários')
    } finally {
      setSavingBusinessHours(false)
    }
  }, [businessHours])

  const updateBusinessHour = useCallback((weekday: number, field: 'opensAt' | 'closesAt' | 'isClosed', value: string | boolean) => {
    setBusinessHours((hs) => hs.map((h) => h.weekday === weekday ? { ...h, [field]: value } : h))
  }, [])

  const createService = useCallback(async () => {
    const dMin = parseInt(serviceForm.durationMin, 10)
    const pCents = Math.round(parseFloat(serviceForm.priceCents.replace(',', '.')) * 100)
    if (!serviceForm.name.trim() || isNaN(dMin) || isNaN(pCents)) {
      toast.error('Preencha nome, duração e preço')
      return
    }
    setCreatingService(true)
    try {
      const res = await fetch('/api/management/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serviceForm.name.trim(),
          category: serviceForm.category,
          durationMin: dMin,
          priceCents: pCents,
          onlineEnabled: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error()
      const newSvc: DashboardService = {
        id: json.id ?? `svc-${Date.now()}`,
        name: serviceForm.name.trim(),
        category: serviceForm.category,
        durationMin: dMin,
        priceCents: pCents,
        professional: '',
        onlineEnabled: true,
        isFeatured: false,
      }
      setServices((s) => [...s, newSvc])
      setServiceForm({ name: '', category: 'unhas', durationMin: '', priceCents: '' })
      toast.success('Serviço criado — aparece na landing')
    } catch {
      toast.error('Erro ao criar serviço')
    } finally {
      setCreatingService(false)
    }
  }, [serviceForm])

  const toggleServiceOnline = useCallback(async (id: string, current: boolean) => {
    setServices((s) => s.map((svc) => svc.id === id ? { ...svc, onlineEnabled: !current } : svc))
    try {
      const res = await fetch('/api/management/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, onlineEnabled: !current }),
      })
      if (!res.ok) throw new Error()
      toast.success(!current ? 'Habilitado na landing' : 'Removido da landing')
    } catch {
      setServices((s) => s.map((svc) => svc.id === id ? { ...svc, onlineEnabled: current } : svc))
      toast.error('Erro ao atualizar serviço')
    }
  }, [])

  const deleteService = useCallback(async (id: string) => {
    const prev = services
    setServices((s) => s.filter((svc) => svc.id !== id))
    try {
      const res = await fetch('/api/management/services', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Serviço removido')
    } catch {
      setServices(prev)
      toast.error('Erro ao remover serviço')
    }
  }, [services])

  // ── UI helpers ──────────────────────────────────────────────────────────────

  function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
      <Card className="bg-white/5 border-white/10 rounded-xl p-4 flex flex-col gap-1">
        <p className="text-xs text-white/50 uppercase tracking-widest font-medium">{label}</p>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-white/40">{sub}</p>
      </Card>
    )
  }

  function Sec({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
      <Card className="bg-white/[0.04] border-white/10 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-white/10 px-5 py-3 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-white/80">{title}</CardTitle>
          {action}
        </CardHeader>
        <CardContent className="p-5">{children}</CardContent>
      </Card>
    )
  }

  function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Label className="text-white/60 text-xs sm:w-40 shrink-0">{label}</Label>
        <div className="flex-1">{children}</div>
      </div>
    )
  }

  function SwitchRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
    return (
      <div className="flex items-center justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
        <span className="text-sm text-white/70">{label}</span>
        <Switch checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-rose-500" />
      </div>
    )
  }

  const inputClass = "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-rose-400/50 focus:ring-rose-400/20 text-sm"

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#12060c 0%,#1a0c14 40%,#0e080d 100%)' }}>
      {/* Header */}
      <div className="relative border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -20%, oklch(0.45 0.18 15 / 0.35), transparent)' }} />
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-rose-400/60 font-medium mb-1">Painel de gestão</p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">SC Studio & Esmalteria</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/40 hidden sm:inline">Sistema online</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tab bar */}
          <TabsList className="w-full bg-white/5 border border-white/10 rounded-xl p-1 h-auto flex-wrap gap-0.5 mb-6">
            {TABS.map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-1 min-w-fit flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium text-white/40 transition-all data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow"
              >
                <Icon size={14} className="shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Visão Geral ──────────────────────────────────────────────────── */}
          <TabsContent value="visao-geral" className="space-y-5 mt-0">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-medium">Filtro do dia</p>
                <p className="text-sm text-white/70">Os KPIs e a ocupação acompanham a data selecionada.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => navigateOverviewDate(-1)}
                  disabled={loadingOverview}
                  className="h-8 w-8 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                </Button>
                <div className="min-w-[120px] text-center">
                  <p className="text-sm font-semibold text-white">{formatSelectedDateLabel(selectedDate)}</p>
                  <p className="text-[11px] text-white/35">{selectedDate}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => navigateOverviewDate(1)}
                  disabled={loadingOverview}
                  className="h-8 w-8 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <ChevronRight size={14} />
                </Button>
                {loadingOverview && <RefreshCw size={14} className="text-white/40 animate-spin" />}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {overviewMetrics.map((m) => (
                <Kpi key={m.label} label={m.label} value={m.value} sub={m.detail} />
              ))}
            </div>

            {/* Agenda do dia */}
            <Sec title="Agenda do dia">
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left pb-2 text-white/30 font-medium text-xs uppercase tracking-wider">Hora</th>
                      <th className="text-left pb-2 text-white/30 font-medium text-xs uppercase tracking-wider">Cliente</th>
                      <th className="text-left pb-2 text-white/30 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Serviço</th>
                      <th className="text-left pb-2 text-white/30 font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Profissional</th>
                      <th className="text-left pb-2 text-white/30 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Valor</th>
                      <th className="text-left pb-2 text-white/30 font-medium text-xs uppercase tracking-wider">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {bookings.slice(0, 8).map((b) => (
                      <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-white/80 text-xs">{b.time}</td>
                        <td className="py-2.5 pr-4 text-white/90 text-xs font-medium">{b.client}</td>
                        <td className="py-2.5 pr-4 text-white/60 text-xs hidden md:table-cell max-w-[160px] truncate">{b.service}</td>
                        <td className="py-2.5 pr-4 text-white/50 text-xs hidden lg:table-cell">{b.professional}</td>
                        <td className="py-2.5 pr-4 text-white/70 text-xs font-mono hidden sm:table-cell">{toCurrency(b.amount)}</td>
                        <td className="py-2.5 pr-2"><StatusBadge status={b.status} /></td>
                        <td className="py-2.5">
                          <Select
                            value={STATUS_DB[b.status] ?? 'pending'}
                            onValueChange={(v) => updateBookingStatus(b.id, STATUS_LABEL[v] ?? b.status)}
                          >
                            <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent text-white/30 hover:text-white/60 [&>svg]:hidden">
                              <Pencil size={11} />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10 text-white min-w-[140px]">
                              <SelectItem value="confirmed">Confirmado</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="completed">Concluído</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                              <SelectItem value="rescheduled">Reagendado</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-white/35">
                          Nenhum agendamento para este dia
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Sec>

            {/* Quick stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Sec title="Receita do dia">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Receita bruta</span>
                    <span className="text-white font-semibold">{toCurrency(overviewFinance.grossRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Confirmada</span>
                    <span className="text-emerald-400 font-semibold">{toCurrency(overviewFinance.confirmedRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Pendente</span>
                    <span className="text-amber-400 font-semibold">{toCurrency(overviewFinance.pendingRevenue)}</span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex justify-between text-sm">
                    <span className="text-white/50">Repasse previsto</span>
                    <span className="text-rose-300 font-semibold">{toCurrency(overviewFinance.payrollProjected)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Líquido salão</span>
                    <span className="text-white font-bold">{toCurrency(overviewFinance.salonNetProjected)}</span>
                  </div>
                </div>
              </Sec>

              <Sec title="Equipe do dia">
                <div className="space-y-3">
                  {overviewProfessionals.map((p) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="text-xs font-bold" style={{ background: 'oklch(0.45 0.18 15 / 0.3)', color: 'oklch(0.85 0.1 15)' }}>{p.initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/80 text-xs font-medium truncate">{p.name}</p>
                        <Progress value={p.occupancy} className="h-1 mt-1 bg-white/10 [&>div]:bg-rose-400" />
                      </div>
                      <span className="text-xs text-white/40 shrink-0">{p.occupancy}%</span>
                    </div>
                  ))}
                  {overviewProfessionals.length === 0 && (
                    <p className="text-white/30 text-xs text-center py-6">Nenhum profissional para este dia</p>
                  )}
                </div>
              </Sec>

              <Sec title="Transferências recentes">
                <div className="space-y-3">
                  {data.transfers.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowUpRight size={10} className="text-sky-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white/80 text-xs font-medium truncate">{t.client}</p>
                        <p className="text-white/40 text-xs">{t.from} → {t.to}</p>
                        <p className="text-white/30 text-[10px]">{t.slot}</p>
                      </div>
                    </div>
                  ))}
                  {data.transfers.length === 0 && (
                    <p className="text-white/30 text-xs text-center py-6">Nenhuma transferência recente</p>
                  )}
                </div>
              </Sec>
            </div>
          </TabsContent>

          {/* ── Landing Page ─────────────────────────────────────────────────── */}
          <TabsContent value="landing-page" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Sec title="Textos do hero" action={
                <Button size="sm" onClick={saveLandingSettings} disabled={savingLanding}
                  className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                  <Save size={12} className="mr-1" />{savingLanding ? 'Salvando…' : 'Salvar'}
                </Button>
              }>
                <div className="space-y-4">
                  <FieldRow label="Título principal">
                    <Input value={landingSettings.heroTitle} onChange={(e) => setLandingSettings((s) => ({ ...s, heroTitle: e.target.value }))}
                      className={inputClass} placeholder="Ex: Sua agenda online…" />
                  </FieldRow>
                  <FieldRow label="Subtítulo">
                    <Textarea value={landingSettings.heroSubtitle} onChange={(e) => setLandingSettings((s) => ({ ...s, heroSubtitle: e.target.value }))}
                      className={`${inputClass} resize-none min-h-[64px]`} placeholder="Ex: Destaque as especialistas…" />
                  </FieldRow>
                  <FieldRow label="CTA principal">
                    <Input value={landingSettings.primaryCtaLabel} onChange={(e) => setLandingSettings((s) => ({ ...s, primaryCtaLabel: e.target.value }))}
                      className={inputClass} placeholder="Ex: Agendar meu horário" />
                  </FieldRow>
                  <FieldRow label="CTA secundário">
                    <Input value={landingSettings.secondaryCtaLabel} onChange={(e) => setLandingSettings((s) => ({ ...s, secondaryCtaLabel: e.target.value }))}
                      className={inputClass} placeholder="Ex: Conhecer as profissionais" />
                  </FieldRow>
                </div>
              </Sec>

              <div className="space-y-4">
                <Sec title="Seções visíveis" action={
                  <Button size="sm" onClick={saveLandingSettings} disabled={savingLanding}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Save size={12} className="mr-1" />{savingLanding ? 'Salvando…' : 'Salvar'}
                  </Button>
                }>
                  <SwitchRow label="Exibir profissionais" checked={landingSettings.showProfessionals} onCheckedChange={(v) => toggleLandingSwitch('showProfessionals', v)} />
                  <SwitchRow label="Exibir produtos" checked={landingSettings.showProducts} onCheckedChange={(v) => toggleLandingSwitch('showProducts', v)} />
                  <SwitchRow label="Exibir depoimentos" checked={landingSettings.showTestimonials} onCheckedChange={(v) => toggleLandingSwitch('showTestimonials', v)} />
                  <SwitchRow label="Prova social" checked={landingSettings.socialProofEnabled} onCheckedChange={(v) => toggleLandingSwitch('socialProofEnabled', v)} />
                  <SwitchRow label="Exibir pacotes" checked={landingSettings.showPackages} onCheckedChange={(v) => toggleLandingSwitch('showPackages', v)} />
                </Sec>

                <Sec title="Tema">
                  <FieldRow label="Variante">
                    <Select value={landingSettings.themeVariant} onValueChange={(v) => setLandingSettings((s) => ({ ...s, themeVariant: v }))}>
                      <SelectTrigger className={inputClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="sofisticado">Sofisticado</SelectItem>
                        <SelectItem value="moderno">Moderno</SelectItem>
                        <SelectItem value="minimalista">Minimalista</SelectItem>
                        <SelectItem value="bold">Bold</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </Sec>
              </div>
            </div>
          </TabsContent>

          {/* ── Agenda ───────────────────────────────────────────────────────── */}
          <TabsContent value="agenda" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Sec title="Horários de funcionamento" action={
                <Button size="sm" onClick={saveBusinessHours} disabled={savingBusinessHours}
                  className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                  <Save size={12} className="mr-1" />{savingBusinessHours ? 'Salvando…' : 'Salvar'}
                </Button>
              }>
                <div className="space-y-1.5">
                  {[...businessHours].sort((a, b) => (a.weekday === 0 ? 7 : a.weekday) - (b.weekday === 0 ? 7 : b.weekday)).map((h) => (
                    <div key={h.weekday} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <span className="text-white/60 text-xs w-8 shrink-0 font-medium">{WEEKDAYS[h.weekday]}</span>
                      {h.isClosed ? (
                        <span className="text-rose-400/60 text-xs flex-1">Fechado</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={h.opensAt ?? ''}
                            onChange={(e) => updateBusinessHour(h.weekday, 'opensAt', e.target.value)}
                            className={`${inputClass} w-24 h-7 text-xs`}
                          />
                          <span className="text-white/30 text-xs">–</span>
                          <Input
                            type="time"
                            value={h.closesAt ?? ''}
                            onChange={(e) => updateBusinessHour(h.weekday, 'closesAt', e.target.value)}
                            className={`${inputClass} w-24 h-7 text-xs`}
                          />
                        </div>
                      )}
                      <Switch
                        checked={!h.isClosed}
                        onCheckedChange={(checked) => updateBusinessHour(h.weekday, 'isClosed', !checked)}
                        className="ml-auto data-[state=checked]:bg-rose-500 scale-75"
                      />
                    </div>
                  ))}
                </div>
              </Sec>

              <div className="space-y-4">
                <Sec title="Configurações de agendamento" action={
                  <Button size="sm" onClick={saveOrgSettings} disabled={savingSettings}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Save size={12} className="mr-1" />{savingSettings ? 'Salvando…' : 'Salvar'}
                  </Button>
                }>
                  <div className="space-y-4">
                    <FieldRow label="Intervalo (min)">
                      <Select value={String(orgSettings.bookingSlotMinutes)} onValueChange={(v) => setOrgSettings((s) => ({ ...s, bookingSlotMinutes: Number(v) }))}>
                        <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white">
                          <SelectItem value="15">15 min</SelectItem>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="45">45 min</SelectItem>
                          <SelectItem value="60">60 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldRow>
                    <FieldRow label="Canal de confirmação">
                      <Select value={orgSettings.confirmationChannel} onValueChange={(v) => setOrgSettings((s) => ({ ...s, confirmationChannel: v }))}>
                        <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white">
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="ambos">WhatsApp + E-mail</SelectItem>
                          <SelectItem value="nenhum">Nenhum</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldRow>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-0.5">
                    <SwitchRow label="Permitir escolha de profissional" checked={orgSettings.allowProfessionalSelection} onCheckedChange={(v) => toggleOrgSwitch('allowProfessionalSelection', v)} />
                    <SwitchRow label="Exigir sinal de reserva" checked={orgSettings.requireDeposit} onCheckedChange={(v) => toggleOrgSwitch('requireDeposit', v)} />
                  </div>
                </Sec>

                <Sec title="Automações">
                  <SwitchRow label="Botão WhatsApp na landing" checked={orgSettings.showWhatsappButton} onCheckedChange={(v) => toggleOrgSwitch('showWhatsappButton', v)} />
                  <SwitchRow label="Auto-confirmação por WhatsApp" checked={orgSettings.autoConfirmWhatsapp} onCheckedChange={(v) => toggleOrgSwitch('autoConfirmWhatsapp', v)} />
                  <SwitchRow label="Lista de espera inteligente" checked={orgSettings.smartWaitlist} onCheckedChange={(v) => toggleOrgSwitch('smartWaitlist', v)} />
                  <SwitchRow label="Transferência assistida" checked={orgSettings.assistedTransfer} onCheckedChange={(v) => toggleOrgSwitch('assistedTransfer', v)} />
                  <SwitchRow label="Fechamento de caixa diário" checked={orgSettings.dailyClosure} onCheckedChange={(v) => toggleOrgSwitch('dailyClosure', v)} />
                </Sec>
              </div>
            </div>
          </TabsContent>

          {/* ── Operação ─────────────────────────────────────────────────────── */}
          <TabsContent value="operacao" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* New block form */}
              <Sec title="Novo bloqueio de agenda">
                <div className="space-y-3">
                  <FieldRow label="Profissional">
                    <Select value={blockForm.professional || 'all'} onValueChange={(v) => setBlockForm((f) => ({ ...f, professional: v === 'all' ? '' : v }))}>
                      <SelectTrigger className={inputClass}><SelectValue placeholder="Todas as profissionais" /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="all">Todas as profissionais</SelectItem>
                        {data.professionals.map((p) => (
                          <SelectItem key={p.name} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Início">
                    <Input type="datetime-local" value={blockForm.startsAt} onChange={(e) => setBlockForm((f) => ({ ...f, startsAt: e.target.value }))}
                      className={`${inputClass} [color-scheme:dark]`} />
                  </FieldRow>
                  <FieldRow label="Fim">
                    <Input type="datetime-local" value={blockForm.endsAt} onChange={(e) => setBlockForm((f) => ({ ...f, endsAt: e.target.value }))}
                      className={`${inputClass} [color-scheme:dark]`} />
                  </FieldRow>
                  <FieldRow label="Motivo">
                    <Input value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                      className={inputClass} placeholder="Ex: Treinamento, folga…" />
                  </FieldRow>
                  <Button onClick={createBlock} disabled={creatingBlock}
                    className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Plus size={14} className="mr-1" />{creatingBlock ? 'Criando…' : 'Criar bloqueio'}
                  </Button>
                </div>
              </Sec>

              <Sec title={`Bloqueios ativos (${blocks.length})`}>
                {blocks.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-4">Nenhum bloqueio ativo</p>
                ) : (
                  <div className="space-y-2">
                    {blocks.map((blk) => (
                      <div key={blk.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-xs font-semibold">{blk.professional}</p>
                          <p className="text-white/50 text-xs mt-0.5">{blk.period}</p>
                          <p className="text-white/40 text-xs mt-0.5 italic">{blk.reason}</p>
                        </div>
                        <button onClick={() => deleteBlock(blk.id)}
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-lg hover:bg-rose-500/20 text-white/30 hover:text-rose-400 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Sec>
            </div>

            {/* Transfers */}
            <Sec title="Histórico de transferências">
              {data.transfers.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">Nenhuma transferência registrada</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left pb-2 text-white/30 text-xs uppercase tracking-wider font-medium">Cliente</th>
                        <th className="text-left pb-2 text-white/30 text-xs uppercase tracking-wider font-medium">De</th>
                        <th className="text-left pb-2 text-white/30 text-xs uppercase tracking-wider font-medium">Para</th>
                        <th className="text-left pb-2 text-white/30 text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Horário</th>
                        <th className="text-left pb-2 text-white/30 text-xs uppercase tracking-wider font-medium hidden md:table-cell">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.transfers.map((t) => (
                        <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 pr-4 text-white/80 text-xs font-medium">{t.client}</td>
                          <td className="py-2.5 pr-4 text-white/50 text-xs">{t.from}</td>
                          <td className="py-2.5 pr-4 text-emerald-400 text-xs font-medium">{t.to}</td>
                          <td className="py-2.5 pr-4 text-white/40 text-xs hidden sm:table-cell">{t.slot}</td>
                          <td className="py-2.5 text-white/40 text-xs hidden md:table-cell italic">{t.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Sec>
          </TabsContent>

          {/* ── Financeiro ───────────────────────────────────────────────────── */}
          <TabsContent value="financeiro" className="space-y-5 mt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="Receita bruta" value={toCurrency(data.finance.grossRevenue)} sub="Todos os agendamentos ativos" />
              <Kpi label="Confirmada" value={toCurrency(data.finance.confirmedRevenue)} sub="Confirmados + concluídos" />
              <Kpi label="Ticket médio" value={toCurrency(data.finance.averageTicket)} sub="Por atendimento" />
              <Kpi label="Líquido salão" value={toCurrency(data.finance.salonNetProjected)} sub="Após repasse da equipe" />
            </div>

            <Sec title="Repasse por profissional">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left pb-2.5 text-white/30 text-xs uppercase tracking-wider font-medium">Profissional</th>
                      <th className="text-right pb-2.5 text-white/30 text-xs uppercase tracking-wider font-medium">Atend.</th>
                      <th className="text-right pb-2.5 text-white/30 text-xs uppercase tracking-wider font-medium">Receita</th>
                      <th className="text-right pb-2.5 text-white/30 text-xs uppercase tracking-wider font-medium">Comissão</th>
                      <th className="text-right pb-2.5 text-white/30 text-xs uppercase tracking-wider font-medium">Repasse</th>
                      <th className="text-right pb-2.5 text-white/30 text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Salão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.professionals.map((p) => (
                      <tr key={p.name} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7 shrink-0">
                              <AvatarFallback className="text-[10px] font-bold" style={{ background: 'oklch(0.45 0.18 15 / 0.3)', color: 'oklch(0.85 0.1 15)' }}>{p.initials}</AvatarFallback>
                            </Avatar>
                            <span className="text-white/80 text-xs font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right text-white/60 text-xs">{p.bookings}</td>
                        <td className="py-3 pr-4 text-right text-white/80 text-xs font-mono">{toCurrency(p.revenue)}</td>
                        <td className="py-3 pr-4 text-right">
                          <span className="text-white/40 text-xs bg-white/5 px-2 py-0.5 rounded-full">{p.commissionRate}%</span>
                        </td>
                        <td className="py-3 pr-4 text-right text-rose-300 text-xs font-mono font-semibold">{toCurrency(p.payout)}</td>
                        <td className="py-3 text-right text-emerald-400 text-xs font-mono hidden sm:table-cell">{toCurrency(p.salonShare)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-white/10">
                      <td className="pt-3 text-white/50 text-xs font-semibold">Total</td>
                      <td className="pt-3 text-right text-white/60 text-xs">{data.professionals.reduce((t, p) => t + p.bookings, 0)}</td>
                      <td className="pt-3 text-right text-white text-xs font-bold font-mono">{toCurrency(data.finance.grossRevenue)}</td>
                      <td className="pt-3" />
                      <td className="pt-3 text-right text-rose-300 text-xs font-bold font-mono">{toCurrency(data.finance.payrollProjected)}</td>
                      <td className="pt-3 text-right text-emerald-400 text-xs font-bold font-mono hidden sm:table-cell">{toCurrency(data.finance.salonNetProjected)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Sec>
          </TabsContent>

          {/* ── Profissionais ─────────────────────────────────────────────────── */}
          <TabsContent value="profissionais" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.professionals.map((p) => (
                <Card key={p.name} className="bg-white/[0.04] border-white/10 rounded-2xl overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="w-11 h-11 shrink-0">
                        <AvatarFallback className="text-sm font-bold" style={{ background: 'oklch(0.45 0.18 15 / 0.3)', color: 'oklch(0.85 0.1 15)' }}>{p.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-white font-semibold text-sm">{p.name}</p>
                        <p className="text-white/40 text-xs">{p.specialty || p.role}</p>
                      </div>
                      <Badge className="ml-auto text-[10px] bg-white/5 text-white/50 border-white/10">{p.access}</Badge>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Ocupação</span>
                        <span className="text-white/70 font-medium">{p.occupancy}%</span>
                      </div>
                      <Progress value={p.occupancy} className="h-1.5 bg-white/10 [&>div]:bg-rose-400" />
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="text-center">
                          <p className="text-white/80 text-sm font-bold">{p.bookings}</p>
                          <p className="text-white/30 text-[10px]">Atend.</p>
                        </div>
                        <div className="text-center">
                          <p className="text-rose-300 text-sm font-bold">{p.commissionRate}%</p>
                          <p className="text-white/30 text-[10px]">Comissão</p>
                        </div>
                        <div className="text-center">
                          <p className="text-emerald-400 text-sm font-bold">{toCurrency(p.revenue)}</p>
                          <p className="text-white/30 text-[10px]">Receita</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── Serviços ─────────────────────────────────────────────────────── */}
          <TabsContent value="servicos" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Sec title={`Catálogo (${services.length})`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left pb-2 text-white/30 text-xs uppercase tracking-wider font-medium">Serviço</th>
                        <th className="text-left pb-2 text-white/30 text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Cat.</th>
                        <th className="text-right pb-2 text-white/30 text-xs uppercase tracking-wider font-medium">Min</th>
                        <th className="text-right pb-2 text-white/30 text-xs uppercase tracking-wider font-medium">Preço</th>
                        <th className="text-center pb-2 text-white/30 text-xs uppercase tracking-wider font-medium">Online</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {services.map((svc) => (
                        <tr key={svc.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-1.5">
                              {svc.isFeatured && <Star size={10} className="text-amber-400 shrink-0" />}
                              <span className="text-white/80 text-xs font-medium">{svc.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-white/40 text-xs hidden sm:table-cell">{svc.category}</td>
                          <td className="py-2.5 pr-3 text-right text-white/50 text-xs">{svc.durationMin}</td>
                          <td className="py-2.5 pr-3 text-right text-white/80 text-xs font-mono">{toCurrency(svc.priceCents / 100)}</td>
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => toggleServiceOnline(svc.id, svc.onlineEnabled)}
                              title={svc.onlineEnabled ? 'Desabilitar na landing' : 'Habilitar na landing'}
                            >
                              {svc.onlineEnabled
                                ? <CheckCircle size={13} className="text-emerald-400 mx-auto" />
                                : <XCircle size={13} className="text-white/20 mx-auto" />
                              }
                            </button>
                          </td>
                          <td className="py-2.5 pl-1">
                            <button
                              onClick={() => deleteService(svc.id)}
                              className="text-white/20 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remover serviço"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {services.length === 0 && (
                    <p className="text-white/30 text-sm text-center py-4">Nenhum serviço cadastrado</p>
                  )}
                </div>
              </Sec>

              <div className="space-y-4">
                <Sec title="Novo serviço" action={
                  <Button size="sm" onClick={createService} disabled={creatingService}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Plus size={12} className="mr-1" />{creatingService ? 'Criando…' : 'Criar'}
                  </Button>
                }>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Nome *</Label>
                      <Input
                        placeholder="Ex: Esmaltação em Gel"
                        value={serviceForm.name}
                        onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
                        className={`${inputClass} text-xs`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-white/50 text-xs mb-1.5 block">Categoria *</Label>
                        <Select value={serviceForm.category} onValueChange={(v) => setServiceForm((f) => ({ ...f, category: v as 'unhas' | 'cilios' }))}>
                          <SelectTrigger className={`${inputClass} text-xs h-8`}><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-white/10 text-white">
                            <SelectItem value="unhas">Unhas</SelectItem>
                            <SelectItem value="cilios">Cílios</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-white/50 text-xs mb-1.5 block">Duração (min) *</Label>
                        <Input
                          type="number"
                          placeholder="60"
                          value={serviceForm.durationMin}
                          onChange={(e) => setServiceForm((f) => ({ ...f, durationMin: e.target.value }))}
                          className={`${inputClass} text-xs`}
                          min={5}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Preço (R$) *</Label>
                      <Input
                        placeholder="60,00"
                        value={serviceForm.priceCents}
                        onChange={(e) => setServiceForm((f) => ({ ...f, priceCents: e.target.value }))}
                        className={`${inputClass} text-xs`}
                      />
                    </div>
                    <p className="text-white/30 text-[10px]">O serviço aparece na landing imediatamente após criado.</p>
                  </div>
                </Sec>

                <Sec title={`Produtos (${data.products.length})`}>
                  <div className="space-y-2">
                    {data.products.map((prd) => (
                      <div key={prd.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <Package size={14} className="text-white/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-xs font-semibold truncate">{prd.name}</p>
                          <p className="text-white/30 text-[10px]">SKU: {prd.sku} · Vinculado: {prd.attachedService}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold ${prd.stockQuantity <= 5 ? 'text-rose-400' : 'text-white/70'}`}>{prd.stockQuantity}</p>
                          <p className="text-white/30 text-[10px]">em estoque</p>
                        </div>
                      </div>
                    ))}
                    {data.products.length === 0 && (
                      <p className="text-white/30 text-sm text-center py-4">Nenhum produto cadastrado</p>
                    )}
                  </div>
                </Sec>
              </div>
            </div>
          </TabsContent>

          {/* ── Acessos ──────────────────────────────────────────────────────── */}
          <TabsContent value="acessos" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Sec title={`Usuários (${data.staff.length})`}>
                <div className="space-y-2">
                  {data.staff.map((s) => {
                    const roleColors: Record<string, string> = {
                      admin: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
                      frontdesk: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
                      professional: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
                    }
                    return (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarFallback className="text-xs font-bold" style={{ background: 'oklch(0.45 0.18 15 / 0.3)', color: 'oklch(0.85 0.1 15)' }}>
                            {s.fullName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-xs font-semibold truncate">{s.fullName}</p>
                          <p className="text-white/40 text-[11px] truncate">{s.email}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${roleColors[s.roleKey] ?? 'bg-white/5 text-white/40 border-white/10'}`}>
                          {s.roleName}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Sec>

              <div className="space-y-4">
                <Sec title="Perfis de acesso">
                  {[
                    { key: 'admin', label: 'Administradora', color: 'bg-rose-500/15 text-rose-300 border-rose-500/20', desc: 'Acesso total — finanças, equipe, configurações' },
                    { key: 'frontdesk', label: 'Recepção', color: 'bg-sky-500/15 text-sky-300 border-sky-500/20', desc: 'Agenda, clientes, confirmações e transferências' },
                    { key: 'professional', label: 'Profissional', color: 'bg-amber-500/15 text-amber-300 border-amber-500/20', desc: 'Própria agenda e serviços realizados' },
                  ].map((role) => (
                    <div key={role.key} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 mt-0.5 ${role.color}`}>{role.label}</span>
                      <p className="text-white/40 text-xs">{role.desc}</p>
                    </div>
                  ))}
                </Sec>

                <Sec title="Configurações gerais" action={
                  <Button size="sm" onClick={saveOrgSettings} disabled={savingSettings}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Save size={12} className="mr-1" />{savingSettings ? 'Salvando…' : 'Salvar'}
                  </Button>
                }>
                  <div className="space-y-3">
                    <FieldRow label="Nome do estúdio">
                      <Input value={orgSettings.name} onChange={(e) => setOrgSettings((s) => ({ ...s, name: e.target.value }))}
                        className={inputClass} />
                    </FieldRow>
                    <FieldRow label="WhatsApp">
                      <Input value={orgSettings.whatsappPhone ?? ''} onChange={(e) => setOrgSettings((s) => ({ ...s, whatsappPhone: e.target.value || null }))}
                        className={inputClass} placeholder="5531999999999" />
                    </FieldRow>
                  </div>
                </Sec>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Módulos / Footer nav ──────────────────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/20 font-medium mb-4">Módulos do sistema</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
            {TABS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => goToTab(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group
                  ${activeTab === value
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:bg-white/[0.07] hover:text-white/60 hover:border-white/10'
                  }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="text-[11px] font-medium leading-tight">{label}</span>
                {activeTab === value && (
                  <span className="w-1 h-1 rounded-full bg-rose-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
