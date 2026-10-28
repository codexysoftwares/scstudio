'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  LayoutDashboard, Globe, CalendarDays,
  DollarSign, Users, Scissors, Shield,
  CheckCircle, XCircle, RefreshCw,
  Plus, Trash2, ChevronLeft, ChevronRight, Pencil, Save,
  Star, Package,
  ArrowUpRight, BookOpen, PhoneCall, UserPlus, X, ChevronDown, ChevronUp,
  UserMinus, ArrowRightLeft, Bot, MessageSquare, Send, UserRound,
  Copy, Share2, Link2, TrendingUp, BarChart3, Wallet, PiggyBank, CalendarCheck,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LANDING_THEME_PRESETS, buildCustomThemeStyles, buildCustomThemePreview } from '@/lib/landing-palettes'
import type {
  ManagementDashboardData,
  DashboardMetric,
  DashboardFinance,
  DashboardBiAnalytics,
  DashboardProfessional,
  DashboardBooking,
  DashboardBlock,
  DashboardOrgSettings,
  DashboardLandingSettings,
  DashboardBusinessHour,
  DashboardService,
  DashboardTestimonial,
  DashboardTeamMember,
  DashboardStaff,
  DashboardWhatsappSettings,
  DashboardAgentBehaviorSettings,
  DashboardWhatsappConversationDetail,
  DashboardWhatsappConversationSummary,
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
  pending_payment: 'Ag. Pagamento',
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
    'Ag. Pagamento': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
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

function formatConversationMoment(value: string | null) {
  if (!value) return 'Sem atividade'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem atividade'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatBookingConfirmationLabel(booking: DashboardBooking) {
  if (booking.customerConfirmationStatus === 'confirmed') {
    return 'Cliente confirmou presenca'
  }

  if (booking.customerConfirmationStatus === 'declined') {
    return 'Cliente pediu ajuda da equipe'
  }

  if (booking.customerConfirmationStatus === 'pending') {
    return 'Aguardando resposta da cliente'
  }

  if (booking.confirmationRequestSentAt) {
    return 'Lembrete de 12h enviado'
  }

  return 'Lembrete de 12h ainda nao enviado'
}

function BookingConfirmationBadge({ booking }: { booking: DashboardBooking }) {
  const styles =
    booking.customerConfirmationStatus === 'confirmed'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
      : booking.customerConfirmationStatus === 'declined'
        ? 'bg-rose-500/15 text-rose-300 border-rose-500/20'
        : booking.customerConfirmationStatus === 'pending'
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
          : booking.confirmationRequestSentAt
            ? 'bg-sky-500/15 text-sky-300 border-sky-500/20'
            : 'bg-white/5 text-white/55 border-white/10'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      {formatBookingConfirmationLabel(booking)}
    </span>
  )
}

// ─── Tabs config ───────────────────────────────────────────────────────────────

const TABS = [
  { value: 'visao-geral',  icon: LayoutDashboard, label: 'Visão geral' },
  { value: 'agenda',       icon: CalendarDays,     label: 'Agenda' },
  { value: 'whatsapp',     icon: PhoneCall,        label: 'WhatsApp' },
  { value: 'landing-page', icon: Globe,            label: 'Landing page' },
  { value: 'financeiro',   icon: DollarSign,       label: 'Financeiro' },
  { value: 'profissionais',icon: Users,            label: 'Profissionais' },
  { value: 'servicos',     icon: Scissors,         label: 'Serviços' },
  { value: 'acessos',      icon: Shield,           label: 'Acessos' },
]

const BI_VIEWS = [
  { key: 'resumo',     label: 'Resumo do dia', icon: LayoutDashboard },
  { key: 'financeiro', label: 'Financeiro',    icon: DollarSign },
  { key: 'desempenho', label: 'Desempenho',    icon: BarChart3 },
] as const

// ─── Professional color palette ────────────────────────────────────────────────
const PROF_PALETTE = [
  { bg: 'bg-rose-500/20 border-rose-500/40',    text: 'text-rose-200',    dot: 'bg-rose-400',    header: 'text-rose-300'    },
  { bg: 'bg-violet-500/20 border-violet-500/40', text: 'text-violet-200', dot: 'bg-violet-400',  header: 'text-violet-300'  },
  { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-200', dot: 'bg-emerald-400', header: 'text-emerald-300' },
  { bg: 'bg-amber-500/20 border-amber-500/40',  text: 'text-amber-200',   dot: 'bg-amber-400',   header: 'text-amber-300'   },
  { bg: 'bg-sky-500/20 border-sky-500/40',      text: 'text-sky-200',     dot: 'bg-sky-400',     header: 'text-sky-300'     },
  { bg: 'bg-pink-500/20 border-pink-500/40',    text: 'text-pink-200',    dot: 'bg-pink-400',    header: 'text-pink-300'    },
]

const TIMELINE_HOUR_START = 7
const TIMELINE_HOUR_END = 22
const SLOT_H = 40

// ─── UI helpers ───────────────────────────────────────────────────────────────

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
      <CardHeader className="border-b border-white/10 px-5 py-3 pb-3">
        <CardTitle className="text-sm font-semibold text-white/80 self-center">{title}</CardTitle>
        {action && <CardAction>{action}</CardAction>}
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

// ─── Link de agendamento por profissional ───────────────────────────────────────

const BOOKING_BASE_URL = 'https://scstudioeesmalteria.com.br/agenda'

function agendaLinkFor(id: string) {
  return `${BOOKING_BASE_URL}/${id}`
}

async function copyAgendaLink(id: string) {
  const link = agendaLinkFor(id)
  try {
    await navigator.clipboard.writeText(link)
    toast.success('Link copiado!')
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = link
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      toast.success('Link copiado!')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }
}

function shareAgendaWhatsApp(id: string, name: string) {
  const link = agendaLinkFor(id)
  const firstName = name.trim().split(/\s+/)[0] ?? ''
  const text = `Agende seu horário com ${firstName} 💅\n${link}`
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    navigator
      .share({ title: 'Agendamento SC Studio', text, url: link })
      .catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      })
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }
}

// ─── BI / Dashboard panels ───────────────────────────────────────────────────

const CHART_COLORS = ['#fb7185', '#a78bfa', '#34d399', '#fbbf24', '#38bdf8', '#f472b6']

type ChartTooltipEntry = { value?: number | string; name?: string; dataKey?: string; color?: string }

function ChartTooltip({
  active,
  payload,
  label,
  currency,
  unit,
}: {
  active?: boolean
  payload?: ChartTooltipEntry[]
  label?: string | number
  currency?: boolean
  unit?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-xs shadow-xl">
      {label !== undefined && <p className="text-white/50 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-white font-semibold">
          {currency ? toCurrency(Number(p.value)) : `${p.value}${unit ? ` ${unit}` : ''}`}
        </p>
      ))}
    </div>
  )
}

function BiKpi({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'text-white',
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  accent?: string
}) {
  return (
    <Card className="bg-white/5 border-white/10 rounded-xl p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-white/45 uppercase tracking-widest font-medium leading-tight">{label}</p>
        {Icon && <Icon size={15} className="text-white/25 shrink-0" />}
      </div>
      <p className={`text-2xl font-bold leading-none ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
    </Card>
  )
}

function HBar({ label, value, max, suffix, color }: { label: string; value: number; max: number; suffix?: string; color: string }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/60 w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-white/70 font-medium w-16 text-right shrink-0">{suffix === 'R$' ? toCurrency(value) : `${value}${suffix ?? ''}`}</span>
    </div>
  )
}

function FinanceiroPanel({
  finance,
  professionals,
  bi,
}: {
  finance: DashboardFinance
  professionals: DashboardProfessional[]
  bi: DashboardBiAnalytics
}) {
  const topProfs = [...professionals].sort((a, b) => b.revenue - a.revenue).slice(0, 6)
  const maxProfRevenue = topProfs.reduce((m, p) => Math.max(m, p.revenue), 0)
  const maxSvcRevenue = bi.topServices.reduce((m, s) => Math.max(m, s.revenue), 0)
  const hasRevenueByDay = bi.revenueByDay.some((d) => d.revenue > 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BiKpi label="Faturamento do mês" value={toCurrency(bi.totals.monthRevenue)} sub={`${bi.totals.monthBookings} atendimentos`} icon={Wallet} accent="text-white" />
        <BiKpi label="Ticket médio" value={toCurrency(finance.averageTicket)} sub="Por atendimento" icon={TrendingUp} accent="text-white" />
        <BiKpi label="Receita confirmada" value={toCurrency(finance.confirmedRevenue)} sub="Confirmados + concluídos" icon={CheckCircle} accent="text-emerald-400" />
        <BiKpi label="Sinais pendentes" value={toCurrency(bi.totals.depositPendingRevenue)} sub={`${bi.totals.depositPending} aguardando pagamento`} icon={PiggyBank} accent="text-amber-400" />
      </div>

      <Sec title="Receita dos últimos 14 dias">
        {hasRevenueByDay ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bi.revenueByDay} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <RTooltip content={<ChartTooltip currency />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#fb7185" strokeWidth={2} fill="url(#revGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-white/30 text-xs text-center py-10">Sem receita registrada nos últimos 14 dias.</p>
        )}
      </Sec>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Sec title="Receita por profissional">
          <div className="space-y-3">
            {topProfs.length === 0 && <p className="text-white/30 text-xs text-center py-6">Sem dados de profissionais.</p>}
            {topProfs.map((p, i) => (
              <HBar key={p.id} label={p.name} value={p.revenue} max={maxProfRevenue} suffix="R$" color={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </div>
        </Sec>

        <Sec title="Serviços que mais faturam">
          <div className="space-y-3">
            {bi.topServices.length === 0 && <p className="text-white/30 text-xs text-center py-6">Sem serviços registrados.</p>}
            {bi.topServices.map((s, i) => (
              <HBar key={s.name} label={s.name} value={s.revenue} max={maxSvcRevenue} suffix="R$" color={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </div>
        </Sec>
      </div>
    </div>
  )
}

function DesempenhoPanel({
  professionals,
  bi,
}: {
  professionals: DashboardProfessional[]
  bi: DashboardBiAnalytics
}) {
  const attendanceRate = bi.totals.totalBookings > 0 ? Math.round((bi.totals.completed / bi.totals.totalBookings) * 100) : 0
  const avgOccupancy = professionals.length > 0 ? Math.round(professionals.reduce((t, p) => t + p.occupancy, 0) / professionals.length) : 0
  const profChart = [...professionals].sort((a, b) => b.bookings - a.bookings).slice(0, 8).map((p) => ({ name: p.name.split(' ')[0], bookings: p.bookings }))
  const hasProfBookings = profChart.some((p) => p.bookings > 0)
  const maxStatus = bi.bookingsByStatus.reduce((m, s) => Math.max(m, s.count), 0)
  const maxSvcCount = bi.topServices.reduce((m, s) => Math.max(m, s.count), 0)
  const statusColor: Record<string, string> = {
    confirmed: '#34d399',
    completed: '#10b981',
    pending: '#fbbf24',
    pending_payment: '#f59e0b',
    cancelled: '#fb7185',
    rescheduled: '#38bdf8',
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BiKpi label="Agendamentos" value={String(bi.totals.totalBookings)} sub="Total no histórico" icon={CalendarCheck} accent="text-white" />
        <BiKpi label="Comparecimento" value={`${attendanceRate}%`} sub={`${bi.totals.completed} concluídos`} icon={CheckCircle} accent="text-emerald-400" />
        <BiKpi label="Cancelamentos" value={String(bi.totals.cancelled)} sub="Agendamentos cancelados" icon={XCircle} accent="text-rose-400" />
        <BiKpi label="Clientes" value={String(bi.totals.customers)} sub="Clientes atendidos" icon={Users} accent="text-white" />
      </div>

      <Sec title="Agendamentos por profissional">
        {hasProfBookings ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                <RTooltip content={<ChartTooltip unit="atend." />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="bookings" radius={[6, 6, 0, 0]}>
                  {profChart.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-white/30 text-xs text-center py-10">Sem agendamentos para exibir.</p>
        )}
      </Sec>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Sec title="Agendamentos por status">
          <div className="space-y-3">
            {bi.bookingsByStatus.length === 0 && <p className="text-white/30 text-xs text-center py-6">Sem agendamentos.</p>}
            {bi.bookingsByStatus.map((s) => (
              <HBar key={s.status} label={s.label} value={s.count} max={maxStatus} color={statusColor[s.status] ?? '#a1a1aa'} />
            ))}
          </div>
        </Sec>

        <Sec title="Serviços mais procurados">
          <div className="space-y-3">
            {bi.topServices.length === 0 && <p className="text-white/30 text-xs text-center py-6">Sem serviços registrados.</p>}
            {bi.topServices.map((s, i) => (
              <HBar key={s.name} label={s.name} value={s.count} max={maxSvcCount} color={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
            {professionals.length > 0 && (
              <div className="pt-2 mt-1 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/50">Ocupação média da equipe</span>
                <span className="text-sm font-semibold text-rose-300">{avgOccupancy}%</span>
              </div>
            )}
          </div>
        </Sec>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManagementDashboard({
  data,
  sessionProfessionalId,
  sessionRoleKey,
  sessionRoleName,
}: {
  data: ManagementDashboardData
  sessionProfessionalId?: string | null
  sessionRoleKey?: string
  sessionRoleName?: string
}) {
  const router = useRouter()
  const agendaOnly = sessionRoleKey === 'professional'
  const [activeTab, setActiveTab] = useState(agendaOnly ? 'agenda' : 'visao-geral')
  const [biView, setBiView] = useState<'resumo' | 'financeiro' | 'desempenho'>('resumo')

  // Mutable state from server data
  const [selectedDate, setSelectedDate] = useState(data.overview.selectedDate)
  const [overviewMetrics, setOverviewMetrics] = useState<DashboardMetric[]>(data.overview.metrics)
  const [bookings, setBookings] = useState<DashboardBooking[]>(data.overview.bookings)
  const [overviewProfessionals, setOverviewProfessionals] = useState<DashboardProfessional[]>(data.overview.professionals)
  const [overviewFinance, setOverviewFinance] = useState<DashboardFinance>(data.overview.finance)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [blocks, setBlocks] = useState<DashboardBlock[]>(data.blocks)
  const [orgSettings, setOrgSettings] = useState<DashboardOrgSettings>(data.orgSettings)
  const [whatsappSettings, setWhatsappSettings] = useState<DashboardWhatsappSettings>(data.whatsappSettings)
  const [agentBehaviorSettings, setAgentBehaviorSettings] = useState<DashboardAgentBehaviorSettings>(data.agentBehaviorSettings)
  const [landingSettings, setLandingSettings] = useState<DashboardLandingSettings>(data.landingSettings)
  const [businessHours, setBusinessHours] = useState<DashboardBusinessHour[]>(data.businessHours)
  const [services, setServices] = useState<DashboardService[]>(data.services)
  const [professionals, setProfessionals] = useState<DashboardProfessional[]>(data.professionals)

  // Landing page editor
  const [activeLandingSection, setActiveLandingSection] = useState<'hero' | 'sobre' | 'depoimentos' | 'contato' | 'time' | 'paleta' | 'config'>('hero')
  const [testimonials, setTestimonials] = useState<DashboardTestimonial[]>(data.testimonials)
  const [testimonialForm, setTestimonialForm] = useState({ authorName: '', body: '', serviceName: '' })
  const [creatingTestimonial, setCreatingTestimonial] = useState(false)
  const [teamMembers, setTeamMembers] = useState<DashboardTeamMember[]>(data.teamMembers)
  const [teamMemberForm, setTeamMemberForm] = useState({ name: '', role: '', photoUrl: '' })
  const [editingTeamMemberId, setEditingTeamMemberId] = useState<string | null>(null)
  const [creatingTeamMember, setCreatingTeamMember] = useState(false)
  const [uploadingTeamPhoto, setUploadingTeamPhoto] = useState(false)
  const teamPhotoInputRef = useRef<HTMLInputElement>(null)



  // Saving states
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingLanding, setSavingLanding] = useState(false)
  const [savingBusinessHours, setSavingBusinessHours] = useState(false)
  const [creatingBlock, setCreatingBlock] = useState(false)
  const [creatingService, setCreatingService] = useState(false)
  const [savingWhatsappSettings, setSavingWhatsappSettings] = useState(false)
  const [connectingWhatsapp, setConnectingWhatsapp] = useState(false)
  const [testingWhatsapp, setTestingWhatsapp] = useState(false)
  const [loadingWhatsappStatus, setLoadingWhatsappStatus] = useState(false)
  const [whatsappStatusText, setWhatsappStatusText] = useState<string>('Não verificado')
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [qrCodePairingCode, setQrCodePairingCode] = useState<string | null>(null)
  const [loadingQrCode, setLoadingQrCode] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
  const qrCodeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [whatsappInboxConversations, setWhatsappInboxConversations] = useState<DashboardWhatsappConversationSummary[]>(data.whatsappInboxConversations)
  const [selectedWhatsappConversationId, setSelectedWhatsappConversationId] = useState<string | null>(data.whatsappInboxConversations[0]?.id ?? null)
  const [selectedWhatsappConversation, setSelectedWhatsappConversation] = useState<DashboardWhatsappConversationDetail | null>(null)
  const [loadingWhatsappInbox, setLoadingWhatsappInbox] = useState(false)
  const [loadingWhatsappConversation, setLoadingWhatsappConversation] = useState(false)
  const [sendingWhatsappInboxMessage, setSendingWhatsappInboxMessage] = useState(false)
  const [togglingWhatsappHandoff, setTogglingWhatsappHandoff] = useState(false)
  const [whatsappReplyDraft, setWhatsappReplyDraft] = useState('')

  // Hero image upload
  const [uploadingImage, setUploadingImage] = useState(false)
  const heroImageInputRef = useRef<HTMLInputElement>(null)

  // Pending payments (PIX awaiting manual confirmation)
  const [pendingPayments, setPendingPayments] = useState<Array<{
    id: string; customer_name: string; customer_phone: string
    service_name: string; booking_date: string; booking_time: string; price_snapshot: string
  }>>([])
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null)

  // About image upload
  const [uploadingAboutImage, setUploadingAboutImage] = useState(false)
  const aboutImageInputRef = useRef<HTMLInputElement>(null)

  // Service image upload
  const [uploadingServicePhoto, setUploadingServicePhoto] = useState(false)
  const servicePhotoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingProfPhoto, setUploadingProfPhoto] = useState(false)
  const newProfPhotoInputRef = useRef<HTMLInputElement>(null)
  const editProfPhotoInputRef = useRef<HTMLInputElement>(null)

  // Block form
  const [blockForm, setBlockForm] = useState({ professional: '', startsAt: '', endsAt: '', reason: '' })

  // Service create form
  const [serviceForm, setServiceForm] = useState({
    name: '',
    category: 'unhas',
    photoUrl: '',
    durationMin: '',
    priceCents: '',
    professionalIds: [] as string[],
  })
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)

  // Agenda: side panel + manual booking
  const [agendaSide, setAgendaSide] = useState<null | 'booking' | 'block' | 'detail' | 'absent'>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [creatingManualBooking, setCreatingManualBooking] = useState(false)
  const [newBookingForm, setNewBookingForm] = useState({ clientName: '', clientPhone: '', serviceId: '', professionalId: '', date: '', time: '', notes: '' })

  // Agenda: booking detail + reassign
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [updatingBooking, setUpdatingBooking] = useState(false)
  const [reassignProfId, setReassignProfId] = useState('')

  // Agenda: absence registration
  const [absentForm, setAbsentForm] = useState({ professionalId: '', date: '', createBlock: true, transfer: true, targetProfId: '' })
  const [creatingAbsent, setCreatingAbsent] = useState(false)

  // Agenda: timeline scroll
  const timelineScrollRef = useRef<HTMLDivElement>(null)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  // Professionals: CRUD state
  const [allProfessionals, setAllProfessionals] = useState(data.professionals)
  const [editingProfId, setEditingProfId] = useState<string | null>(null)
  const [editProfForm, setEditProfForm] = useState({ displayName: '', specialty: '', photoUrl: '', commissionPercent: '' })
  const [savingProf, setSavingProf] = useState(false)
  const [newProfForm, setNewProfForm] = useState({ displayName: '', specialty: '', photoUrl: '', commissionPercent: '40', acceptsOnlineBooking: true })
  const [creatingProf, setCreatingProf] = useState(false)
  const [deletingProfId, setDeletingProfId] = useState<string | null>(null)

  // Acessos: staff CRUD state
  const [staffList, setStaffList] = useState<DashboardStaff[]>(data.staff)
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [staffForm, setStaffForm] = useState({ fullName: '', email: '', password: '', roleKey: 'frontdesk', professionalId: '' })
  const [savingStaff, setSavingStaff] = useState(false)
  const [creatingStaff, setCreatingStaff] = useState(false)
  const [staffCreateForm, setStaffCreateForm] = useState({ fullName: '', email: '', password: '', roleKey: 'frontdesk', professionalId: '' })

  const visibleTabs = agendaOnly ? TABS.filter((tab) => tab.value === 'agenda') : TABS

  // ── Handlers ────────────────────────────────────────────────────────────────

  const goToTab = useCallback((value: string) => {
    setActiveTab(value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (agendaOnly && activeTab !== 'agenda') {
      setActiveTab('agenda')
    }
  }, [activeTab, agendaOnly])

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
    setAllProfessionals(data.professionals)
    setTeamMembers(data.teamMembers)
    setWhatsappSettings(data.whatsappSettings)
    setAgentBehaviorSettings(data.agentBehaviorSettings)
    setWhatsappInboxConversations(data.whatsappInboxConversations)
    setSelectedWhatsappConversationId((current) => current && data.whatsappInboxConversations.some((item) => item.id === current)
      ? current
      : data.whatsappInboxConversations[0]?.id ?? null)
  }, [data])

  // Scroll timeline to current time whenever the agenda tab becomes active
  useEffect(() => {
    if (activeTab !== 'agenda') return
    const el = timelineScrollRef.current
    if (!el) return
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes()
    const scrollTarget = Math.max(0, ((h - TIMELINE_HOUR_START) * 60 + m) / 30 * SLOT_H - 120)
    el.scrollTo({ top: scrollTarget, behavior: 'smooth' })
  }, [activeTab])

  const loadPendingPayments = useCallback(async () => {
    try {
      const res = await fetch('/api/management/pending-payments', { cache: 'no-store' })
      if (!res.ok) return
      const d = await res.json()
      setPendingPayments(d.payments ?? [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (activeTab !== 'agenda') return
    void loadPendingPayments()
  }, [activeTab, loadPendingPayments])

  // Auto-refresh agenda a cada 30s quando aba agenda está ativa
  useEffect(() => {
    if (activeTab !== 'agenda') return
    const interval = setInterval(() => {
      void loadOverview(selectedDate, { silent: true, showError: false })
      void loadPendingPayments()
    }, 30000)
    return () => clearInterval(interval)
  }, [activeTab, selectedDate, loadOverview, loadPendingPayments])

  const confirmPayment = useCallback(async (bookingId: string) => {
    setConfirmingPaymentId(bookingId)
    try {
      const res = await fetch('/api/management/bookings/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      if (!res.ok) throw new Error()
      setPendingPayments((ps) => ps.filter((p) => p.id !== bookingId))
      await loadOverview(selectedDate, { silent: true, showError: false })
      toast.success('Pagamento confirmado! Cliente notificado via WhatsApp.')
    } catch {
      toast.error('Erro ao confirmar pagamento')
    } finally {
      setConfirmingPaymentId(null)
    }
  }, [loadOverview, selectedDate])

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
        body: JSON.stringify({
          org: {
            name: orgSettings.name,
            whatsappPhone: orgSettings.whatsappPhone,
            whatsappDisplay: orgSettings.whatsappDisplay,
            bookingSlotMinutes: orgSettings.bookingSlotMinutes,
            allowProfessionalSelection: orgSettings.allowProfessionalSelection,
            requireDeposit: orgSettings.requireDeposit,
            confirmationChannel: orgSettings.confirmationChannel,
            showWhatsappButton: orgSettings.showWhatsappButton,
            autoConfirmWhatsapp: orgSettings.autoConfirmWhatsapp,
            smartWaitlist: orgSettings.smartWaitlist,
            assistedTransfer: orgSettings.assistedTransfer,
            dailyClosure: orgSettings.dailyClosure,
            instagramHandle: orgSettings.instagramHandle,
            addressText: orgSettings.addressText,
            mapsEmbedUrl: orgSettings.mapsEmbedUrl,
          }
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configurações salvas')
    } catch {
      toast.error('Erro ao salvar configurações')
    } finally {
      setSavingSettings(false)
    }
  }, [orgSettings])

  async function saveWhatsappSettings() {
    setSavingWhatsappSettings(true)
    try {
      const res = await fetch('/api/management/whatsapp-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...whatsappSettings,
          ...agentBehaviorSettings,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configurações do WhatsApp salvas')
    } catch {
      toast.error('Erro ao salvar configurações do WhatsApp')
    } finally {
      setSavingWhatsappSettings(false)
    }
  }

  async function refreshWhatsappStatus() {
    setLoadingWhatsappStatus(true)
    try {
      const res = await fetch('/api/management/whatsapp-status', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao consultar status')

      setWhatsappSettings((current) => ({
        ...current,
        evolutionConnected: Boolean(data.connected),
      }))
      setWhatsappStatusText(data.connected ? 'Conectado' : data.error ? `Erro: ${data.error}` : 'Desconectado')
    } catch {
      setWhatsappStatusText('Falha ao consultar status')
      toast.error('Erro ao consultar status do WhatsApp')
    } finally {
      setLoadingWhatsappStatus(false)
    }
  }

  async function connectWhatsapp() {
    setConnectingWhatsapp(true)
    try {
      const res = await fetch('/api/management/whatsapp-connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao conectar')
      toast.success('Instância Evolution criada/vinculada')
      await refreshWhatsappStatus()
    } catch {
      toast.error('Erro ao criar ou vincular instância Evolution')
    } finally {
      setConnectingWhatsapp(false)
    }
  }

  function stopQrCodePolling() {
    if (qrCodeIntervalRef.current) {
      clearInterval(qrCodeIntervalRef.current)
      qrCodeIntervalRef.current = null
    }
  }

  async function fetchQrCode() {
    setLoadingQrCode(true)
    try {
      const res = await fetch('/api/management/whatsapp-qrcode', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setQrCodeData(null)
        toast.error(data.error || 'Erro ao obter QR code')
        stopQrCodePolling()
        return
      }
      setQrCodeData(data.base64 ?? null)
      setQrCodePairingCode(data.pairingCode ?? null)
    } catch {
      toast.error('Erro ao obter QR code')
      stopQrCodePolling()
    } finally {
      setLoadingQrCode(false)
    }
  }

  async function openQrCode() {
    setShowQrCode(true)
    setQrCodeData(null)
    stopQrCodePolling()
    await fetchQrCode()
    // Poll every 20s; stop when connected or component hides
    qrCodeIntervalRef.current = setInterval(async () => {
      // Check if connected first
      const statusRes = await fetch('/api/management/whatsapp-status', { cache: 'no-store' })
      const statusData = await statusRes.json()
      if (statusData.connected) {
        stopQrCodePolling()
        setShowQrCode(false)
        setQrCodeData(null)
        setWhatsappSettings((s) => ({ ...s, evolutionConnected: true }))
        setWhatsappStatusText('Conectado')
        toast.success('WhatsApp conectado com sucesso!')
        return
      }
      await fetchQrCode()
    }, 20000)
  }

  function closeQrCode() {
    stopQrCodePolling()
    setShowQrCode(false)
    setQrCodeData(null)
  }

  async function sendWhatsappTestMessage() {
    setTestingWhatsapp(true)
    try {
      const res = await fetch('/api/management/whatsapp-test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappSettings.testPhone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao testar envio')
      toast.success('Mensagem de teste enviada')
    } catch {
      toast.error('Erro ao enviar mensagem de teste')
    } finally {
      setTestingWhatsapp(false)
    }
  }

  const loadWhatsappInbox = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingWhatsappInbox(true)
    try {
      const res = await fetch('/api/management/whatsapp-conversations', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const payload = await res.json() as { conversations?: DashboardWhatsappConversationSummary[] }
      const next = payload.conversations ?? []
      setWhatsappInboxConversations(next)
      setSelectedWhatsappConversationId((current) => current && next.some((item) => item.id === current)
        ? current
        : next[0]?.id ?? null)
    } catch {
      if (!options?.silent) toast.error('Erro ao carregar inbox do WhatsApp')
    } finally {
      if (!options?.silent) setLoadingWhatsappInbox(false)
    }
  }, [])

  const loadWhatsappConversation = useCallback(async (conversationId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingWhatsappConversation(true)
    try {
      const res = await fetch(`/api/management/whatsapp-conversations/${conversationId}`, { cache: 'no-store' })
      const payload = await res.json() as { conversation?: DashboardWhatsappConversationDetail; error?: string }
      if (!res.ok || !payload.conversation) throw new Error(payload.error || 'Falha ao carregar conversa')
      setSelectedWhatsappConversation(payload.conversation)
    } catch {
      if (!options?.silent) toast.error('Erro ao carregar conversa')
    } finally {
      if (!options?.silent) setLoadingWhatsappConversation(false)
    }
  }, [])

  const updateWhatsappConversationHandoff = useCallback(async (handoffState: 'agent' | 'queued' | 'human') => {
    if (!selectedWhatsappConversationId) return
    setTogglingWhatsappHandoff(true)
    try {
      const res = await fetch(`/api/management/whatsapp-conversations/${selectedWhatsappConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoffState }),
      })
      const payload = await res.json() as { conversation?: DashboardWhatsappConversationDetail; error?: string }
      if (!res.ok || !payload.conversation) throw new Error(payload.error || 'Falha ao atualizar conversa')
      setSelectedWhatsappConversation(payload.conversation)
      setWhatsappInboxConversations((items) => items.map((item) => item.id === payload.conversation?.id ? {
        ...item,
        handoffState: payload.conversation.handoffState,
        status: payload.conversation.status,
        lastMessageAt: payload.conversation.lastMessageAt,
        lastMessagePreview: payload.conversation.lastMessagePreview,
        lastMessageDirection: payload.conversation.lastMessageDirection,
      } : item))
      toast.success(handoffState === 'human' ? 'Conversa assumida pela equipe' : 'Bot reativado para esta conversa')
    } catch {
      toast.error('Erro ao atualizar controle da conversa')
    } finally {
      setTogglingWhatsappHandoff(false)
    }
  }, [selectedWhatsappConversationId])

  useEffect(() => {
    if (activeTab !== 'whatsapp') return
    void refreshWhatsappStatus()
    void loadWhatsappInbox()
  }, [activeTab, loadWhatsappInbox])

  useEffect(() => {
    if (activeTab !== 'whatsapp') return
    if (!selectedWhatsappConversationId) {
      setSelectedWhatsappConversation(null)
      return
    }
    setWhatsappReplyDraft('')
    setSelectedWhatsappConversation((current) => current?.id === selectedWhatsappConversationId ? current : null)
    void loadWhatsappConversation(selectedWhatsappConversationId)
  }, [activeTab, selectedWhatsappConversationId, loadWhatsappConversation])

  useEffect(() => {
    if (activeTab !== 'whatsapp') return
    const interval = setInterval(() => {
      void loadWhatsappInbox({ silent: true })
      if (selectedWhatsappConversationId) {
        void loadWhatsappConversation(selectedWhatsappConversationId, { silent: true })
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [activeTab, loadWhatsappConversation, loadWhatsappInbox, selectedWhatsappConversationId])

  const sendWhatsappInboxMessage = useCallback(async () => {
    if (!selectedWhatsappConversationId || !whatsappReplyDraft.trim()) return
    setSendingWhatsappInboxMessage(true)
    try {
      const res = await fetch(`/api/management/whatsapp-conversations/${selectedWhatsappConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: whatsappReplyDraft.trim() }),
      })
      const payload = await res.json() as { conversation?: DashboardWhatsappConversationDetail; error?: string }
      if (!res.ok || !payload.conversation) throw new Error(payload.error || 'Falha ao enviar mensagem')
      setSelectedWhatsappConversation(payload.conversation)
      setWhatsappInboxConversations((items) => items.map((item) => item.id === payload.conversation?.id ? {
        ...item,
        handoffState: payload.conversation.handoffState,
        lastMessageAt: payload.conversation.lastMessageAt,
        lastMessagePreview: payload.conversation.lastMessagePreview,
        lastMessageDirection: payload.conversation.lastMessageDirection,
      } : item))
      setWhatsappReplyDraft('')
      toast.success('Mensagem enviada')
    } catch {
      toast.error('Erro ao enviar mensagem manual')
    } finally {
      setSendingWhatsappInboxMessage(false)
    }
  }, [selectedWhatsappConversationId, whatsappReplyDraft])

  // saveLandingSection handles all landing saves — no separate saveLandingSettings needed

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
      const profName = blockForm.professional
        ? (allProfessionals.find((p) => p.id === blockForm.professional)?.name ?? 'Todas')
        : 'Todas'
      const newBlock: DashboardBlock = {
        id: `blk-${Date.now()}`,
        professional: profName,
        professionalId: blockForm.professional || null,
        period: `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(blockForm.startsAt))} — ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(blockForm.endsAt))}`,
        startsAt: new Date(blockForm.startsAt).toISOString(),
        endsAt: new Date(blockForm.endsAt).toISOString(),
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
  }, [allProfessionals, blockForm])

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

  const createManualBooking = useCallback(async () => {
    if (!newBookingForm.clientName.trim() || !newBookingForm.clientPhone.trim() || !newBookingForm.serviceId || !newBookingForm.date || !newBookingForm.time) {
      toast.error('Preencha nome, telefone, serviço, data e hora')
      return
    }
    setCreatingManualBooking(true)
    try {
      const res = await fetch('/api/management/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: newBookingForm.clientName.trim(),
          clientPhone: newBookingForm.clientPhone.trim(),
          serviceId: newBookingForm.serviceId,
          professionalId: newBookingForm.professionalId || null,
          date: newBookingForm.date,
          time: newBookingForm.time,
          notes: newBookingForm.notes.trim() || undefined,
        }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Erro') }
      toast.success('Agendamento criado')
      setNewBookingForm((f) => ({ ...f, clientName: '', clientPhone: '', notes: '' }))
      setAgendaSide(null)
      await loadOverview(newBookingForm.date || selectedDate, { silent: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar agendamento')
    } finally {
      setCreatingManualBooking(false)
    }
  }, [newBookingForm, loadOverview, selectedDate])

  const reloadBlocks = useCallback(async () => {
    try {
      const r = await fetch('/api/management/blocks')
      if (r.ok) { const j = await r.json(); setBlocks(j.blocks ?? []) }
    } catch {}
  }, [])

  const updateBookingField = useCallback(async (id: string, fields: { status?: string; professionalId?: string | null }) => {
    setUpdatingBooking(true)
    try {
      const res = await fetch(`/api/management/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error()
      await loadOverview(selectedDate, { silent: true, showError: false })
      toast.success('Agendamento atualizado')
      setAgendaSide(null)
      setSelectedBookingId(null)
    } catch {
      toast.error('Erro ao atualizar agendamento')
    } finally {
      setUpdatingBooking(false)
    }
  }, [loadOverview, selectedDate])

  const handleAbsent = useCallback(async () => {
    if (!absentForm.professionalId) { toast.error('Selecione a profissional'); return }
    if (!absentForm.date) { toast.error('Selecione a data'); return }
    if (absentForm.transfer && !absentForm.targetProfId) { toast.error('Selecione para quem transferir'); return }
    setCreatingAbsent(true)
    try {
      if (absentForm.createBlock) {
        await fetch('/api/management/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            professionalId: absentForm.professionalId,
            startsAt: `${absentForm.date}T00:00`,
            endsAt: `${absentForm.date}T23:59`,
            reason: 'Ausência',
          }),
        })
        await reloadBlocks()
      }
      if (absentForm.transfer) {
        const toTransfer = bookings.filter((b) => b.professionalId === absentForm.professionalId)
        await Promise.all(toTransfer.map((b) =>
          fetch(`/api/management/bookings/${b.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ professionalId: absentForm.targetProfId }),
          })
        ))
      }
      await loadOverview(absentForm.date, { silent: true, showError: false })
      toast.success('Ausência registrada')
      setAgendaSide(null)
      setAbsentForm((f) => ({ ...f, professionalId: '', targetProfId: '' }))
    } catch {
      toast.error('Erro ao registrar ausência')
    } finally {
      setCreatingAbsent(false)
    }
  }, [absentForm, bookings, loadOverview, reloadBlocks])

  const createProfessional = useCallback(async () => {
    if (!newProfForm.displayName.trim()) { toast.error('Informe o nome'); return }
    setCreatingProf(true)
    try {
      const res = await fetch('/api/management/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: newProfForm.displayName.trim(),
          specialty: newProfForm.specialty.trim() || undefined,
          photoUrl: newProfForm.photoUrl || undefined,
          commissionPercent: parseFloat(newProfForm.commissionPercent) || 40,
          acceptsOnlineBooking: newProfForm.acceptsOnlineBooking,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')
      const newP = {
        id: json.id,
        name: newProfForm.displayName.trim(),
        photoUrl: newProfForm.photoUrl,
        role: 'Profissional',
        specialty: newProfForm.specialty.trim(),
        access: 'Equipe',
        occupancy: 0,
        initials: newProfForm.displayName.trim().split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
        bookings: 0,
        revenue: 0,
        commissionRate: parseFloat(newProfForm.commissionPercent) || 40,
        payout: 0,
        salonShare: 0,
      }
      setAllProfessionals((p) => [...p, newP])
      setNewProfForm({ displayName: '', specialty: '', photoUrl: '', commissionPercent: '40', acceptsOnlineBooking: true })
      toast.success('Profissional criada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar profissional')
    } finally {
      setCreatingProf(false)
    }
  }, [newProfForm])

  const startEditProf = useCallback((p: typeof allProfessionals[0]) => {
    setEditingProfId(p.id)
    setEditProfForm({ displayName: p.name, specialty: p.specialty, photoUrl: p.photoUrl || '', commissionPercent: String(p.commissionRate) })
  }, [])

  const saveEditProf = useCallback(async () => {
    if (!editingProfId) return
    setSavingProf(true)
    try {
      const res = await fetch('/api/management/professionals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingProfId,
          displayName: editProfForm.displayName.trim(),
          specialty: editProfForm.specialty.trim(),
          photoUrl: editProfForm.photoUrl || '',
          commissionPercent: parseFloat(editProfForm.commissionPercent) || 40,
        }),
      })
      if (!res.ok) throw new Error()
      setAllProfessionals((prev) => prev.map((p) =>
        p.id === editingProfId
          ? { ...p, name: editProfForm.displayName.trim(), specialty: editProfForm.specialty.trim(), photoUrl: editProfForm.photoUrl || '', commissionRate: parseFloat(editProfForm.commissionPercent) || 40 }
          : p
      ))
      setEditingProfId(null)
      toast.success('Profissional atualizada')
    } catch {
      toast.error('Erro ao salvar profissional')
    } finally {
      setSavingProf(false)
    }
  }, [editingProfId, editProfForm])

  const deleteProfessional = useCallback(async (id: string) => {
    const prev = allProfessionals
    setAllProfessionals((p) => p.filter((x) => x.id !== id))
    setDeletingProfId(id)
    try {
      const res = await fetch('/api/management/professionals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Profissional removida')
    } catch {
      setAllProfessionals(prev)
      toast.error('Erro ao remover profissional')
    } finally {
      setDeletingProfId(null)
    }
  }, [allProfessionals])

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

  const resetServiceForm = useCallback(() => {
    setEditingServiceId(null)
    setServiceForm({
      name: '',
      category: 'unhas',
      photoUrl: '',
      durationMin: '',
      priceCents: '',
      professionalIds: [],
    })
  }, [])

  const startEditService = useCallback((svc: DashboardService) => {
    setEditingServiceId(svc.id)
    setServiceForm({
      name: svc.name,
      category: svc.category,
      photoUrl: svc.photoUrl,
      durationMin: String(svc.durationMin),
      priceCents: String((svc.priceCents / 100).toFixed(2)).replace('.', ','),
      professionalIds: svc.professionalIds,
    })
  }, [])

  const uploadServicePhoto = useCallback(async (file: File) => {
    setUploadingServicePhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/management/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')
      setServiceForm((f) => ({ ...f, photoUrl: json.url }))
      toast.success('Foto enviada — salve o serviço abaixo')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar foto')
    } finally {
      setUploadingServicePhoto(false)
    }
  }, [])

  const saveService = useCallback(async () => {
    const dMin = parseInt(serviceForm.durationMin, 10)
    const pCents = Math.round(parseFloat(serviceForm.priceCents.replace(',', '.')) * 100)
    if (!serviceForm.name.trim() || isNaN(dMin) || isNaN(pCents)) {
      toast.error('Preencha nome, duração e preço')
      return
    }
    setCreatingService(true)
    try {
      const res = await fetch('/api/management/services', {
        method: editingServiceId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingServiceId ? {
          id: editingServiceId,
          name: serviceForm.name.trim(),
          category: serviceForm.category,
          photoUrl: serviceForm.photoUrl || undefined,
          durationMin: dMin,
          priceCents: pCents,
          professionalIds: serviceForm.professionalIds,
        } : {
          name: serviceForm.name.trim(),
          category: serviceForm.category,
          photoUrl: serviceForm.photoUrl || undefined,
          durationMin: dMin,
          priceCents: pCents,
          onlineEnabled: true,
          professionalIds: serviceForm.professionalIds,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')
      if (editingServiceId) {
        setServices((list) => list.map((svc) => (
          svc.id === editingServiceId
            ? {
                ...svc,
                name: serviceForm.name.trim(),
                category: serviceForm.category,
                photoUrl: serviceForm.photoUrl,
                durationMin: dMin,
                priceCents: pCents,
                professionalIds: serviceForm.professionalIds,
                professionals: allProfessionals
                  .filter((professional) => serviceForm.professionalIds.includes(professional.id))
                  .map((professional) => ({ id: professional.id, name: professional.name })),
                professional: allProfessionals
                  .filter((professional) => serviceForm.professionalIds.includes(professional.id))
                  .map((professional) => professional.name)
                  .join(', ') || '-',
              }
            : svc
        )))
        toast.success('Serviço atualizado')
      } else {
        const newSvc: DashboardService = {
          id: json.id ?? `svc-${Date.now()}`,
          name: serviceForm.name.trim(),
          category: serviceForm.category,
          photoUrl: serviceForm.photoUrl,
          durationMin: dMin,
          priceCents: pCents,
          professionalIds: serviceForm.professionalIds,
          professionals: allProfessionals
            .filter((professional) => serviceForm.professionalIds.includes(professional.id))
            .map((professional) => ({ id: professional.id, name: professional.name })),
          professional: allProfessionals
            .filter((professional) => serviceForm.professionalIds.includes(professional.id))
            .map((professional) => professional.name)
            .join(', ') || '-',
          onlineEnabled: true,
          isFeatured: false,
        }
        setServices((s) => [...s, newSvc])
        toast.success('Serviço criado — aparece na landing')
      }
      resetServiceForm()
    } catch {
      toast.error('Erro ao salvar serviço')
    } finally {
      setCreatingService(false)
    }
  }, [allProfessionals, editingServiceId, resetServiceForm, serviceForm])

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

  const createTestimonial = useCallback(async () => {
    if (!testimonialForm.authorName.trim() || !testimonialForm.body.trim()) {
      toast.error('Preencha nome e texto')
      return
    }
    setCreatingTestimonial(true)
    try {
      const res = await fetch('/api/management/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: testimonialForm.authorName.trim(),
          body: testimonialForm.body.trim(),
          serviceName: testimonialForm.serviceName.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error()
      const newItem: DashboardTestimonial = {
        id: json.id ?? `t-${Date.now()}`,
        authorName: testimonialForm.authorName.trim(),
        body: testimonialForm.body.trim(),
        serviceName: testimonialForm.serviceName.trim(),
        sortOrder: testimonials.length,
      }
      setTestimonials((t) => [...t, newItem])
      setTestimonialForm({ authorName: '', body: '', serviceName: '' })
      toast.success('Depoimento adicionado')
    } catch {
      toast.error('Erro ao adicionar depoimento')
    } finally {
      setCreatingTestimonial(false)
    }
  }, [testimonialForm, testimonials.length])

  const deleteTestimonial = useCallback(async (id: string) => {
    const prev = testimonials
    setTestimonials((t) => t.filter((x) => x.id !== id))
    try {
      const res = await fetch('/api/management/testimonials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Depoimento removido')
    } catch {
      setTestimonials(prev)
      toast.error('Erro ao remover depoimento')
    }
  }, [testimonials])

  const resetTeamMemberForm = useCallback(() => {
    setEditingTeamMemberId(null)
    setTeamMemberForm({ name: '', role: '', photoUrl: '' })
  }, [])

  const startEditTeamMember = useCallback((member: DashboardTeamMember) => {
    setEditingTeamMemberId(member.id)
    setTeamMemberForm({
      name: member.name,
      role: member.role,
      photoUrl: member.photoUrl,
    })
  }, [])

  const saveTeamMember = useCallback(async () => {
    if (!teamMemberForm.name.trim()) { toast.error('Informe o nome'); return }
    setCreatingTeamMember(true)
    try {
      const payload = {
        displayName: teamMemberForm.name.trim(),
        category: teamMemberForm.role.trim(),
        photoUrl: teamMemberForm.photoUrl || undefined,
      }
      const res = await fetch('/api/management/team', {
        method: editingTeamMemberId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTeamMemberId ? { id: editingTeamMemberId, ...payload } : payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')

      if (editingTeamMemberId) {
        setTeamMembers((members) => members.map((member) => (
          member.id === editingTeamMemberId
            ? {
                ...member,
                name: teamMemberForm.name.trim(),
                role: teamMemberForm.role.trim(),
                photoUrl: teamMemberForm.photoUrl,
              }
            : member
        )))
        toast.success('Membro atualizado')
      } else {
        const newMember: DashboardTeamMember = {
          id: json.id ?? `tm-${Date.now()}`,
          name: teamMemberForm.name.trim(),
          role: teamMemberForm.role.trim(),
          photoUrl: teamMemberForm.photoUrl,
          sortOrder: teamMembers.length,
        }
        setTeamMembers((members) => [...members, newMember])
        toast.success('Membro adicionado e publicado na landing')
      }

      resetTeamMemberForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar membro')
    } finally {
      setCreatingTeamMember(false)
    }
  }, [editingTeamMemberId, resetTeamMemberForm, teamMemberForm, teamMembers.length])

  const deleteTeamMember = useCallback(async (id: string) => {
    const prev = teamMembers
    setTeamMembers((t) => t.filter((x) => x.id !== id))
    try {
      const res = await fetch('/api/management/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      if (editingTeamMemberId === id) resetTeamMemberForm()
      toast.success('Membro removido')
    } catch {
      setTeamMembers(prev)
      toast.error('Erro ao remover membro')
    }
  }, [editingTeamMemberId, resetTeamMemberForm, teamMembers])

  const moveTeamMember = useCallback(async (id: string, direction: 'up' | 'down') => {
    const currentIndex = teamMembers.findIndex((member) => member.id === id)
    if (currentIndex === -1) return

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= teamMembers.length) return

    const reordered = [...teamMembers]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, moved)

    const normalized = reordered.map((member, index) => ({ ...member, sortOrder: index }))
    setTeamMembers(normalized)

    try {
      const responses = await Promise.all([
        fetch('/api/management/team', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: normalized[currentIndex].id, sortOrder: normalized[currentIndex].sortOrder }),
        }),
        fetch('/api/management/team', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: normalized[nextIndex].id, sortOrder: normalized[nextIndex].sortOrder }),
        }),
      ])
      if (responses.some((response) => !response.ok)) throw new Error()
    } catch {
      setTeamMembers(teamMembers)
      toast.error('Erro ao reordenar membros')
      return
    }

    toast.success('Ordem do time atualizada')
  }, [teamMembers])

  const uploadTeamPhoto = useCallback(async (file: File) => {
    setUploadingTeamPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/management/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')
      setTeamMemberForm((f) => ({ ...f, photoUrl: json.url }))
      toast.success('Foto enviada — salve o membro para publicar')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar foto')
    } finally {
      setUploadingTeamPhoto(false)
    }
  }, [])

  const uploadProfessionalPhoto = useCallback(async (file: File, target: 'new' | 'edit') => {
    setUploadingProfPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/management/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')

      if (target === 'new') {
        setNewProfForm((f) => ({ ...f, photoUrl: json.url }))
      } else {
        setEditProfForm((f) => ({ ...f, photoUrl: json.url }))
      }

      toast.success('Foto enviada — salve a profissional para publicar')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar foto')
    } finally {
      setUploadingProfPhoto(false)
    }
  }, [])

  const saveLandingSection = useCallback(async (section: 'lp' | 'org') => {
    setSavingLanding(true)
    try {
      const body = section === 'lp'
        ? { lp: landingSettings }
        : { org: { instagramHandle: orgSettings.instagramHandle, addressText: orgSettings.addressText, mapsEmbedUrl: orgSettings.mapsEmbedUrl, whatsappDisplay: orgSettings.whatsappDisplay, whatsappPhone: orgSettings.whatsappPhone } }
      const res = await fetch('/api/management/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Seção salva — landing atualizada')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSavingLanding(false)
    }
  }, [landingSettings, orgSettings])

  const uploadHeroImage = useCallback(async (file: File) => {
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/management/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')
      setLandingSettings((s) => ({ ...s, heroImageUrl: json.url }))
      toast.success('Imagem enviada — salve para publicar')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar imagem')
    } finally {
      setUploadingImage(false)
    }
  }, [])

  const uploadAboutImage = useCallback(async (file: File) => {
    setUploadingAboutImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/management/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')
      setLandingSettings((s) => ({ ...s, aboutImageUrl: json.url }))
      toast.success('Foto enviada — salve para publicar')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar foto')
    } finally {
      setUploadingAboutImage(false)
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

  const deleteServiceAndReset = useCallback(async (id: string) => {
    if (editingServiceId === id) resetServiceForm()
    await deleteService(id)
  }, [deleteService, editingServiceId, resetServiceForm])

  const createStaff = useCallback(async () => {
    if (!staffCreateForm.fullName || !staffCreateForm.email || !staffCreateForm.password) {
      toast.error('Preencha nome, e-mail e senha')
      return
    }
    setCreatingStaff(true)
    try {
      const res = await fetch('/api/management/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: staffCreateForm.fullName,
          email: staffCreateForm.email,
          password: staffCreateForm.password,
          roleKey: staffCreateForm.roleKey,
          professionalId: staffCreateForm.professionalId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')
      const r2 = await fetch('/api/management/staff')
      const list = await r2.json()
      setStaffList(list)
      setStaffCreateForm({ fullName: '', email: '', password: '', roleKey: 'frontdesk', professionalId: '' })
      toast.success('Usuário criado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário')
    } finally {
      setCreatingStaff(false)
    }
  }, [staffCreateForm])

  const startEditStaff = useCallback((s: DashboardStaff) => {
    setEditingStaffId(s.id)
    setStaffForm({ fullName: s.fullName, email: s.email, password: '', roleKey: s.roleKey || 'frontdesk', professionalId: s.professionalId ?? '' })
  }, [])

  const saveStaff = useCallback(async () => {
    if (!editingStaffId) return
    setSavingStaff(true)
    try {
      const payload: Record<string, unknown> = { id: editingStaffId, fullName: staffForm.fullName, email: staffForm.email, roleKey: staffForm.roleKey, professionalId: staffForm.professionalId || null }
      if (staffForm.password) payload.password = staffForm.password
      const res = await fetch('/api/management/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const r2 = await fetch('/api/management/staff')
      const list = await r2.json()
      setStaffList(list)
      setEditingStaffId(null)
      toast.success('Usuário atualizado')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSavingStaff(false)
    }
  }, [editingStaffId, staffForm])

  const deactivateStaff = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/management/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      setStaffList((prev) => prev.map((s) => s.id === id ? { ...s, isActive: false } : s))
      toast.success('Usuário desativado')
    } catch {
      toast.error('Erro ao desativar')
    }
  }, [])

  const reactivateStaff = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/management/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: true }),
      })
      if (!res.ok) throw new Error()
      setStaffList((prev) => prev.map((s) => s.id === id ? { ...s, isActive: true } : s))
      toast.success('Usuário reativado')
    } catch {
      toast.error('Erro ao reativar')
    }
  }, [])

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
            {agendaOnly && (
              <span className="ml-2 inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-300">
                {sessionRoleName || 'Profissional'} · Agenda compartilhada
              </span>
            )}
            {sessionProfessionalId && (
              <a
                href={`/agenda/${sessionProfessionalId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                <CalendarDays size={12} />
                <span className="hidden sm:inline">Minha Agenda</span>
              </a>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="ml-2 h-8 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tab bar */}
          <TabsList className="w-full bg-white/5 border border-white/10 rounded-xl p-1 h-auto flex-wrap gap-0.5 mb-6">
            {visibleTabs.map(({ value, icon: Icon, label }) => (
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
            {/* Seletor de visão (BI) */}
            <div className="flex flex-wrap gap-2">
              {BI_VIEWS.map((v) => {
                const Icon = v.icon
                const active = biView === v.key
                return (
                  <button
                    key={v.key}
                    onClick={() => setBiView(v.key)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? 'border-rose-500/40 bg-rose-500/15 text-rose-200 shadow'
                        : 'border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/80'
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    {v.label}
                  </button>
                )
              })}
            </div>

            {biView === 'financeiro' && (
              <FinanceiroPanel finance={data.finance} professionals={professionals} bi={data.biAnalytics} />
            )}

            {biView === 'desempenho' && (
              <DesempenhoPanel professionals={professionals} bi={data.biAnalytics} />
            )}

            {biView === 'resumo' && (
            <div className="space-y-5">
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
                        <td className="py-2.5 pr-4 text-white/60 text-xs hidden md:table-cell max-w-[220px]">
                          <div className="truncate">{b.service}</div>
                          {b.bookingGroupId && b.bookingGroupSize > 1 && (
                            <div className="text-[10px] text-sky-300/70 mt-0.5">
                              Pacote {b.bookingSequence}/{b.bookingGroupSize}
                            </div>
                          )}
                        </td>
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
            </div>
            )}
          </TabsContent>

          {/* ── Landing Page ─────────────────────────────────────────────────── */}
          <TabsContent value="landing-page" className="space-y-5 mt-0">
            {/* Section selector */}
            <div className="flex flex-wrap gap-2 p-1">
              {([
                { key: 'hero', label: 'Hero' },
                { key: 'sobre', label: 'Sobre' },
                { key: 'depoimentos', label: 'Depoimentos' },
                { key: 'contato', label: 'Contato' },
                { key: 'time', label: 'Nosso Time' },
                { key: 'paleta', label: 'Paleta & Tema' },
                { key: 'config', label: 'Configurações' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveLandingSection(key)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                    activeLandingSection === key
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
              <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer"
                className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5">
                <Globe size={11} /> Ver landing
              </a>
            </div>

            {/* ── Hero ── */}
            {activeLandingSection === 'hero' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Sec title="Textos do hero" action={
                  <Button size="sm" onClick={() => saveLandingSection('lp')} disabled={savingLanding}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Save size={12} className="mr-1" />{savingLanding ? 'Salvando…' : 'Salvar'}
                  </Button>
                }>
                  <div className="space-y-3">
                    <FieldRow label="Título">
                      <Input value={landingSettings.heroTitle} onChange={(e) => setLandingSettings((s) => ({ ...s, heroTitle: e.target.value }))}
                        className={inputClass} placeholder="Ex: Beleza que valoriza você" />
                    </FieldRow>
                    <FieldRow label="Palavra destaque">
                      <div className="flex gap-2">
                        <Input value={landingSettings.heroTitleHighlight} onChange={(e) => setLandingSettings((s) => ({ ...s, heroTitleHighlight: e.target.value }))}
                          className={`${inputClass} flex-1`} placeholder="valoriza" />
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="color"
                            value={landingSettings.heroAccentColor || '#be185d'}
                            onChange={(e) => setLandingSettings((s) => ({ ...s, heroAccentColor: e.target.value }))}
                            className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                            title="Cor do destaque"
                          />
                          {landingSettings.heroAccentColor && (
                            <button onClick={() => setLandingSettings((s) => ({ ...s, heroAccentColor: '' }))}
                              className="text-white/30 hover:text-white/60 text-xs">limpar</button>
                          )}
                        </div>
                      </div>
                      <p className="text-white/25 text-[10px] mt-1">Palavra do título que recebe a cor de destaque</p>
                    </FieldRow>
                    <FieldRow label="Subtítulo">
                      <Textarea value={landingSettings.heroSubtitle} onChange={(e) => setLandingSettings((s) => ({ ...s, heroSubtitle: e.target.value }))}
                        className={`${inputClass} resize-none min-h-[72px]`} placeholder="Descrição breve do estúdio…" />
                    </FieldRow>
                    <FieldRow label="Badge">
                      <Input value={landingSettings.heroBadgeText} onChange={(e) => setLandingSettings((s) => ({ ...s, heroBadgeText: e.target.value }))}
                        className={inputClass} placeholder="Especialistas em Unhas & Alongamento" />
                    </FieldRow>
                    <FieldRow label="CTA principal">
                      <Input value={landingSettings.primaryCtaLabel} onChange={(e) => setLandingSettings((s) => ({ ...s, primaryCtaLabel: e.target.value }))}
                        className={inputClass} placeholder="Agendar Horário" />
                    </FieldRow>
                    <FieldRow label="CTA secundário">
                      <Input value={landingSettings.secondaryCtaLabel} onChange={(e) => setLandingSettings((s) => ({ ...s, secondaryCtaLabel: e.target.value }))}
                        className={inputClass} placeholder="Ver Serviços" />
                    </FieldRow>
                    <FieldRow label="Imagem">
                      <div className="space-y-2">
                        {landingSettings.heroImageUrl && (
                          <div className="relative w-20 h-24 rounded-xl overflow-hidden border border-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={landingSettings.heroImageUrl} alt="Preview" className="w-full h-full object-cover object-top" />
                            <button
                              onClick={() => setLandingSettings((s) => ({ ...s, heroImageUrl: '' }))}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white text-[10px]"
                            >✕</button>
                          </div>
                        )}
                        <input
                          ref={heroImageInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHeroImage(f) }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={uploadingImage}
                          onClick={() => heroImageInputRef.current?.click()}
                          className="h-7 text-xs bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                        >
                          {uploadingImage ? 'Enviando…' : landingSettings.heroImageUrl ? 'Trocar imagem' : 'Escolher imagem'}
                        </Button>
                        <p className="text-white/25 text-[10px]">JPEG, PNG, WebP ou GIF · máx 5 MB</p>
                      </div>
                    </FieldRow>
                  </div>
                </Sec>
                <Sec title="Estatísticas" action={
                  <Button size="sm" onClick={() => saveLandingSection('lp')} disabled={savingLanding}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Save size={12} className="mr-1" />{savingLanding ? 'Salvando…' : 'Salvar'}
                  </Button>
                }>
                  <div className="space-y-4">
                    {([
                      { vKey: 'heroStat1Value' as const, lKey: 'heroStat1Label' as const, label: 'Stat 1' },
                      { vKey: 'heroStat2Value' as const, lKey: 'heroStat2Label' as const, label: 'Stat 2' },
                      { vKey: 'heroStat3Value' as const, lKey: 'heroStat3Label' as const, label: 'Stat 3' },
                    ]).map(({ vKey, lKey, label }) => (
                      <div key={label}>
                        <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1.5">{label}</p>
                        <div className="flex gap-2">
                          <Input value={landingSettings[vKey]} onChange={(e) => setLandingSettings((s) => ({ ...s, [vKey]: e.target.value }))}
                            className={`${inputClass} w-20`} placeholder="5+" />
                          <Input value={landingSettings[lKey]} onChange={(e) => setLandingSettings((s) => ({ ...s, [lKey]: e.target.value }))}
                            className={`${inputClass} flex-1`} placeholder="Anos de Experiência" />
                        </div>
                      </div>
                    ))}
                  </div>
                </Sec>
              </div>
            )}

            {/* ── Sobre ── */}
            {activeLandingSection === 'sobre' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Sec title="Seção Sobre — textos" action={
                  <Button size="sm" onClick={() => saveLandingSection('lp')} disabled={savingLanding}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Save size={12} className="mr-1" />{savingLanding ? 'Salvando…' : 'Salvar'}
                  </Button>
                }>
                  <div className="space-y-3">
                    <FieldRow label="Título">
                      <div className="flex gap-2">
                        <Textarea value={landingSettings.aboutTitle} onChange={(e) => setLandingSettings((s) => ({ ...s, aboutTitle: e.target.value }))}
                          className={`${inputClass} flex-1 resize-none min-h-[56px]`} placeholder="Muito mais do que uma esmalteria…" />
                        <input type="color" value={landingSettings.aboutAccentColor || '#be185d'}
                          onChange={(e) => setLandingSettings((s) => ({ ...s, aboutAccentColor: e.target.value }))}
                          className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent shrink-0 mt-1" title="Cor de destaque" />
                      </div>
                    </FieldRow>
                    <FieldRow label="Parágrafo 1">
                      <Textarea value={landingSettings.aboutBody1} onChange={(e) => setLandingSettings((s) => ({ ...s, aboutBody1: e.target.value }))}
                        className={`${inputClass} resize-none min-h-[72px]`} />
                    </FieldRow>
                    <FieldRow label="Parágrafo 2">
                      <Textarea value={landingSettings.aboutBody2} onChange={(e) => setLandingSettings((s) => ({ ...s, aboutBody2: e.target.value }))}
                        className={`${inputClass} resize-none min-h-[72px]`} />
                    </FieldRow>
                    <FieldRow label="Foto">
                      <div className="space-y-2">
                        {landingSettings.aboutImageUrl && (
                          <div className="relative w-20 h-24 rounded-xl overflow-hidden border border-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={landingSettings.aboutImageUrl} alt="Preview" className="w-full h-full object-cover object-top" />
                            <button
                              onClick={() => setLandingSettings((s) => ({ ...s, aboutImageUrl: '' }))}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white text-[10px]"
                            >✕</button>
                          </div>
                        )}
                        <input
                          ref={aboutImageInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAboutImage(f); e.target.value = '' }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={uploadingAboutImage}
                          onClick={() => aboutImageInputRef.current?.click()}
                          className="h-7 text-xs bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                        >
                          {uploadingAboutImage ? 'Enviando…' : landingSettings.aboutImageUrl ? 'Trocar foto' : 'Escolher foto'}
                        </Button>
                        <p className="text-white/25 text-[10px]">JPEG, PNG ou WebP · máx 5 MB</p>
                      </div>
                    </FieldRow>
                  </div>
                </Sec>
                <Sec title="Cards de diferenciais" action={
                  <Button size="sm" onClick={() => saveLandingSection('lp')} disabled={savingLanding}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Save size={12} className="mr-1" />{savingLanding ? 'Salvando…' : 'Salvar'}
                  </Button>
                }>
                  <div className="space-y-4">
                    {([
                      { tKey: 'aboutFeature1Title' as const, dKey: 'aboutFeature1Desc' as const, num: '1' },
                      { tKey: 'aboutFeature2Title' as const, dKey: 'aboutFeature2Desc' as const, num: '2' },
                      { tKey: 'aboutFeature3Title' as const, dKey: 'aboutFeature3Desc' as const, num: '3' },
                    ]).map(({ tKey, dKey, num }) => (
                      <div key={num} className="space-y-1.5">
                        <p className="text-white/40 text-[10px] uppercase tracking-widest">Diferencial {num}</p>
                        <Input value={landingSettings[tKey]} onChange={(e) => setLandingSettings((s) => ({ ...s, [tKey]: e.target.value }))}
                          className={`${inputClass} text-xs`} placeholder="Título" />
                        <Input value={landingSettings[dKey]} onChange={(e) => setLandingSettings((s) => ({ ...s, [dKey]: e.target.value }))}
                          className={`${inputClass} text-xs`} placeholder="Descrição" />
                      </div>
                    ))}
                  </div>
                </Sec>
              </div>
            )}

            {/* ── Depoimentos ── */}
            {activeLandingSection === 'depoimentos' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Sec title={`Depoimentos (${testimonials.length})`}>
                  {testimonials.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-6">Nenhum depoimento — adicione ao lado</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {testimonials.map((t) => (
                        <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <div className="flex-1 min-w-0">
                            <p className="text-white/80 text-xs font-semibold">{t.authorName}</p>
                            {t.serviceName && <p className="text-rose-400/60 text-[10px]">{t.serviceName}</p>}
                            <p className="text-white/50 text-xs mt-1 leading-relaxed line-clamp-3 italic">&quot;{t.body}&quot;</p>
                          </div>
                          <button onClick={() => deleteTestimonial(t.id)}
                            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-500/20 text-white/30 hover:text-rose-400 transition-colors mt-0.5">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Sec>
                <Sec title="Novo depoimento" action={
                  <Button size="sm" onClick={createTestimonial} disabled={creatingTestimonial}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Plus size={12} className="mr-1" />{creatingTestimonial ? 'Adicionando…' : 'Adicionar'}
                  </Button>
                }>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Nome *</Label>
                      <Input value={testimonialForm.authorName} onChange={(e) => setTestimonialForm((f) => ({ ...f, authorName: e.target.value }))}
                        className={`${inputClass} text-xs`} placeholder="Ex: Mariana S." />
                    </div>
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Depoimento *</Label>
                      <Textarea value={testimonialForm.body} onChange={(e) => setTestimonialForm((f) => ({ ...f, body: e.target.value }))}
                        className={`${inputClass} text-xs resize-none min-h-[80px]`} placeholder="O que a cliente disse…" />
                    </div>
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Serviço realizado</Label>
                      <Input value={testimonialForm.serviceName} onChange={(e) => setTestimonialForm((f) => ({ ...f, serviceName: e.target.value }))}
                        className={`${inputClass} text-xs`} placeholder="Ex: Alongamento em Gel" />
                    </div>
                    <p className="text-white/25 text-[10px]">Aparece no carrossel da landing assim que salvo.</p>
                  </div>
                </Sec>
              </div>
            )}

            {/* ── Contato ── */}
            {activeLandingSection === 'contato' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Sec title="Seção Contato — textos" action={
                  <Button size="sm" onClick={() => saveLandingSection('lp')} disabled={savingLanding}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Save size={12} className="mr-1" />{savingLanding ? 'Salvando…' : 'Salvar'}
                  </Button>
                }>
                  <div className="space-y-3">
                    <FieldRow label="Título">
                      <Input value={landingSettings.contactTitle} onChange={(e) => setLandingSettings((s) => ({ ...s, contactTitle: e.target.value }))}
                        className={inputClass} placeholder="Vem nos visitar" />
                    </FieldRow>
                    <FieldRow label="Subtítulo">
                      <Input value={landingSettings.contactSubtitle} onChange={(e) => setLandingSettings((s) => ({ ...s, contactSubtitle: e.target.value }))}
                        className={inputClass} placeholder="Estamos esperando você…" />
                    </FieldRow>
                  </div>
                </Sec>
                <Sec title="Informações de contato" action={
                  <Button size="sm" onClick={() => saveLandingSection('org')} disabled={savingLanding}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    <Save size={12} className="mr-1" />{savingLanding ? 'Salvando…' : 'Salvar'}
                  </Button>
                }>
                  <div className="space-y-3">
                    <FieldRow label="WhatsApp exibição">
                      <Input value={orgSettings.whatsappDisplay} onChange={(e) => setOrgSettings((s) => ({ ...s, whatsappDisplay: e.target.value }))}
                        className={inputClass} placeholder="(31) 99072-5053" />
                    </FieldRow>
                    <FieldRow label="WhatsApp API">
                      <Input value={orgSettings.whatsappPhone ?? ''} onChange={(e) => setOrgSettings((s) => ({ ...s, whatsappPhone: e.target.value || null }))}
                        className={inputClass} placeholder="5531990725053" />
                    </FieldRow>
                    <FieldRow label="Instagram">
                      <Input value={orgSettings.instagramHandle} onChange={(e) => setOrgSettings((s) => ({ ...s, instagramHandle: e.target.value }))}
                        className={inputClass} placeholder="scstudioeesmalteria" />
                    </FieldRow>
                    <FieldRow label="Endereço">
                      <Textarea value={orgSettings.addressText} onChange={(e) => setOrgSettings((s) => ({ ...s, addressText: e.target.value }))}
                        className={`${inputClass} resize-none min-h-[64px] text-xs`} />
                    </FieldRow>
                    <FieldRow label="URL do mapa">
                      <Textarea value={orgSettings.mapsEmbedUrl} onChange={(e) => setOrgSettings((s) => ({ ...s, mapsEmbedUrl: e.target.value }))}
                        className={`${inputClass} resize-none min-h-[56px] text-xs`} placeholder="Cole o src do iframe do Google Maps embed…" />
                    </FieldRow>
                  </div>
                </Sec>
              </div>
            )}

            {/* ── Nosso Time ── */}
            {activeLandingSection === 'time' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Sec title={`Nosso Time (${teamMembers.length})`}>
                  {teamMembers.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-6">Nenhum membro — adicione ao lado</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {teamMembers.map((m, index) => (
                        <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border ${editingTeamMemberId === m.id ? 'bg-rose-500/[0.08] border-rose-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                          {m.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.photoUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover object-top shrink-0 border border-white/10" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center shrink-0 border border-rose-500/20">
                              <span className="text-rose-300 text-xs font-bold">
                                {m.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white/80 text-xs font-semibold truncate">{m.name}</p>
                            {m.role && <p className="text-white/40 text-[10px] truncate">{m.role}</p>}
                            <p className="text-white/20 text-[9px] mt-1">posicao {index + 1}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveTeamMember(m.id, 'up')}
                              disabled={index === 0}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ChevronUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveTeamMember(m.id, 'down')}
                              disabled={index === teamMembers.length - 1}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ChevronDown size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditTeamMember(m)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                            >
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => deleteTeamMember(m.id)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-500/20 text-white/30 hover:text-rose-400 transition-colors">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Sec>
                <Sec title={editingTeamMemberId ? 'Editar membro' : 'Adicionar membro'} action={
                  <Button size="sm" onClick={saveTeamMember} disabled={creatingTeamMember}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    {editingTeamMemberId ? <Save size={12} className="mr-1" /> : <Plus size={12} className="mr-1" />}
                    {creatingTeamMember ? 'Salvando…' : editingTeamMemberId ? 'Salvar' : 'Adicionar'}
                  </Button>
                }>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Nome *</Label>
                      <Input value={teamMemberForm.name} onChange={(e) => setTeamMemberForm((f) => ({ ...f, name: e.target.value }))}
                        className={`${inputClass} text-xs`} placeholder="Ex: Ana Paula" />
                    </div>
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Categoria</Label>
                      <Input value={teamMemberForm.role} onChange={(e) => setTeamMemberForm((f) => ({ ...f, role: e.target.value }))}
                        className={`${inputClass} text-xs`} placeholder="Ex: Nail Designer, Designer de Cilios, Recepcao" />
                    </div>
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Foto</Label>
                      <div className="space-y-2">
                        {teamMemberForm.photoUrl && (
                          <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={teamMemberForm.photoUrl} alt="Preview" className="w-full h-full object-cover object-top" />
                            <button
                              onClick={() => setTeamMemberForm((f) => ({ ...f, photoUrl: '' }))}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white/80 text-[10px]"
                            >✕</button>
                          </div>
                        )}
                        <input
                          ref={teamPhotoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTeamPhoto(f) }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={uploadingTeamPhoto}
                          onClick={() => teamPhotoInputRef.current?.click()}
                          className="h-7 text-xs bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                        >
                          {uploadingTeamPhoto ? 'Enviando…' : teamMemberForm.photoUrl ? 'Trocar foto' : 'Escolher foto'}
                        </Button>
                        <p className="text-white/25 text-[10px]">JPEG, PNG, WebP · máx 5 MB</p>
                      </div>
                    </div>
                    {editingTeamMemberId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={resetTeamMemberForm}
                        className="h-7 px-0 justify-start text-xs text-white/40 hover:text-white/70 hover:bg-transparent"
                      >
                        <X size={12} className="mr-1" />Cancelar edicao
                      </Button>
                    )}
                    <p className="text-white/25 text-[10px]">Cadastre nome, categoria e foto. A ordem da lista define a ordem exibida na landing.</p>
                  </div>
                </Sec>
              </div>
            )}

            {/* ── Paleta & Tema ── */}
            {activeLandingSection === 'paleta' && (() => {
              const isCustom = landingSettings.themeVariant === 'personalizado'
              const customPrimary = landingSettings.heroAccentColor || '#b15d64'
              const customAccent  = landingSettings.aboutAccentColor || customPrimary

              const activePreset = isCustom
                ? (() => {
                    const prev = buildCustomThemePreview(customPrimary, customAccent)
                    return { label: 'Personalizado', description: 'Cores escolhidas por você', preview: prev, styles: buildCustomThemeStyles(customPrimary, customAccent) }
                  })()
                : (LANDING_THEME_PRESETS.find((p) => p.id === landingSettings.themeVariant) ?? LANDING_THEME_PRESETS[0])

              const ts = activePreset.styles as Record<string, string>

              return (
                <div className="space-y-5">
                  {/* Prévia em tempo real */}
                  <Sec title="Prévia do tema" action={
                    <Button size="sm" onClick={() => saveLandingSection('lp')} disabled={savingLanding}
                      className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                      <Save size={12} className="mr-1" />{savingLanding ? 'Publicando…' : 'Publicar no site'}
                    </Button>
                  }>
                    <p className="text-white/40 text-xs mb-4">
                      Botões, textos de destaque, fundos e acentos — tudo muda junto com a paleta.
                    </p>
                    <div
                      className="rounded-[1.5rem] border border-white/10 p-5"
                      style={{ background: activePreset.preview.background, color: ts['--foreground'] }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                          <p className="text-lg sm:text-xl font-semibold">SC Studio & Esmalteria</p>
                          <p className="text-xs mt-1 opacity-70">Beleza que valoriza você — <strong>{activePreset.label}</strong></p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="w-8 h-8 rounded-full border-2 border-white/20 shadow" style={{ background: activePreset.preview.primary }} title="Primária" />
                          <span className="w-8 h-8 rounded-full border-2 border-white/20 shadow" style={{ background: activePreset.preview.accent }} title="Destaque" />
                          <span className="w-8 h-8 rounded-full border-2 border-white/20 shadow" style={{ background: activePreset.preview.background }} title="Fundo" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <button className="rounded-full px-5 py-2 text-xs font-semibold shadow" style={{ background: activePreset.preview.primary, color: ts['--primary-foreground'] || '#fff' }}>
                          Agendar meu horário
                        </button>
                        <button className="rounded-full px-5 py-2 text-xs font-semibold border" style={{ borderColor: activePreset.preview.primary, color: activePreset.preview.primary, background: 'transparent' }}>
                          Ver serviços
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Serviço', name: 'Esmaltação', sub: '60 min · R$ 50' },
                          { label: 'Destaque', name: 'Nail Art', sub: '90 min · R$ 80' },
                          { label: 'Popular', name: 'Manicure', sub: '45 min · R$ 35' },
                        ].map((item) => (
                          <div key={item.label} className="rounded-2xl p-3 border" style={{ background: ts['--card'], borderColor: ts['--border'] }}>
                            <p className="text-[10px] uppercase tracking-widest" style={{ color: activePreset.preview.accent }}>{item.label}</p>
                            <p className="text-sm font-medium mt-1">{item.name}</p>
                            <p className="text-xs opacity-60 mt-0.5">{item.sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Sec>

                  {/* Seletor de paletas */}
                  <Sec title="Escolha uma paleta">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
                      {LANDING_THEME_PRESETS.filter((p) => p.id !== 'personalizado').map((preset) => {
                        const active = landingSettings.themeVariant === preset.id
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setLandingSettings((s) => ({ ...s, themeVariant: preset.id }))}
                            className={`text-left rounded-2xl border p-4 transition-all ${active ? 'border-rose-400/40 bg-rose-500/10 ring-1 ring-rose-400/20' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'}`}
                          >
                            <div className="w-full h-20 rounded-xl border border-white/10 overflow-hidden mb-3 shadow-sm" style={{ background: preset.preview.background }}>
                              <div className="h-[55%] w-full flex items-end pb-1 px-2">
                                <div className="w-full h-3.5 rounded-full" style={{ background: preset.preview.primary }} />
                              </div>
                              <div className="h-[45%] w-full flex items-center gap-1 px-2">
                                <div className="w-1/2 h-2.5 rounded-full opacity-60" style={{ background: preset.preview.primary }} />
                                <div className="w-1/3 h-2.5 rounded-full" style={{ background: preset.preview.accent }} />
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold text-white/85">{preset.label}</p>
                              {active && <span className="text-[10px] rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-rose-300">Ativa</span>}
                            </div>
                            <p className="text-[11px] text-white/40 mb-3">{preset.description}</p>
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full border border-white/15" style={{ background: preset.preview.primary }} />
                              <span className="w-5 h-5 rounded-full border border-white/15" style={{ background: preset.preview.accent }} />
                              <span className="w-5 h-5 rounded-full border border-white/15" style={{ background: preset.preview.background }} />
                            </div>
                          </button>
                        )
                      })}

                      {/* Card personalizado */}
                      <button
                        type="button"
                        onClick={() => setLandingSettings((s) => ({
                          ...s,
                          themeVariant: 'personalizado',
                          heroAccentColor: s.heroAccentColor || '#b15d64',
                          aboutAccentColor: s.aboutAccentColor || '#c9a87c',
                        }))}
                        className={`text-left rounded-2xl border p-4 transition-all ${isCustom ? 'border-violet-400/40 bg-violet-500/10 ring-1 ring-violet-400/20' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'}`}
                      >
                        <div className="w-full h-20 rounded-xl border border-dashed border-white/20 overflow-hidden mb-3 flex items-center justify-center" style={{ background: isCustom ? buildCustomThemePreview(customPrimary, customAccent).background : '#1a1a2e' }}>
                          <div className="flex gap-2">
                            {(isCustom ? [customPrimary, customAccent] : ['#ff6b6b', '#4ecdc4']).map((c, i) => (
                              <span key={i} className="w-7 h-7 rounded-full border-2 border-white/30 shadow" style={{ background: c }} />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-white/85">Personalizado</p>
                          {isCustom && <span className="text-[10px] rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-violet-300">Ativa</span>}
                        </div>
                        <p className="text-[11px] text-white/40">Escolha qualquer cor para o site.</p>
                      </button>
                    </div>

                    {/* Color pickers — só aparecem quando Personalizado está ativo */}
                    {isCustom && (
                      <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-5 space-y-5">
                        <p className="text-sm font-semibold text-violet-300">Cores personalizadas</p>
                        <p className="text-xs text-white/40 -mt-3">
                          Clique nas cores abaixo para alterar. A prévia acima atualiza em tempo real.
                        </p>

                        {/* Cor primária */}
                        <div className="flex items-center gap-4">
                          <label className="relative cursor-pointer shrink-0">
                            <span
                              className="flex w-12 h-12 rounded-2xl border-2 border-white/20 shadow-lg cursor-pointer transition-transform hover:scale-105"
                              style={{ background: customPrimary }}
                            />
                            <input
                              type="color"
                              value={customPrimary}
                              onChange={(e) => setLandingSettings((s) => ({ ...s, heroAccentColor: e.target.value }))}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            />
                          </label>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white/80">Cor principal</p>
                            <p className="text-xs text-white/40">Botões, links e destaques do site</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Input
                                value={customPrimary}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setLandingSettings((s) => ({ ...s, heroAccentColor: v }))
                                }}
                                className={`${inputClass} h-7 text-xs font-mono w-28`}
                                maxLength={7}
                                placeholder="#000000"
                              />
                              <div className="flex gap-1">
                                {['#b15d64','#8b1e3f','#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0891b2'].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setLandingSettings((s) => ({ ...s, heroAccentColor: c }))}
                                    title={c}
                                    className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform shrink-0"
                                    style={{ background: c }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Cor de destaque */}
                        <div className="flex items-center gap-4">
                          <label className="relative cursor-pointer shrink-0">
                            <span
                              className="flex w-12 h-12 rounded-2xl border-2 border-white/20 shadow-lg cursor-pointer transition-transform hover:scale-105"
                              style={{ background: customAccent }}
                            />
                            <input
                              type="color"
                              value={customAccent}
                              onChange={(e) => setLandingSettings((s) => ({ ...s, aboutAccentColor: e.target.value }))}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            />
                          </label>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white/80">Cor de destaque</p>
                            <p className="text-xs text-white/40">Acentos, badges e elementos secundários</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Input
                                value={customAccent}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setLandingSettings((s) => ({ ...s, aboutAccentColor: v }))
                                }}
                                className={`${inputClass} h-7 text-xs font-mono w-28`}
                                maxLength={7}
                                placeholder="#000000"
                              />
                              <div className="flex gap-1">
                                {['#c9a87c','#d4a373','#14b8a6','#84cc16','#f59e0b','#a78bfa','#f472b6','#38bdf8'].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setLandingSettings((s) => ({ ...s, aboutAccentColor: c }))}
                                    title={c}
                                    className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform shrink-0"
                                    style={{ background: c }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button size="sm" onClick={() => saveLandingSection('lp')} disabled={savingLanding}
                      className="mt-5 h-8 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                      <Save size={12} className="mr-1.5" />{savingLanding ? 'Publicando…' : 'Publicar paleta no site'}
                    </Button>
                  </Sec>
                </div>
              )
            })()}

            {/* ── Configurações ── */}
            {activeLandingSection === 'config' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Sec title="Seções visíveis" action={
                  <Button size="sm" onClick={() => saveLandingSection('lp')} disabled={savingLanding}
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
              </div>
            )}
          </TabsContent>

          {/* ── Agenda ───────────────────────────────────────────────────────── */}
          <TabsContent value="agenda" className="space-y-4 mt-0">

            {/* Pending PIX payments */}
            {pendingPayments.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-sm font-semibold text-amber-300">
                    {pendingPayments.length === 1 ? '1 pagamento aguardando confirmação' : `${pendingPayments.length} pagamentos aguardando confirmação`}
                  </span>
                </div>
                {pendingPayments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.customer_name}</p>
                      <p className="text-xs text-white/50 truncate">{p.service_name} · {p.booking_date} às {p.booking_time}</p>
                      <p className="text-xs text-white/40 font-mono">{p.customer_phone.split('@')[0]}</p>
                    </div>
                    {p.price_snapshot && (
                      <span className="text-xs font-semibold text-amber-300 shrink-0">{p.price_snapshot}</span>
                    )}
                    <button
                      onClick={() => void confirmPayment(p.id)}
                      disabled={confirmingPaymentId === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-all shrink-0">
                      <CheckCircle size={12} />
                      {confirmingPaymentId === p.id ? 'Confirmando...' : 'Confirmar'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Top bar: date nav + prof filter + action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1.5">
                <button onClick={() => navigateOverviewDate(-1)} disabled={loadingOverview}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-40">
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 text-sm font-semibold text-white min-w-[110px] text-center">{formatSelectedDateLabel(selectedDate)}</span>
                <button onClick={() => navigateOverviewDate(1)} disabled={loadingOverview}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-40">
                  <ChevronRight size={14} />
                </button>
                {loadingOverview && <RefreshCw size={12} className="text-white/40 animate-spin ml-1" />}
              </div>
              <span className="text-white/20 text-xs">{selectedDate}</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => { setAgendaSide((s) => s === 'booking' ? null : 'booking'); setNewBookingForm((f) => ({ ...f, date: selectedDate })) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${agendaSide === 'booking' ? 'bg-rose-500/25 border-rose-500/40 text-rose-300' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}>
                  <BookOpen size={13} /> Novo agend.
                </button>
                <button
                  onClick={() => setAgendaSide((s) => s === 'block' ? null : 'block')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${agendaSide === 'block' ? 'bg-amber-500/25 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}>
                  <X size={13} /> Bloquear
                </button>
                <button
                  onClick={() => { setAbsentForm((f) => ({ ...f, date: selectedDate, professionalId: '', targetProfId: '' })); setAgendaSide((s) => s === 'absent' ? null : 'absent') }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${agendaSide === 'absent' ? 'bg-orange-500/25 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}>
                  <UserMinus size={13} /> Ausência
                </button>
              </div>
            </div>

            {/* Main: timeline + optional side panel */}
            <div className="flex gap-4 items-start">

              {/* Timeline */}
              <div className="flex-1 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                {/* Professional header */}
                <div className="flex border-b border-white/10 bg-white/[0.03] sticky top-0 z-10 group">
                  <div className="w-14 shrink-0 border-r border-white/[0.06]" />
                  {allProfessionals.length === 0 ? (
                    <div className="flex-1 px-3 py-2 text-white/30 text-xs">Nenhuma profissional cadastrada</div>
                  ) : (
                    allProfessionals.map((prof, i) => {
                      const color = PROF_PALETTE[i % PROF_PALETTE.length]
                      const dayBookings = bookings.filter((b) => b.professionalId === prof.id)
                      return (
                        <div key={prof.id} className="flex-1 min-w-0 px-2 py-1.5 flex items-center gap-1.5 border-r border-white/[0.06] last:border-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                          <span className={`text-xs font-semibold truncate flex-1 ${color.header}`}>{prof.name.split(' ')[0]}</span>
                          <button
                            title={`Registrar ausência — ${prof.name.split(' ')[0]}`}
                            onClick={() => {
                              setAbsentForm((f) => ({ ...f, professionalId: prof.id, date: selectedDate, createBlock: true, transfer: dayBookings.length > 0, targetProfId: '' }))
                              setAgendaSide('absent')
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:!opacity-100 text-white/25 hover:text-amber-400 transition-all shrink-0">
                            <UserMinus size={11} />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Scrollable grid */}
                <div ref={timelineScrollRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                  <div className="relative" style={{ height: (TIMELINE_HOUR_END - TIMELINE_HOUR_START) * 2 * SLOT_H }}>

                    {/* Hour lines + labels */}
                    {Array.from({ length: TIMELINE_HOUR_END - TIMELINE_HOUR_START + 1 }, (_, i) => i + TIMELINE_HOUR_START).map((h) => (
                      <div key={h} style={{ position: 'absolute', top: (h - TIMELINE_HOUR_START) * 2 * SLOT_H, left: 0, right: 0 }}
                        className="border-t border-white/[0.06] flex">
                        <div className="w-14 shrink-0 pr-2 text-right">
                          <span className="text-[10px] text-white/25 font-mono leading-none">{String(h).padStart(2, '0')}:00</span>
                        </div>
                        <div className="flex-1" />
                      </div>
                    ))}

                    {/* Half-hour lines */}
                    {Array.from({ length: TIMELINE_HOUR_END - TIMELINE_HOUR_START }, (_, i) => i + TIMELINE_HOUR_START).map((h) => (
                      <div key={`half-${h}`} style={{ position: 'absolute', top: (h - TIMELINE_HOUR_START) * 2 * SLOT_H + SLOT_H, left: 56, right: 0 }}
                        className="border-t border-white/[0.03]" />
                    ))}

                    {/* Professional column dividers */}
                    {allProfessionals.map((_, i) => i > 0 && (
                      <div key={`col-${i}`} style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `calc(56px + ${i} * (100% - 56px) / ${allProfessionals.length})`,
                        width: 1,
                      }} className="bg-white/[0.05]" />
                    ))}

                    {/* Blocks (schedule_blocks) as striped zones */}
                    {blocks.filter((blk) => {
                      const blkStart = blk.startsAt.slice(0, 10)
                      const blkEnd = blk.endsAt.slice(0, 10)
                      return blkStart <= selectedDate && blkEnd >= selectedDate
                    }).map((blk, bi) => {
                      const start = new Date(blk.startsAt)
                      const end = new Date(blk.endsAt)
                      const sH = start.getHours(); const sM = start.getMinutes()
                      const eH = end.getHours(); const eM = end.getMinutes()
                      const clampSH = Math.max(TIMELINE_HOUR_START, sH)
                      const clampSM = clampSH === sH ? sM : 0
                      const clampEH = Math.min(TIMELINE_HOUR_END, eH)
                      const clampEM = clampEH === eH ? eM : 0
                      const topPx = ((clampSH - TIMELINE_HOUR_START) * 60 + clampSM) / 30 * SLOT_H
                      const botPx = ((clampEH - TIMELINE_HOUR_START) * 60 + clampEM) / 30 * SLOT_H
                      const heightPx = Math.max(SLOT_H / 2, botPx - topPx)
                      const colCount = Math.max(allProfessionals.length, 1)
                      if (blk.professionalId) {
                        const ci = allProfessionals.findIndex((p) => p.id === blk.professionalId)
                        if (ci < 0) return null
                        return (
                          <div key={`blk-${bi}`} style={{ position: 'absolute', top: topPx, height: heightPx, left: `calc(56px + ${ci} * (100% - 56px) / ${colCount})`, width: `calc((100% - 56px) / ${colCount})`, zIndex: 1 }}
                            className="bg-amber-500/10 border-l-2 border-amber-500/30 pointer-events-none overflow-hidden flex items-start">
                            <span className="text-amber-400/60 text-[9px] px-1 pt-0.5 font-medium leading-tight truncate">{blk.reason}</span>
                          </div>
                        )
                      }
                      return (
                        <div key={`blk-${bi}`} style={{ position: 'absolute', top: topPx, height: heightPx, left: 56, right: 0, zIndex: 1 }}
                          className="bg-amber-500/[0.07] border-l-2 border-amber-500/30 pointer-events-none overflow-hidden flex items-start">
                          <span className="text-amber-400/60 text-[9px] px-1 pt-0.5 font-medium leading-tight truncate">Todas — {blk.reason}</span>
                        </div>
                      )
                    })}

                    {/* Bookings */}
                    {bookings.map((b) => {
                      const [hh, mm] = b.time.split(':').map(Number)
                      if (hh < TIMELINE_HOUR_START || hh >= TIMELINE_HOUR_END) return null
                      const isCancelled = b.status === 'Cancelado'
                      const topPx = ((hh - TIMELINE_HOUR_START) * 60 + mm) / 30 * SLOT_H
                      const heightPx = Math.max(SLOT_H * 0.9, (b.durationMin / 30) * SLOT_H - 2)
                      const profIdx = allProfessionals.findIndex((p) => p.id === b.professionalId)
                      const colCount = Math.max(allProfessionals.length, 1)
                      const colIdx = profIdx >= 0 ? profIdx : 0
                      const color = PROF_PALETTE[colIdx % PROF_PALETTE.length]
                      const leftPct = profIdx >= 0
                        ? `calc(56px + ${colIdx} * (100% - 56px) / ${colCount} + 2px)`
                        : '58px'
                      const widthPct = `calc((100% - 56px) / ${colCount} - 4px)`
                      const isSelected = selectedBookingId === b.id

                      return (
                        <div key={b.id}
                          style={{ position: 'absolute', top: topPx, height: heightPx, left: leftPct, width: widthPct, zIndex: isCancelled ? 1 : 2 }}
                          onClick={() => { setSelectedBookingId(b.id); setReassignProfId(b.professionalId ?? ''); setAgendaSide('detail') }}
                          className={`rounded-lg border px-2 py-1 overflow-hidden cursor-pointer transition-all hover:brightness-125 ${isCancelled ? 'opacity-30 border-dashed border-white/20 bg-white/[0.03]' : color.bg} ${isSelected ? 'ring-2 ring-white/40' : ''}`}>
                          <p className={`text-[11px] font-bold leading-tight truncate ${isCancelled ? 'text-white/40 line-through' : color.text}`}>{b.time} · {b.client}</p>
                          <p className={`text-[10px] leading-tight truncate ${isCancelled ? 'text-white/30' : `${color.text} opacity-70`}`}>{b.service}</p>
                          {!isCancelled && b.bookingGroupId && b.bookingGroupSize > 1 && (
                            <p className={`text-[9px] leading-tight truncate ${color.text} opacity-55`}>
                              Pacote {b.bookingSequence}/{b.bookingGroupSize}
                            </p>
                          )}
                          {!isCancelled && b.customerConfirmationStatus === 'confirmed' && heightPx > SLOT_H * 1.2 && (
                            <p className={`text-[9px] leading-tight truncate ${color.text} opacity-70`}>
                              Cliente confirmou
                            </p>
                          )}
                          {!isCancelled && b.customerConfirmationStatus === 'declined' && heightPx > SLOT_H * 1.2 && (
                            <p className="text-[9px] leading-tight truncate text-rose-200/80">
                              Cliente pediu contato
                            </p>
                          )}
                          {!isCancelled && heightPx > SLOT_H * 1.5 && (
                            <div className="mt-0.5 flex items-center gap-1">
                              <StatusBadge status={b.status} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {bookings.length === 0 && !loadingOverview && (
                  <div className="py-10 text-center text-white/25 text-sm border-t border-white/5">Nenhum agendamento para este dia</div>
                )}
              </div>

              {/* Side panel */}
              {agendaSide && (
                <div className="w-72 shrink-0 space-y-3">
                  {agendaSide === 'booking' && (
                    <Sec title="Novo agendamento" action={
                      <button onClick={() => setAgendaSide(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
                    }>
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Nome da cliente *</label>
                          <Input value={newBookingForm.clientName} onChange={(e) => setNewBookingForm((f) => ({ ...f, clientName: e.target.value }))}
                            className={`${inputClass} text-xs`} placeholder="Ex: Maria Silva" />
                        </div>
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1"><PhoneCall size={10} className="inline mr-1" />Telefone *</label>
                          <Input value={newBookingForm.clientPhone} onChange={(e) => setNewBookingForm((f) => ({ ...f, clientPhone: e.target.value }))}
                            className={`${inputClass} text-xs`} placeholder="(31) 99999-9999" />
                        </div>
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Serviço *</label>
                          <Select value={newBookingForm.serviceId} onValueChange={(v) => setNewBookingForm((f) => ({ ...f, serviceId: v }))}>
                            <SelectTrigger className={`${inputClass} text-xs`}><SelectValue placeholder="Selecionar serviço" /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10 text-white">
                              {services.map((svc) => (
                                <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Profissional</label>
                          <Select value={newBookingForm.professionalId || 'none'} onValueChange={(v) => setNewBookingForm((f) => ({ ...f, professionalId: v === 'none' ? '' : v }))}>
                            <SelectTrigger className={`${inputClass} text-xs`}><SelectValue placeholder="Qualquer" /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10 text-white">
                              <SelectItem value="none">Sem preferência</SelectItem>
                              {allProfessionals.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Data *</label>
                            <Input type="date" value={newBookingForm.date} onChange={(e) => setNewBookingForm((f) => ({ ...f, date: e.target.value }))}
                              className={`${inputClass} text-xs [color-scheme:dark]`} />
                          </div>
                          <div>
                            <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Hora *</label>
                            <Input type="time" value={newBookingForm.time} onChange={(e) => setNewBookingForm((f) => ({ ...f, time: e.target.value }))}
                              className={`${inputClass} text-xs [color-scheme:dark]`} />
                          </div>
                        </div>
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Observação</label>
                          <Input value={newBookingForm.notes} onChange={(e) => setNewBookingForm((f) => ({ ...f, notes: e.target.value }))}
                            className={`${inputClass} text-xs`} placeholder="Opcional…" />
                        </div>
                        <Button onClick={createManualBooking} disabled={creatingManualBooking}
                          className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 text-xs">
                          <BookOpen size={13} className="mr-1" />{creatingManualBooking ? 'Criando…' : 'Criar agendamento'}
                        </Button>
                        <p className="text-white/20 text-[10px] text-center">Status: confirmado · Canal: Gestor</p>
                      </div>
                    </Sec>
                  )}

                  {agendaSide === 'block' && (
                    <Sec title="Novo bloqueio" action={
                      <button onClick={() => setAgendaSide(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
                    }>
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Profissional</label>
                          <Select value={blockForm.professional || 'all'} onValueChange={(v) => setBlockForm((f) => ({ ...f, professional: v === 'all' ? '' : v }))}>
                            <SelectTrigger className={`${inputClass} text-xs`}><SelectValue placeholder="Todas" /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10 text-white">
                              <SelectItem value="all">Todas</SelectItem>
                              {allProfessionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Início</label>
                          <Input type="datetime-local" value={blockForm.startsAt} onChange={(e) => setBlockForm((f) => ({ ...f, startsAt: e.target.value }))}
                            className={`${inputClass} text-xs [color-scheme:dark]`} />
                        </div>
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Fim</label>
                          <Input type="datetime-local" value={blockForm.endsAt} onChange={(e) => setBlockForm((f) => ({ ...f, endsAt: e.target.value }))}
                            className={`${inputClass} text-xs [color-scheme:dark]`} />
                        </div>
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Motivo</label>
                          <Input value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                            className={`${inputClass} text-xs`} placeholder="Ex: Treinamento, folga…" />
                        </div>
                        <Button onClick={createBlock} disabled={creatingBlock}
                          className="w-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/20 text-xs">
                          <X size={13} className="mr-1" />{creatingBlock ? 'Criando…' : 'Bloquear horário'}
                        </Button>
                      </div>
                    </Sec>
                  )}

                  {/* ── Detail panel ── */}
                  {agendaSide === 'detail' && (() => {
                    const b = bookings.find((x) => x.id === selectedBookingId)
                    if (!b) return null
                    return (
                      <Sec title="Agendamento" action={
                        <button onClick={() => { setAgendaSide(null); setSelectedBookingId(null) }} className="text-white/30 hover:text-white/60"><X size={14} /></button>
                      }>
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] space-y-1.5">
                            <p className="text-white font-semibold text-sm">{b.client}</p>
                            <p className="text-white/50 text-xs">{b.time} · {b.service}</p>
                            <p className="text-white/40 text-xs">{b.professional}</p>
                            {b.bookingGroupId && b.bookingGroupSize > 1 && (
                              <p className="text-sky-300/70 text-[11px]">
                                Etapa {b.bookingSequence} de {b.bookingGroupSize} da mesma visita
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              <StatusBadge status={b.status} />
                              <BookingConfirmationBadge booking={b} />
                            </div>
                          </div>

                          {/* Verificação de pagamento PIX */}
                          {(b.status === 'Ag. Pagamento' || b.status === 'Pendente') && (
                            <div className={`rounded-xl border p-3 space-y-2 ${b.status === 'Ag. Pagamento' ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/[0.03]'}`}>
                              <div className="flex items-center gap-2">
                                {b.status === 'Ag. Pagamento' && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />}
                                <p className={`text-xs font-semibold ${b.status === 'Ag. Pagamento' ? 'text-amber-300' : 'text-white/50'}`}>
                                  {b.status === 'Ag. Pagamento' ? 'Cliente declarou pagamento — verificar' : 'Verificação de pagamento'}
                                </p>
                              </div>
                              <Button size="sm" disabled={updatingBooking || confirmingPaymentId === b.id}
                                onClick={() => void confirmPayment(b.id)}
                                className="w-full text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle size={11} className="mr-1" />
                                {confirmingPaymentId === b.id ? 'Confirmando...' : 'Marcar como pago e confirmado'}
                              </Button>
                            </div>
                          )}

                          {b.status !== 'Cancelado' && (
                            <div className="space-y-1.5">
                              <label className="text-white/40 text-[10px] uppercase tracking-widest block">Ação rápida</label>
                              <div className="grid grid-cols-2 gap-1.5">
                                {b.status !== 'Concluído' && (
                                  <Button size="sm" disabled={updatingBooking}
                                    onClick={() => updateBookingField(b.id, { status: 'completed' })}
                                    className="text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20">
                                    <CheckCircle size={11} className="mr-1" /> Concluído
                                  </Button>
                                )}
                                <Button size="sm" disabled={updatingBooking}
                                  onClick={() => updateBookingField(b.id, { status: 'cancelled' })}
                                  className="text-[11px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/20">
                                  <XCircle size={11} className="mr-1" /> {b.bookingGroupId ? 'Cancelar visita' : 'Cancelar'}
                                </Button>
                              </div>
                              {b.bookingGroupId && b.bookingGroupSize > 1 && (
                                <p className="text-[10px] text-white/35">
                                  Ao cancelar ou reagendar, toda a sequência desta visita é atualizada para liberar os horários corretamente.
                                </p>
                              )}
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <label className="text-white/40 text-[10px] uppercase tracking-widest block">Transferir para</label>
                            <Select value={reassignProfId || 'none'} onValueChange={(v) => setReassignProfId(v === 'none' ? '' : v)}>
                              <SelectTrigger className={`${inputClass} text-xs`}><SelectValue placeholder="Selecionar profissional" /></SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                <SelectItem value="none">Sem atribuição</SelectItem>
                                {allProfessionals.filter((p) => p.id !== b.professionalId).map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" disabled={updatingBooking || !reassignProfId}
                              onClick={() => updateBookingField(b.id, { professionalId: reassignProfId || null })}
                              className="w-full text-[11px] bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/20">
                              <ArrowRightLeft size={11} className="mr-1" /> Transferir agendamento
                            </Button>
                          </div>
                        </div>
                      </Sec>
                    )
                  })()}

                  {/* ── Absent panel ── */}
                  {agendaSide === 'absent' && (
                    <Sec title="Registrar ausência" action={
                      <button onClick={() => setAgendaSide(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
                    }>
                      <div className="space-y-3">
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Profissional ausente *</label>
                          <Select value={absentForm.professionalId || 'none'} onValueChange={(v) => setAbsentForm((f) => ({ ...f, professionalId: v === 'none' ? '' : v }))}>
                            <SelectTrigger className={`${inputClass} text-xs`}><SelectValue placeholder="Selecionar" /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10 text-white">
                              <SelectItem value="none">Selecionar…</SelectItem>
                              {allProfessionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Data</label>
                          <Input type="date" value={absentForm.date} onChange={(e) => setAbsentForm((f) => ({ ...f, date: e.target.value }))}
                            className={`${inputClass} text-xs [color-scheme:dark]`} />
                        </div>

                        {/* Count of bookings to transfer */}
                        {absentForm.professionalId && (() => {
                          const cnt = bookings.filter((b) => b.professionalId === absentForm.professionalId).length
                          return cnt > 0 ? (
                            <p className="text-amber-400/70 text-[11px]">{cnt} agendamento{cnt !== 1 ? 's' : ''} neste dia</p>
                          ) : null
                        })()}

                        <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={absentForm.createBlock} onChange={(e) => setAbsentForm((f) => ({ ...f, createBlock: e.target.checked }))}
                              className="accent-amber-500 w-3.5 h-3.5" />
                            <span className="text-white/60 text-xs">Bloquear agenda online no dia</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={absentForm.transfer} onChange={(e) => setAbsentForm((f) => ({ ...f, transfer: e.target.checked }))}
                              className="accent-sky-500 w-3.5 h-3.5" />
                            <span className="text-white/60 text-xs">Transferir agendamentos do dia</span>
                          </label>
                        </div>

                        {absentForm.transfer && (
                          <div>
                            <label className="text-white/40 text-[10px] uppercase tracking-widest block mb-1">Transferir para *</label>
                            <Select value={absentForm.targetProfId || 'none'} onValueChange={(v) => setAbsentForm((f) => ({ ...f, targetProfId: v === 'none' ? '' : v }))}>
                              <SelectTrigger className={`${inputClass} text-xs`}><SelectValue placeholder="Selecionar" /></SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                <SelectItem value="none">Selecionar…</SelectItem>
                                {allProfessionals.filter((p) => p.id !== absentForm.professionalId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <Button onClick={handleAbsent} disabled={creatingAbsent}
                          className="w-full bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/20 text-xs">
                          <UserMinus size={13} className="mr-1" />{creatingAbsent ? 'Processando…' : 'Registrar ausência'}
                        </Button>
                      </div>
                    </Sec>
                  )}

                  {/* Active blocks list */}
                  {(agendaSide === 'block' || agendaSide === 'absent') && blocks.length > 0 && (
                    <Sec title={`Bloqueios ativos (${blocks.length})`}>
                      <div className="space-y-1.5">
                        {blocks.map((blk) => (
                          <div key={blk.id} className="flex items-start gap-2 p-2 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
                            <div className="flex-1 min-w-0">
                              <p className="text-amber-300 text-[11px] font-semibold truncate">{blk.professional}</p>
                              <p className="text-white/40 text-[10px]">{blk.period}</p>
                              <p className="text-white/30 text-[10px] italic">{blk.reason}</p>
                            </div>
                            <button onClick={() => deleteBlock(blk.id)} className="text-white/20 hover:text-rose-400 transition-colors shrink-0 mt-0.5">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </Sec>
                  )}
                </div>
              )}
            </div>

            {/* Bloqueios ativos (quando side panel fechado ou em detail/booking) */}
            {(!agendaSide || agendaSide === 'detail' || agendaSide === 'booking') && blocks.length > 0 && (
              <Sec title={`Bloqueios ativos (${blocks.length})`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {blocks.map((blk) => (
                    <div key={blk.id} className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-300 text-xs font-semibold">{blk.professional}</p>
                        <p className="text-white/40 text-[10px]">{blk.period}</p>
                        <p className="text-white/30 text-[10px] italic">{blk.reason}</p>
                      </div>
                      <button onClick={() => deleteBlock(blk.id)} className="text-white/20 hover:text-rose-400 transition-colors shrink-0">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </Sec>
            )}

            {/* Configurações colapsáveis */}
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setConfigOpen((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                <span className="text-sm font-semibold text-white/70">Configurações da agenda</span>
                {configOpen ? <ChevronUp size={15} className="text-white/40" /> : <ChevronDown size={15} className="text-white/40" />}
              </button>
              {configOpen && (
                <div className="p-5 border-t border-white/10 grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {/* Horários */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-white/70">Horários de funcionamento</p>
                      <Button size="sm" onClick={saveBusinessHours} disabled={savingBusinessHours}
                        className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                        <Save size={12} className="mr-1" />{savingBusinessHours ? 'Salvando…' : 'Salvar'}
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {[...businessHours].sort((a, b) => (a.weekday === 0 ? 7 : a.weekday) - (b.weekday === 0 ? 7 : b.weekday)).map((h) => (
                        <div key={h.weekday} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                          <span className="text-white/60 text-xs w-8 shrink-0 font-medium">{WEEKDAYS[h.weekday]}</span>
                          {h.isClosed ? (
                            <span className="text-rose-400/60 text-xs flex-1">Fechado</span>
                          ) : (
                            <div className="flex items-center gap-2 flex-1">
                              <Input type="time" value={h.opensAt ?? ''} onChange={(e) => updateBusinessHour(h.weekday, 'opensAt', e.target.value)}
                                className={`${inputClass} w-24 h-7 text-xs`} />
                              <span className="text-white/30 text-xs">–</span>
                              <Input type="time" value={h.closesAt ?? ''} onChange={(e) => updateBusinessHour(h.weekday, 'closesAt', e.target.value)}
                                className={`${inputClass} w-24 h-7 text-xs`} />
                            </div>
                          )}
                          <Switch checked={!h.isClosed} onCheckedChange={(checked) => updateBusinessHour(h.weekday, 'isClosed', !checked)}
                            className="ml-auto data-[state=checked]:bg-rose-500 scale-75" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Configurações de agendamento + Automações */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-white/70">Agendamento online</p>
                        <Button size="sm" onClick={saveOrgSettings} disabled={savingSettings}
                          className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                          <Save size={12} className="mr-1" />{savingSettings ? 'Salvando…' : 'Salvar'}
                        </Button>
                      </div>
                      <div className="space-y-3">
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
                        <SwitchRow label="Escolha de profissional" checked={orgSettings.allowProfessionalSelection} onCheckedChange={(v) => toggleOrgSwitch('allowProfessionalSelection', v)} />
                        <SwitchRow label="Exigir sinal" checked={orgSettings.requireDeposit} onCheckedChange={(v) => toggleOrgSwitch('requireDeposit', v)} />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/70 mb-2">Automações</p>
                      <SwitchRow label="Botão WhatsApp na landing" checked={orgSettings.showWhatsappButton} onCheckedChange={(v) => toggleOrgSwitch('showWhatsappButton', v)} />
                      <SwitchRow label="Auto-confirmação por WhatsApp" checked={orgSettings.autoConfirmWhatsapp} onCheckedChange={(v) => toggleOrgSwitch('autoConfirmWhatsapp', v)} />
                      <SwitchRow label="Lista de espera inteligente" checked={orgSettings.smartWaitlist} onCheckedChange={(v) => toggleOrgSwitch('smartWaitlist', v)} />
                      <SwitchRow label="Transferência assistida" checked={orgSettings.assistedTransfer} onCheckedChange={(v) => toggleOrgSwitch('assistedTransfer', v)} />
                      <SwitchRow label="Fechamento de caixa diário" checked={orgSettings.dailyClosure} onCheckedChange={(v) => toggleOrgSwitch('dailyClosure', v)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
              <Sec
                title="Evolution + Ollama"
                action={
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={refreshWhatsappStatus} disabled={loadingWhatsappStatus}
                      className="h-7 border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
                      <RefreshCw size={12} className="mr-1" />{loadingWhatsappStatus ? 'Verificando…' : 'Status'}
                    </Button>
                    <Button size="sm" onClick={saveWhatsappSettings} disabled={savingWhatsappSettings}
                      className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                      <Save size={12} className="mr-1" />{savingWhatsappSettings ? 'Salvando…' : 'Salvar'}
                    </Button>
                  </div>
                }
              >
                <div className="space-y-4">
                  <FieldRow label="Provedor">
                    <Select value={whatsappSettings.provider} onValueChange={(v: 'evolution' | 'disabled') => setWhatsappSettings((s) => ({ ...s, provider: v }))}>
                      <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="evolution">Evolution API</SelectItem>
                        <SelectItem value="disabled">Desativado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Base URL Evolution">
                    <Input value={whatsappSettings.evolutionBaseUrl} onChange={(e) => setWhatsappSettings((s) => ({ ...s, evolutionBaseUrl: e.target.value }))} className={inputClass} placeholder="http://evolution-api:8080" />
                  </FieldRow>
                  <FieldRow label="API Key">
                    <Input value={whatsappSettings.evolutionApiKey} onChange={(e) => setWhatsappSettings((s) => ({ ...s, evolutionApiKey: e.target.value }))} className={inputClass} placeholder="apikey" />
                  </FieldRow>
                  <FieldRow label="Instância">
                    <Input value={whatsappSettings.evolutionInstanceName} onChange={(e) => setWhatsappSettings((s) => ({ ...s, evolutionInstanceName: e.target.value }))} className={inputClass} placeholder="studio-sc" />
                  </FieldRow>
                  <FieldRow label="ID da instância">
                    <Input value={whatsappSettings.evolutionInstanceId} onChange={(e) => setWhatsappSettings((s) => ({ ...s, evolutionInstanceId: e.target.value }))} className={inputClass} placeholder="Opcional" />
                  </FieldRow>
                  <FieldRow label="Webhook secret">
                    <Input value={whatsappSettings.evolutionWebhookSecret} onChange={(e) => setWhatsappSettings((s) => ({ ...s, evolutionWebhookSecret: e.target.value }))} className={inputClass} placeholder="Segredo do webhook" />
                  </FieldRow>
                  <FieldRow label="Base URL Ollama">
                    <Input value={whatsappSettings.ollamaBaseUrl} onChange={(e) => setWhatsappSettings((s) => ({ ...s, ollamaBaseUrl: e.target.value }))} className={inputClass} placeholder="http://ollama:11434" />
                  </FieldRow>
                  <FieldRow label="Modelo">
                    <Input value={whatsappSettings.ollamaModel} onChange={(e) => setWhatsappSettings((s) => ({ ...s, ollamaModel: e.target.value }))} className={inputClass} placeholder="llama3.1:8b" />
                  </FieldRow>
                  <FieldRow label="Telefone teste">
                    <Input value={whatsappSettings.testPhone} onChange={(e) => setWhatsappSettings((s) => ({ ...s, testPhone: e.target.value }))} className={inputClass} placeholder="5531999999999" />
                  </FieldRow>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <Button onClick={connectWhatsapp} disabled={connectingWhatsapp}
                      className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/20">
                      {connectingWhatsapp ? 'Conectando…' : 'Criar / Vincular instância'}
                    </Button>
                    <Button onClick={openQrCode} disabled={loadingQrCode || whatsappSettings.evolutionConnected}
                      className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/20">
                      {loadingQrCode ? 'Carregando…' : 'Conectar via QR Code'}
                    </Button>
                    <Button onClick={sendWhatsappTestMessage} disabled={testingWhatsapp}
                      className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/20">
                      {testingWhatsapp ? 'Enviando…' : 'Testar envio'}
                    </Button>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${whatsappSettings.evolutionConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span>Status: <span className={whatsappSettings.evolutionConnected ? 'text-emerald-300' : 'text-amber-300'}>{whatsappStatusText}</span></span>
                    </div>
                  </div>

                  {showQrCode && (
                    <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-violet-300">Escanear com WhatsApp</p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={fetchQrCode} disabled={loadingQrCode}
                            className="h-7 border-white/10 bg-white/5 text-white/60 hover:bg-white/10">
                            <RefreshCw size={11} className="mr-1" />{loadingQrCode ? 'Atualizando…' : 'Atualizar'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={closeQrCode}
                            className="h-7 border-white/10 bg-white/5 text-white/60 hover:bg-white/10">
                            <X size={11} />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-white/40 mb-3">Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo e escaneie o código abaixo. O QR expira em ~60s.</p>
                      {loadingQrCode && !qrCodeData && (
                        <div className="flex items-center justify-center h-48 text-white/30 text-sm">Gerando QR code…</div>
                      )}
                      {qrCodeData && (
                        <div className="flex flex-col items-center gap-3">
                          <div className="rounded-xl bg-white p-3 inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                              alt="QR Code WhatsApp"
                              width={220}
                              height={220}
                              className="block"
                            />
                          </div>
                          {qrCodePairingCode && (
                            <p className="text-xs text-white/50">Código de pareamento: <span className="font-mono text-violet-300">{qrCodePairingCode}</span></p>
                          )}
                        </div>
                      )}
                      {!loadingQrCode && !qrCodeData && (
                        <div className="flex items-center justify-center h-20 text-white/30 text-sm">QR code indisponível. A instância pode já estar conectada.</div>
                      )}
                    </div>
                  )}
                </div>
              </Sec>

              <Sec title="Agente de Atendimento">
                <div className="space-y-4">
                  <FieldRow label="Nome interno">
                    <Input value={agentBehaviorSettings.assistantName} onChange={(e) => setAgentBehaviorSettings((s) => ({ ...s, assistantName: e.target.value }))} className={inputClass} />
                  </FieldRow>
                  <FieldRow label="Mensagem inicial">
                    <Textarea value={agentBehaviorSettings.welcomeMessage} onChange={(e) => setAgentBehaviorSettings((s) => ({ ...s, welcomeMessage: e.target.value }))} className={inputClass} rows={3} />
                  </FieldRow>
                  <FieldRow label="Mensagem fallback">
                    <Textarea value={agentBehaviorSettings.fallbackMessage} onChange={(e) => setAgentBehaviorSettings((s) => ({ ...s, fallbackMessage: e.target.value }))} className={inputClass} rows={3} />
                  </FieldRow>
                  <FieldRow label="Mensagem handoff">
                    <Textarea value={agentBehaviorSettings.handoffMessage} onChange={(e) => setAgentBehaviorSettings((s) => ({ ...s, handoffMessage: e.target.value }))} className={inputClass} rows={3} />
                  </FieldRow>
                  <FieldRow label="Prompt base">
                    <Textarea value={agentBehaviorSettings.personaPrompt} onChange={(e) => setAgentBehaviorSettings((s) => ({ ...s, personaPrompt: e.target.value }))} className={inputClass} rows={8} />
                  </FieldRow>
                  <div>
                    <p className="text-sm font-semibold text-white/70 mb-2">Automações</p>
                    <SwitchRow label="Agente ativo" checked={whatsappSettings.agentEnabled} onCheckedChange={(v) => setWhatsappSettings((s) => ({ ...s, agentEnabled: v }))} />
                    <SwitchRow label="Responder automaticamente" checked={whatsappSettings.autoReplyEnabled} onCheckedChange={(v) => setWhatsappSettings((s) => ({ ...s, autoReplyEnabled: v }))} />
                    <SwitchRow label="Permitir criar/cancelar/remarcar" checked={whatsappSettings.bookingEnabled} onCheckedChange={(v) => setWhatsappSettings((s) => ({ ...s, bookingEnabled: v }))} />
                    <SwitchRow label="Handoff invisível" checked={whatsappSettings.invisibleHandoffEnabled} onCheckedChange={(v) => setWhatsappSettings((s) => ({ ...s, invisibleHandoffEnabled: v }))} />
                  </div>
                  <FieldRow label="Destino handoff">
                    <Input value={whatsappSettings.humanHandoffTarget} onChange={(e) => setWhatsappSettings((s) => ({ ...s, humanHandoffTarget: e.target.value }))} className={inputClass} placeholder="Ex: recepcao@interno ou fila-frontdesk" />
                  </FieldRow>
                </div>
              </Sec>
            </div>

            <Sec
              title="Inbox de Conversas"
              action={
                <Button size="sm" variant="outline" onClick={() => void loadWhatsappInbox()} disabled={loadingWhatsappInbox}
                  className="h-7 border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
                  <RefreshCw size={12} className="mr-1" />{loadingWhatsappInbox ? 'Atualizando…' : 'Atualizar inbox'}
                </Button>
              }
            >
              <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white/80">Conversas</p>
                      <p className="text-xs text-white/40">{whatsappInboxConversations.length} conversa(s)</p>
                    </div>
                  </div>
                  <div className="max-h-[620px] overflow-y-auto divide-y divide-white/5">
                    {whatsappInboxConversations.length === 0 && (
                      <div className="px-4 py-10 text-center text-sm text-white/35">
                        Nenhuma conversa registrada ainda.
                      </div>
                    )}
                    {whatsappInboxConversations.map((conversation) => {
                      const isActive = conversation.id === selectedWhatsappConversationId
                      const handoffLabel = conversation.handoffState === 'human'
                        ? 'Humano'
                        : conversation.handoffState === 'queued'
                          ? 'Fila'
                          : 'Bot'

                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => setSelectedWhatsappConversationId(conversation.id)}
                          className={`w-full text-left px-4 py-3 transition-colors ${isActive ? 'bg-rose-500/10' : 'hover:bg-white/[0.04]'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{conversation.contactName}</p>
                              <p className="text-[11px] text-white/40 truncate">{conversation.phone}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium border ${conversation.handoffState === 'human' ? 'border-amber-500/20 bg-amber-500/15 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/15 text-emerald-300'}`}>
                              {handoffLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-white/55 line-clamp-2">{conversation.lastMessagePreview}</p>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
                            <span>{conversation.lastMessageDirection === 'outbound' ? 'Saída' : conversation.lastMessageDirection === 'inbound' ? 'Entrada' : 'Sem histórico'}</span>
                            <span>{formatConversationMoment(conversation.lastMessageAt)}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] min-h-[620px] flex flex-col">
                  {!selectedWhatsappConversationId && (
                    <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-white/35">
                      Selecione uma conversa para visualizar o histórico e controlar o atendimento.
                    </div>
                  )}

                  {selectedWhatsappConversationId && !selectedWhatsappConversation && (
                    <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-white/35">
                      {loadingWhatsappConversation ? 'Carregando conversa…' : 'Não foi possível carregar esta conversa agora.'}
                    </div>
                  )}

                  {selectedWhatsappConversationId && selectedWhatsappConversation && (
                    <>
                      <div className="px-5 py-4 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-9 h-9">
                              <AvatarFallback className="bg-white/10 text-white text-xs">
                                {selectedWhatsappConversation.contactName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{selectedWhatsappConversation.contactName}</p>
                              <p className="text-xs text-white/40 truncate">{selectedWhatsappConversation.phone}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={selectedWhatsappConversation.handoffState === 'human' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'}>
                            {selectedWhatsappConversation.handoffState === 'human' ? <UserRound size={12} className="mr-1" /> : <Bot size={12} className="mr-1" />}
                            {selectedWhatsappConversation.handoffState === 'human' ? 'Atendimento humano' : 'Bot ativo'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={togglingWhatsappHandoff}
                            onClick={() => void updateWhatsappConversationHandoff(selectedWhatsappConversation.handoffState === 'human' ? 'agent' : 'human')}
                            className="h-8 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          >
                            {selectedWhatsappConversation.handoffState === 'human' ? 'Devolver ao bot' : 'Assumir conversa'}
                          </Button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                        {loadingWhatsappConversation && selectedWhatsappConversation.messages.length === 0 && (
                          <div className="text-sm text-white/35">Carregando conversa…</div>
                        )}
                        {selectedWhatsappConversation.messages.length === 0 && !loadingWhatsappConversation && (
                          <div className="text-sm text-white/35">Sem mensagens nessa conversa ainda.</div>
                        )}
                        {selectedWhatsappConversation.messages.map((message) => (
                          <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.direction === 'outbound' ? 'bg-rose-500/15 border border-rose-500/20 text-rose-50' : 'bg-white/5 border border-white/10 text-white/85'}`}>
                              <div className="flex items-center gap-2 mb-1 text-[11px]">
                                {message.direction === 'outbound' ? <Send size={11} /> : <MessageSquare size={11} />}
                                <span className="text-white/45">{message.direction === 'outbound' ? 'Saída' : 'Entrada'}</span>
                                <span className="text-white/30">{formatConversationMoment(message.sentAt ?? message.receivedAt ?? message.createdAt)}</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-white/10 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white/75">Responder manualmente</p>
                          <p className="text-[11px] text-white/35">
                            Ao enviar manualmente, esta conversa fica em atendimento humano.
                          </p>
                        </div>
                        <Textarea
                          value={whatsappReplyDraft}
                          onChange={(e) => setWhatsappReplyDraft(e.target.value)}
                          className={inputClass}
                          rows={4}
                          placeholder="Digite a resposta da equipe..."
                        />
                        <div className="flex items-center justify-end">
                          <Button
                            onClick={() => void sendWhatsappInboxMessage()}
                            disabled={sendingWhatsappInboxMessage || !whatsappReplyDraft.trim()}
                            className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20"
                          >
                            <Send size={14} className="mr-2" />
                            {sendingWhatsappInboxMessage ? 'Enviando…' : 'Enviar mensagem'}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Sec>
          </TabsContent>

          {/* ── Financeiro ───────────────────────────────────────────────────── */}
          <TabsContent value="financeiro" className="space-y-5 mt-0">
            <FinanceiroPanel finance={data.finance} professionals={professionals} bi={data.biAnalytics} />

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
                    {professionals.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
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
                      <td className="pt-3 text-right text-white/60 text-xs">{professionals.reduce((t, p) => t + p.bookings, 0)}</td>
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
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">

              {/* Cards da equipe */}
              <div className="space-y-3">
                {allProfessionals.length === 0 && (
                  <div className="py-12 text-center text-white/30 text-sm border border-white/10 rounded-2xl">
                    Nenhuma profissional cadastrada. Use o formulário ao lado para adicionar.
                  </div>
                )}
                {allProfessionals.map((p, i) => {
                  const color = PROF_PALETTE[i % PROF_PALETTE.length]
                  const isEditing = editingProfId === p.id
                  return (
                    <Card key={p.id} className="bg-white/[0.04] border-white/10 rounded-2xl overflow-hidden group">
                      <CardContent className="p-4">
                        {isEditing ? (
                          /* Edit mode */
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar className="w-9 h-9 shrink-0">
                                {editProfForm.photoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={editProfForm.photoUrl} alt={editProfForm.displayName || p.name} className="w-full h-full object-cover object-top" />
                                ) : (
                                  <AvatarFallback className="text-xs font-bold" style={{ background: 'oklch(0.45 0.18 15 / 0.3)', color: 'oklch(0.85 0.1 15)' }}>{p.initials}</AvatarFallback>
                                )}
                              </Avatar>
                              <p className="text-white/50 text-xs">Editando {p.name.split(' ')[0]}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Nome</label>
                                <Input value={editProfForm.displayName} onChange={(e) => setEditProfForm((f) => ({ ...f, displayName: e.target.value }))}
                                  className={`${inputClass} text-xs`} placeholder="Nome" />
                              </div>
                              <div>
                                <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Especialidade</label>
                                <Input value={editProfForm.specialty} onChange={(e) => setEditProfForm((f) => ({ ...f, specialty: e.target.value }))}
                                  className={`${inputClass} text-xs`} placeholder="Especialidade" />
                              </div>
                              <div>
                                <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Comissão %</label>
                                <Input type="number" min={0} max={100} value={editProfForm.commissionPercent} onChange={(e) => setEditProfForm((f) => ({ ...f, commissionPercent: e.target.value }))}
                                  className={`${inputClass} text-xs`} placeholder="40" />
                              </div>
                            </div>
                            <div>
                              <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Foto</label>
                              <div className="space-y-2">
                                {editProfForm.photoUrl && (
                                  <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/10">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={editProfForm.photoUrl} alt="Preview da profissional" className="w-full h-full object-cover object-top" />
                                    <button
                                      onClick={() => setEditProfForm((f) => ({ ...f, photoUrl: '' }))}
                                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white/80 text-[10px]"
                                    >✕</button>
                                  </div>
                                )}
                                <input
                                  ref={editProfPhotoInputRef}
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  className="hidden"
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProfessionalPhoto(f, 'edit') }}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={uploadingProfPhoto}
                                  onClick={() => editProfPhotoInputRef.current?.click()}
                                  className="h-7 text-xs bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                                >
                                  {uploadingProfPhoto ? 'Enviando…' : editProfForm.photoUrl ? 'Trocar foto' : 'Escolher foto'}
                                </Button>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button size="sm" onClick={saveEditProf} disabled={savingProf}
                                className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                                <Save size={11} className="mr-1" />{savingProf ? 'Salvando…' : 'Salvar'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingProfId(null)}
                                className="h-7 text-xs text-white/40 hover:text-white/70">
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <Avatar className="w-11 h-11">
                                {p.photoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover object-top" />
                                ) : (
                                  <AvatarFallback className="text-sm font-bold" style={{ background: 'oklch(0.45 0.18 15 / 0.3)', color: 'oklch(0.85 0.1 15)' }}>{p.initials}</AvatarFallback>
                                )}
                              </Avatar>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${color.dot}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                              </div>
                              <p className="text-white/40 text-xs truncate">{p.specialty || 'Profissional'}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] text-white/30">{p.bookings} atend. · <span className="text-rose-300">{p.commissionRate}% comissão</span> · <span className="text-emerald-400">{toCurrency(p.revenue)}</span></span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditProf(p)} title="Editar"
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => deleteProfessional(p.id)} disabled={deletingProfId === p.id} title="Remover"
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/20 text-white/30 hover:text-rose-400 transition-colors disabled:opacity-40">
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div className="shrink-0 text-right hidden sm:block">
                              <p className="text-white/60 text-xs font-medium">{p.occupancy}%</p>
                              <p className="text-white/25 text-[10px]">ocupação</p>
                              <Progress value={p.occupancy} className="h-1 mt-1 w-16 bg-white/10 [&>div]:bg-rose-400" />
                            </div>
                          </div>

                          {/* Link de agendamento individual */}
                          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                            <Link2 size={13} className="text-rose-300/70 shrink-0" />
                            <span className="flex-1 min-w-0 truncate text-[11px] text-white/45 font-mono">{agendaLinkFor(p.id)}</span>
                            <button
                              onClick={() => copyAgendaLink(p.id)}
                              title="Copiar link"
                              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors shrink-0"
                            >
                              <Copy size={12} /> Copiar
                            </button>
                            <button
                              onClick={() => shareAgendaWhatsApp(p.id, p.name)}
                              title="Compartilhar no WhatsApp"
                              className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25 transition-colors shrink-0"
                            >
                              <Share2 size={12} /> WhatsApp
                            </button>
                          </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Formulário: nova profissional */}
              <Sec title="Nova profissional" action={
                <Button size="sm" onClick={createProfessional} disabled={creatingProf}
                  className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                  <UserPlus size={12} className="mr-1" />{creatingProf ? 'Criando…' : 'Criar'}
                </Button>
              }>
                <div className="space-y-3">
                  <div>
                    <Label className="text-white/50 text-xs mb-1.5 block">Nome *</Label>
                    <Input placeholder="Ex: Ana Paula" value={newProfForm.displayName}
                      onChange={(e) => setNewProfForm((f) => ({ ...f, displayName: e.target.value }))}
                      className={`${inputClass} text-xs`} />
                  </div>
                  <div>
                    <Label className="text-white/50 text-xs mb-1.5 block">Especialidade</Label>
                    <Input placeholder="Ex: Unhas em gel, Cílios…" value={newProfForm.specialty}
                      onChange={(e) => setNewProfForm((f) => ({ ...f, specialty: e.target.value }))}
                      className={`${inputClass} text-xs`} />
                  </div>
                  <div>
                    <Label className="text-white/50 text-xs mb-1.5 block">Comissão (%)</Label>
                    <Input type="number" placeholder="40" min={0} max={100} value={newProfForm.commissionPercent}
                      onChange={(e) => setNewProfForm((f) => ({ ...f, commissionPercent: e.target.value }))}
                      className={`${inputClass} text-xs`} />
                  </div>
                  <div>
                    <Label className="text-white/50 text-xs mb-1.5 block">Foto</Label>
                    <div className="space-y-2">
                      {newProfForm.photoUrl && (
                        <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={newProfForm.photoUrl} alt="Preview da profissional" className="w-full h-full object-cover object-top" />
                          <button
                            onClick={() => setNewProfForm((f) => ({ ...f, photoUrl: '' }))}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white/80 text-[10px]"
                          >✕</button>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={newProfPhotoInputRef}
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProfessionalPhoto(f, 'new') }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={uploadingProfPhoto}
                        onClick={() => newProfPhotoInputRef.current?.click()}
                        className="h-7 text-xs bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                      >
                        {uploadingProfPhoto ? 'Enviando…' : newProfForm.photoUrl ? 'Trocar foto' : 'Escolher foto'}
                      </Button>
                      <p className="text-white/25 text-[10px]">JPEG, PNG, WebP · máx 5 MB</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-white/50 text-xs">Agendamento online</span>
                    <Switch checked={newProfForm.acceptsOnlineBooking}
                      onCheckedChange={(v) => setNewProfForm((f) => ({ ...f, acceptsOnlineBooking: v }))}
                      className="data-[state=checked]:bg-rose-500 scale-75" />
                  </div>
                  <p className="text-white/25 text-[10px]">Aparece na agenda e no agendamento online imediatamente.</p>
                </div>
              </Sec>
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
                        <th className="text-left pb-2 text-white/30 text-xs uppercase tracking-wider font-medium">Foto</th>
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
                            <div className="w-10 h-12 rounded-lg overflow-hidden border border-white/10 bg-white/5 shrink-0">
                              {svc.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={svc.photoUrl} alt={svc.name} className="w-full h-full object-cover object-top" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-white/25">
                                  sem foto
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-1.5">
                              {svc.isFeatured && <Star size={10} className="text-amber-400 shrink-0" />}
                              <span className="text-white/80 text-xs font-medium">{svc.name}</span>
                            </div>
                            <p className="text-white/35 text-[10px] mt-1 truncate">
                              {svc.professionalIds.length > 0 ? svc.professional : 'Sem vínculo explícito'}
                            </p>
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
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEditService(svc)}
                                className="text-white/20 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100"
                                title="Editar serviço"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => deleteServiceAndReset(svc.id)}
                                className="text-white/20 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remover serviço"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
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
                <Sec title={editingServiceId ? 'Editar serviço' : 'Novo serviço'} action={
                  <Button size="sm" onClick={saveService} disabled={creatingService}
                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                    {editingServiceId ? <Save size={12} className="mr-1" /> : <Plus size={12} className="mr-1" />}
                    {creatingService ? 'Salvando…' : editingServiceId ? 'Salvar' : 'Criar'}
                  </Button>
                }>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Foto</Label>
                      <div className="space-y-2">
                        {serviceForm.photoUrl ? (
                          <div className="relative w-full max-w-[180px] h-28 rounded-2xl overflow-hidden border border-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={serviceForm.photoUrl} alt="Preview do serviço" className="w-full h-full object-cover object-top" />
                            <button
                              type="button"
                              onClick={() => setServiceForm((f) => ({ ...f, photoUrl: '' }))}
                              className="absolute inset-0 flex items-center justify-center bg-black/35 text-white/0 hover:text-white/85 opacity-0 hover:opacity-100 transition-opacity text-[10px] font-medium"
                            >
                              Remover foto
                            </button>
                          </div>
                        ) : (
                          <div className="w-full max-w-[180px] h-28 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] flex items-center justify-center text-white/25 text-[10px]">
                            Sem foto
                          </div>
                        )}
                        <input
                          ref={servicePhotoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadServicePhoto(f) }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={uploadingServicePhoto}
                          onClick={() => servicePhotoInputRef.current?.click()}
                          className="h-7 text-xs bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                        >
                          {uploadingServicePhoto ? 'Enviando…' : serviceForm.photoUrl ? 'Trocar foto' : 'Escolher foto'}
                        </Button>
                        <p className="text-white/25 text-[10px]">JPEG, PNG, WebP · máx 5 MB</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Nome *</Label>
                      <Input
                        placeholder="Ex: Esmaltação em Gel"
                        value={serviceForm.name}
                        onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
                        className={`${inputClass} text-xs`}
                      />
                    </div>
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Categoria *</Label>
                      <Input
                        placeholder="Ex: Unhas, Cílios, Pedicure…"
                        value={serviceForm.category}
                        onChange={(e) => setServiceForm((f) => ({ ...f, category: e.target.value }))}
                        className={`${inputClass} text-xs`}
                      />
                      {(() => {
                        const cats = [...new Set(services.map((s) => s.category))].filter(Boolean)
                        if (cats.length === 0) return null
                        return (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {cats.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setServiceForm((f) => ({ ...f, category: cat }))}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                                  serviceForm.category === cat
                                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Profissionais do serviço</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {allProfessionals.map((professional) => {
                          const selected = serviceForm.professionalIds.includes(professional.id)
                          return (
                            <button
                              key={professional.id}
                              type="button"
                              onClick={() => setServiceForm((form) => ({
                                ...form,
                                professionalIds: selected
                                  ? form.professionalIds.filter((id) => id !== professional.id)
                                  : [...form.professionalIds, professional.id],
                              }))}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                                selected
                                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                  : 'bg-white/5 border-white/10 text-white/45 hover:text-white/70 hover:bg-white/10'
                              }`}
                            >
                              {professional.name}
                            </button>
                          )
                        })}
                        {allProfessionals.length === 0 && (
                          <span className="text-white/30 text-[10px]">Cadastre profissionais para vincular aos serviços.</span>
                        )}
                      </div>
                      <p className="text-white/25 text-[10px] mt-1.5">
                        Se nenhum nome for marcado, a agenda usa a regra automática por categoria e disponibilidade.
                      </p>
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
                    <div>
                      <Label className="text-white/50 text-xs mb-1.5 block">Preço (R$) *</Label>
                      <Input
                        placeholder="60,00"
                        value={serviceForm.priceCents}
                        onChange={(e) => setServiceForm((f) => ({ ...f, priceCents: e.target.value }))}
                        className={`${inputClass} text-xs`}
                      />
                    </div>
                    <div className="pt-2 space-y-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveService}
                        disabled={creatingService}
                        className="w-full h-8 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20"
                      >
                        {editingServiceId ? <Save size={12} className="mr-1" /> : <Plus size={12} className="mr-1" />}
                        {creatingService ? 'Salvando…' : editingServiceId ? 'Salvar serviço' : 'Criar serviço'}
                      </Button>
                      {editingServiceId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={resetServiceForm}
                          className="h-7 px-0 justify-start text-xs text-white/40 hover:text-white/70 hover:bg-transparent"
                        >
                          <X size={12} className="mr-1" />Cancelar edição
                        </Button>
                      )}
                    </div>
                    <p className="text-white/30 text-[10px]">O serviço aparece na landing imediatamente após salvo.</p>
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
            {(() => {
              const ROLE_COLORS: Record<string, string> = {
                admin: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
                frontdesk: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
                professional: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
              }
              const ROLE_LABELS: Record<string, string> = { admin: 'Administradora', frontdesk: 'Recepção', professional: 'Profissional' }
              const ROLES = [
                { key: 'admin', label: 'Administradora', color: ROLE_COLORS.admin, desc: 'Acesso total — finanças, equipe, configurações' },
                { key: 'frontdesk', label: 'Recepção', color: ROLE_COLORS.frontdesk, desc: 'Agenda, clientes, confirmações e transferências' },
                { key: 'professional', label: 'Profissional', color: ROLE_COLORS.professional, desc: 'Própria agenda e serviços realizados' },
              ]
              return (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {/* Left: staff list + create form */}
                  <div className="space-y-4">
                    <Sec title={`Usuários (${staffList.length})`}>
                      <div className="space-y-2">
                        {staffList.map((s) => (
                          <div key={s.id} className={`rounded-xl border transition-all ${editingStaffId === s.id ? 'border-rose-500/30 bg-rose-500/5' : 'border-white/[0.06] bg-white/[0.03]'}`}>
                            {editingStaffId === s.id ? (
                              /* ── Inline edit form ── */
                              <div className="p-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-white/50 text-[10px] mb-1 block">Nome</Label>
                                    <Input value={staffForm.fullName} onChange={(e) => setStaffForm((f) => ({ ...f, fullName: e.target.value }))} className={inputClass} />
                                  </div>
                                  <div>
                                    <Label className="text-white/50 text-[10px] mb-1 block">E-mail</Label>
                                    <Input value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-white/50 text-[10px] mb-1 block">Nova senha (opcional)</Label>
                                    <Input type="password" value={staffForm.password} onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} placeholder="deixe em branco para manter" />
                                  </div>
                                  <div>
                                    <Label className="text-white/50 text-[10px] mb-1 block">Perfil</Label>
                                    <Select value={staffForm.roleKey} onValueChange={(v) => setStaffForm((f) => ({ ...f, roleKey: v }))}>
                                      <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                        {ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-white/50 text-[10px] mb-1 block">Vincular profissional</Label>
                                  <Select value={staffForm.professionalId || '__none__'} onValueChange={(v) => setStaffForm((f) => ({ ...f, professionalId: v === '__none__' ? '' : v }))}>
                                    <SelectTrigger className={inputClass}><SelectValue placeholder="Nenhum" /></SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                      <SelectItem value="__none__">Nenhum</SelectItem>
                                      {allProfessionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <Button size="sm" onClick={saveStaff} disabled={savingStaff}
                                    className="h-7 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 flex-1">
                                    <Save size={11} className="mr-1" />{savingStaff ? 'Salvando…' : 'Salvar'}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingStaffId(null)}
                                    className="h-7 text-xs text-white/40 hover:text-white/70">
                                    <X size={11} className="mr-1" />Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              /* ── Read row ── */
                              <div className="flex items-center gap-3 p-3">
                                <Avatar className="w-9 h-9 shrink-0">
                                  <AvatarFallback className="text-xs font-bold" style={{ background: 'oklch(0.45 0.18 15 / 0.3)', color: 'oklch(0.85 0.1 15)' }}>
                                    {s.fullName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className={`text-xs font-semibold truncate ${s.isActive ? 'text-white/80' : 'text-white/30 line-through'}`}>{s.fullName}</p>
                                    {!s.isActive && <span className="text-[9px] text-white/30 border border-white/10 rounded-full px-1.5">inativo</span>}
                                  </div>
                                  <p className="text-white/40 text-[11px] truncate">{s.email}</p>
                                  {s.professionalName && (
                                    <p className="text-amber-400/60 text-[10px] truncate">profissional: {s.professionalName}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[s.roleKey] ?? 'bg-white/5 text-white/40 border-white/10'}`}>
                                    {s.roleName || ROLE_LABELS[s.roleKey] || s.roleKey}
                                  </span>
                                  <Button size="sm" variant="ghost" onClick={() => startEditStaff(s)}
                                    className="h-6 w-6 p-0 text-white/30 hover:text-white/70 hover:bg-white/5">
                                    <Pencil size={11} />
                                  </Button>
                                  {s.isActive ? (
                                    <Button size="sm" variant="ghost" onClick={() => deactivateStaff(s.id)}
                                      className="h-6 w-6 p-0 text-white/30 hover:text-rose-400 hover:bg-rose-500/10">
                                      <UserMinus size={11} />
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="ghost" onClick={() => reactivateStaff(s.id)}
                                      className="h-6 w-6 p-0 text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10">
                                      <UserPlus size={11} />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {staffList.length === 0 && (
                          <p className="text-white/30 text-xs text-center py-4">Nenhum usuário cadastrado</p>
                        )}
                      </div>
                    </Sec>

                    {/* Create new staff */}
                    <Sec title="Novo usuário">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-white/50 text-[10px] mb-1 block">Nome completo</Label>
                            <Input value={staffCreateForm.fullName} onChange={(e) => setStaffCreateForm((f) => ({ ...f, fullName: e.target.value }))} className={inputClass} placeholder="Ex: Ana Silva" />
                          </div>
                          <div>
                            <Label className="text-white/50 text-[10px] mb-1 block">E-mail</Label>
                            <Input type="email" value={staffCreateForm.email} onChange={(e) => setStaffCreateForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="ana@scstudio.com" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-white/50 text-[10px] mb-1 block">Senha</Label>
                            <Input type="password" value={staffCreateForm.password} onChange={(e) => setStaffCreateForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} placeholder="mín. 6 caracteres" />
                          </div>
                          <div>
                            <Label className="text-white/50 text-[10px] mb-1 block">Perfil</Label>
                            <Select value={staffCreateForm.roleKey} onValueChange={(v) => setStaffCreateForm((f) => ({ ...f, roleKey: v }))}>
                              <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                {ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-white/50 text-[10px] mb-1 block">Vincular profissional (opcional)</Label>
                          <Select value={staffCreateForm.professionalId || '__none__'} onValueChange={(v) => setStaffCreateForm((f) => ({ ...f, professionalId: v === '__none__' ? '' : v }))}>
                            <SelectTrigger className={inputClass}><SelectValue placeholder="Nenhum" /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10 text-white">
                              <SelectItem value="__none__">Nenhum</SelectItem>
                              {allProfessionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={createStaff} disabled={creatingStaff}
                          className="w-full h-8 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20">
                          <UserPlus size={12} className="mr-1.5" />{creatingStaff ? 'Criando…' : 'Criar usuário'}
                        </Button>
                      </div>
                    </Sec>
                  </div>

                  {/* Right: roles description + org settings */}
                  <div className="space-y-4">
                    <Sec title="Perfis de acesso">
                      {ROLES.map((role) => (
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
              )
            })()}
          </TabsContent>
        </Tabs>

        {/* ── Módulos / Footer nav ──────────────────────────────────────────── */}
        {!agendaOnly && (
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
        )}
      </div>
    </div>
  )
}
