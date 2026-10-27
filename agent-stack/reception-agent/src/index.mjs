import http from 'node:http'
import fs from 'node:fs'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || '3005')
const APP_BASE_URL = (process.env.APP_BASE_URL || 'http://scstudio-app:3000').replace(/\/+$/, '')
const AUTH_TOKEN = process.env.AGENT_INTERNAL_TOKEN || ''
const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
const EXTRACT_MODEL = process.env.EXTRACT_MODEL || 'gemini-2.5-flash'
const PIX_KEY = process.env.PIX_KEY || '27.333.912/0001-31'
const PIX_THRESHOLD_CENTS = 3500
const AGENT_V2_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(process.env.AGENT_V2_ENABLED || '').toLowerCase())

// ─────────────────────────────────────────────────────────────────────────────
// Persona
// ─────────────────────────────────────────────────────────────────────────────
const PERSONA = `Você é a Julia, atendente do SC Studio & Esmalteria, respondendo pelo WhatsApp.
Você é carismática, educada e calorosa. As clientes adoram falar com você.
Escreva exatamente como uma atendente humana, simpática e animada escreveria no WhatsApp:
- Linguagem informal, calorosa e natural do dia a dia brasileiro
- Mensagens curtas (no máximo 3 linhas), diretas e acolhedoras
- Use o nome da cliente quando souber, faz a conversa muito mais pessoal
- NUNCA use listas numeradas, menus ou bullet points
- NUNCA use formatação de chatbot
- NUNCA use travessão (—) nas mensagens, prefira vírgulas ou frases separadas
- Emojis com moderação e naturalidade, só quando cair bem
- Seja sempre positiva, animada e faça a pessoa se sentir bem-vinda
- Quando a cliente fizer algo certo (confirmar, pagar, etc.) elogie brevemente
- Nunca deixe a pessoa sem resposta ou sem uma próxima orientação clara
- NUNCA chame a cliente de "minha amiga", "minha querida", "amiga", "querida" ou qualquer apelido. Use apenas o nome dela ou nada.
- SEMPRE use acentuação correta do português: é, só, está, você, também, não, horário, serviço, confirmação, pagamento, etc. NUNCA omita acentos.
- NUNCA comece uma resposta com "Oi", "Olá", "Boa noite" ou qualquer saudação se o histórico já tiver mensagens — a conversa já está em andamento, vá direto ao ponto.`

// ─────────────────────────────────────────────────────────────────────────────
// State (in-memory com persistência em disco, 30-min TTL)
// ─────────────────────────────────────────────────────────────────────────────
const STATE_TTL_MS = 30 * 60 * 1000
const STATE_FILE = process.env.STATE_FILE || '/app/data/conversations.json'
const conversations = new Map()

// Carrega estado do disco ao iniciar (sobrevive a restarts)
function loadPersistedState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const saved = JSON.parse(raw)
    const now = Date.now()
    let loaded = 0
    for (const [k, v] of Object.entries(saved)) {
      if (now - (v.lastActive || 0) < STATE_TTL_MS) {
        conversations.set(k, v)
        loaded++
      }
    }
    if (loaded) console.log(`[state] ${loaded} conversas restauradas do disco`)
  } catch { /* arquivo não existe ainda — OK */ }
}

// Salva estado no disco (exclui dados dinâmicos grandes como services/contact)
function persistState() {
  try {
    const obj = {}
    for (const [k, v] of conversations) {
      obj[k] = {
        phase: v.phase,
        g: v.g,
        bookingId: v.bookingId,
        paymentMessage: v.paymentMessage,
        priceCents: v.priceCents,
        activeBookings: v.activeBookings,
        selectedBooking: v.selectedBooking,
        history: v.history,
        lastActive: v.lastActive,
        whatsappName: v.whatsappName,
      }
    }
    fs.mkdirSync(STATE_FILE.replace(/\/[^/]+$/, ''), { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(obj))
  } catch (e) { console.error('[state] Erro ao salvar:', e.message) }
}

// Migra conversas antigas (state machine) para novo formato (phase + g)
function migrateConv(conv) {
  if (conv.phase !== undefined) return conv
  const d = conv.data || {}
  const st = conv.state || 'idle'
  conv.phase = st === 'await_payment' ? 'payment'
    : ['await_cancel_select', 'await_cancel_confirm'].includes(st) ? 'cancel'
    : st === 'await_confirm' ? 'confirm' : 'booking'
  conv.g = {
    service: d.service || null, bundleServices: d.bundleServices || null,
    combinedService: d.combinedService || null, date: d.date || null,
    slots: d.slots || null, slotAssignments: d.slotAssignments || null,
    time: d.time || null, name: d.customerName || null, professional: d.professional || null,
  }
  conv.bookingId = d.bookingId || null
  conv.paymentMessage = d.paymentMessage || null
  conv.priceCents = d.priceCents || null
  conv.activeBookings = d.activeBookings || null
  conv.selectedBooking = d.selectedBooking || null
  delete conv.state; delete conv.data
  return conv
}

loadPersistedState()
setInterval(persistState, 20000)          // salva a cada 20s
process.on('SIGTERM', () => { persistState(); process.exit(0) })
process.on('SIGINT',  () => { persistState(); process.exit(0) })

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of conversations) if (now - v.lastActive > STATE_TTL_MS) conversations.delete(k)
}, 10 * 60 * 1000)

function getConv(id) {
  const c = conversations.get(id)
  if (c) { c.lastActive = Date.now(); return migrateConv(c) }
  return { phase: 'booking', g: {}, history: [], lastActive: Date.now() }
}
function saveConv(id, conv) { conv.lastActive = Date.now(); conversations.set(id, conv) }
function resetConv(id) {
  const c = conversations.get(id)
  if (c) c._reset = true  // prevent handleInbound from re-saving after reset
  conversations.delete(id)
}
function pushHistory(conv, from, text) {
  if (!conv.history) conv.history = []
  conv.history.push({ from, text: text.slice(0, 400) })
  if (conv.history.length > 15) conv.history.splice(0, conv.history.length - 15)
}

function greeting() {
  // Fuso de Brasília: UTC-3
  const h = (new Date().getUTCHours() - 3 + 24) % 24
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────────────────────
function jsonRes(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}
async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks).toString('utf8')
  return body ? JSON.parse(body) : {}
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────
async function callApp(path, opts = {}) {
  const res = await fetch(`${APP_BASE_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_TOKEN}`, ...(opts.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function forwardWebhookToApp(payload) {
  const res = await fetch(`${APP_BASE_URL}/api/webhooks/evolution`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

let _studioCache = null
let _studioCacheAt = 0
const STUDIO_CACHE_TTL = 30 * 60 * 1000

async function fetchStudio(force = false) {
  if (!force && _studioCache && Date.now() - _studioCacheAt < STUDIO_CACHE_TTL) return _studioCache
  const r = await callApp('/api/agent/services')
  if (!r.ok) return _studioCache || { services: [], contact: null, businessHours: [], requireDeposit: false }
  _studioCache = {
    services: r.data.services || [],
    contact: r.data.contact || null,
    businessHours: r.data.businessHours || [],
    requireDeposit: r.data.requireDeposit ?? false,
    testimonials: r.data.testimonials || [],
  }
  _studioCacheAt = Date.now()
  return _studioCache
}
async function getAvailability(serviceIdOrIds, date) {
  const ids = Array.isArray(serviceIdOrIds) ? serviceIdOrIds : [serviceIdOrIds]
  const params = ids.map(id => `serviceId=${encodeURIComponent(id)}`).join('&')
  const r = await callApp(`/api/agent/availability?${params}&date=${date}`)
  return r.ok ? r.data : null
}

// Extrai nome de profissional pedida pela cliente ("com a Suellen", "com a Kelly")
function extractRequestedProfessional(text, professionals = []) {
  const t = norm(text)
  // "com a Suellen", "com o João", "pela Suellen", "atendimento com Suellen"
  const m = t.match(/\b(?:com a?|pela?|atendimento com|quero a?|feito por)\s+([a-z]+)/i)
  if (m) {
    const requested = m[1].toLowerCase()
    const found = professionals.find(p => norm(p.displayName || p.name || '').startsWith(requested) || norm(p.displayName || p.name || '').includes(requested))
    if (found) return found
  }
  // Tenta direto: nome próprio depois de "com"
  for (const prof of professionals) {
    const pname = norm(prof.displayName || prof.name || '')
    const firstName = pname.split(' ')[0]
    if (firstName.length > 2 && t.includes(firstName)) return prof
  }
  return null
}

// Descreve os profissionais de um slot de bundle (ex: "pé com Kelly e mão com Suellen")
function describeBundleSlot(assignments = []) {
  if (!assignments.length) return ''
  const unique = [...new Map(assignments.map(a => [a.professionalId, a])).values()]
  if (unique.length === 1) return `com a ${unique[0].professionalName}`
  return assignments.map(a => `${a.serviceName} com ${a.professionalName}`).join(' e ')
}

// Filtra slots para profissional específica, com fallback para todos os slots
function slotsForProfessional(avail, professional) {
  if (!professional || !avail?.professionals?.length) return avail?.allAvailableSlots || []
  const prof = avail.professionals.find(p =>
    norm(p.displayName || p.name || '') === norm(professional.displayName || professional.name || '')
  )
  return prof?.availableSlots?.length ? prof.availableSlots : avail?.allAvailableSlots || []
}
async function createBooking(payload) { return callApp('/api/agent/bookings', { method: 'POST', body: JSON.stringify(payload) }) }
async function getCustomerBookings(phone) {
  const r = await callApp(`/api/agent/customer-bookings?phone=${encodeURIComponent(phone)}`)
  return r.ok ? (r.data.bookings || []) : []
}
async function cancelBookingById(id) { return callApp(`/api/agent/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }) }
async function sendMessage(phone, message) { return callApp('/api/agent/send-message', { method: 'POST', body: JSON.stringify({ phone, message }) }) }
async function getPendingCustomerConfirmation(phone) {
  const r = await callApp(`/api/agent/customer-confirmations?phone=${encodeURIComponent(phone)}`)
  return r.ok ? (r.data.pending || null) : null
}
async function registerCustomerConfirmationResponse(bookingId, response) {
  return callApp(`/api/agent/customer-confirmations/${bookingId}`, {
    method: 'POST',
    body: JSON.stringify({ response }),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini — usa generateContent com system_instruction separado
// ─────────────────────────────────────────────────────────────────────────────
async function geminiChat(messages, fallback = null) {
  try {
    const systemMsg = messages.find(m => m.role === 'system')
    const convMsgs = messages.filter(m => m.role !== 'system')
    const body = {
      ...(systemMsg ? { system_instruction: { parts: [{ text: systemMsg.content }] } } : {}),
      contents: convMsgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      }
    )
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[gemini] error:', res.status, errText.slice(0, 300))
      return fallback
    }
    const d = await res.json()
    const text = String(d.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    return text || fallback
  } catch (e) {
    console.error('[gemini] exception:', e.message)
    return fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM extraction — entende intenção, extrai campos, detecta perguntas embutidas
// ─────────────────────────────────────────────────────────────────────────────
const EXTRACT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: { type: 'STRING', enum: ['agendar','cancelar','confirmar','negar','mudar_data','mudar_servico','add_servico','info','saudacao','elogio','reclamacao','outro'] },
    service: { type: 'STRING', nullable: true },
    is_pe_e_mao: { type: 'BOOLEAN' },
    date_iso: { type: 'STRING', nullable: true },
    time_hhmm: { type: 'STRING', nullable: true },
    name: { type: 'STRING', nullable: true },
    professional: { type: 'STRING', nullable: true },
    period: { type: 'STRING', enum: ['manha', 'tarde', 'noite'], nullable: true },
    question: { type: 'STRING', nullable: true },
    change_field: { type: 'STRING', enum: ['servico', 'data', 'horario'], nullable: true },
  },
  required: ['intent', 'is_pe_e_mao'],
}

async function extractWithLLM(text, services, g, history = []) {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const todayISO = toIso(brt)
  const wd = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'][brt.getDay()]
  const svcNames = services.map(s => `"${s.name}"`).join(', ')
  const known = []
  if (g.service) known.push(`serviço:"${g.bundleServices?.length > 1 ? g.bundleServices.map(s=>s.name).join('+') : g.service.name}"`)
  if (g.date) known.push(`data:${g.date}`)
  if (g.time) known.push(`horário:${g.time}`)
  if (g.name) known.push(`nome:"${g.name}"`)
  const hist = (history || []).slice(-6).map(h => `${h.from === 'user' ? 'C' : 'A'}: ${h.text.slice(0, 180)}`).join('\n')

  const prompt = `Hoje: ${wd} ${todayISO} (Brasília UTC-3).
Serviços disponíveis: ${svcNames}
Já coletado: ${known.length ? known.join(', ') : 'nada'}
${hist ? `Histórico:\n${hist}\n` : ''}Mensagem: "${text}"

Retorne SOMENTE JSON (sem markdown):
{"service":str|null,"is_pe_e_mao":bool,"date_iso":"YYYY-MM-DD"|null,"time_hhmm":"HH:MM"|null,"name":str|null,"professional":str|null,"period":"manha"|"tarde"|"noite"|null,"intent":"agendar"|"cancelar"|"confirmar"|"negar"|"mudar_data"|"mudar_servico"|"info"|"saudacao"|"elogio"|"reclamacao"|"despedida"|"outro","question":str|null,"change_field":"servico"|"data"|"horario"|null}

Regras:
- service: nome EXATO da lista ou null
- is_pe_e_mao: true SOMENTE se a cliente mencionar explicitamente "pé" + "mão"/"manicure"/"manicura" juntos. "manutenção" é um serviço de unhas diferente de "mão" — NUNCA marque is_pe_e_mao=true quando aparecer "manutenção" sem "mão" explícito. Exemplos: "pé e mão"→true, "manicure e pedicure"→true, "manutenção e pé"→false, "manutenção"→false.
- date_iso: resolva "sexta", "amanhã", "dia 30" → YYYY-MM-DD usando hoje como ref
- time_hhmm: resolva "pelas 10", "meio-dia", "10h30", "as 14", "às 14 tem", "tem as 9", "14h tem" → HH:MM. "as 14 tem" = 14:00
- name: nome para agendamento (ignore saudações e palavras genéricas)
- intent: ação principal. "agendar"=quer marcar/reservar; TAMBÉM use "agendar" quando a frase é "tem horário para X?", "tem vaga?", "tem disponibilidade?", "dá pra marcar X?" seguida de serviço ou data — isso é intenção de agendamento, NÃO info. "cancelar"=quer cancelar. "confirmar"=aceita a proposta. "negar"=recusa/não quer. "mudar_data"=quer trocar a data. "mudar_servico"=quer trocar o serviço. "add_servico"=quer INCLUIR/ADICIONAR um serviço a um booking já em andamento (ex: "tem como incluir a mão?", "pode adicionar o pé também?", "quero fazer a mão junto", "coloca a manicure também", "fazer a mão no mesmo horário"). Use "add_servico" quando já existe contexto de booking parcial e a cliente quer agregar outro serviço, especialmente combinações pé+mão. "info"=pergunta sobre preço, endereço, formas de pagamento, profissionais, horário de funcionamento, instagram, listagem de serviços disponíveis (ex: "quais serviços vocês oferecem?") — informação geral sem data ou serviço implícito. "saudacao"=só cumprimentou. "elogio"=elogio ao salão. "reclamacao"=reclamação. "despedida"=se despediu, disse obrigada encerrando, tchau, valeu, finalizou a conversa. "outro"=resto.
- question: pergunta embutida que precisa de resposta além da ação principal
- change_field: se quer MUDAR algo já definido ("na verdade muda pra sábado" → "data")`

  try {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EXTRACT_MODEL}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) }
    )
    if (!res.ok) return {}
    const d = await res.json()
    const raw = String(d.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean)
    console.log(`[llm-extract] intent=${parsed.intent} svc=${parsed.service} date=${parsed.date_iso} time=${parsed.time_hhmm} q=${parsed.question || '-'}`)
    return parsed
  } catch (e) {
    console.error('[llm-extract] err:', e.message)
    return {}
  }
}

// Guias de sistema — usados apenas nas fases de payment e cancel (booking usa prompts dinâmicos)
const STATE_GUIDES = {
  payment:        'AGORA: o agendamento está criado e separado. Aguarde o comprovante de pagamento PIX. Se a cliente fizer perguntas, responda e lembre sutilmente do PIX.',
  cancel_select:  'AGORA: ajude a cliente a identificar qual agendamento ela quer cancelar, mencionando os agendamentos ativos de forma natural.',
  cancel_confirm: 'AGORA: confirme se a cliente tem certeza que quer cancelar este agendamento específico antes de cancelar.',
}

function stripLeadingGreeting(text) {
  // Remove greeting sentence at the start (Oi!, Olá!, Boa noite!, etc.)
  const stripped = text.replace(/^(oi|olá|ola|bom\s+dia|boa\s+tarde|boa\s+noite|hey)\b[^!\n]*[!\n]\s*/i, '').trim()
  return stripped || text
}

// histOrConv pode ser: array de histórico OU objeto conv (com .history e .state)
async function reply(task, context, fallback, histOrConv = [], stateHint = 'idle') {
  let history = histOrConv
  let state = stateHint
  if (histOrConv && !Array.isArray(histOrConv) && typeof histOrConv === 'object') {
    history = histOrConv.history || []
    // support both old (conv.state) and new (conv.phase) format
    state = histOrConv.phase || histOrConv.state || stateHint
  }

  const hasHistory = (history || []).length > 0
  const stateGuide = STATE_GUIDES[state] ? `\n\n${STATE_GUIDES[state]}` : ''
  const noGreet = hasHistory
    ? '\n\nREGRA ABSOLUTA: PROIBIDO começar a resposta com "Oi", "Olá", "Boa noite", "Bom dia", "Boa tarde", "Hey" ou qualquer variação — a conversa já está em andamento, vá direto ao assunto.'
    : ''
  const sysContent = `${PERSONA}${stateGuide}${noGreet}${context ? `\n\nContexto:\n${context}` : ''}`

  const messages = [{ role: 'system', content: sysContent }]
  for (const h of (history || []).slice(-12)) {
    messages.push({ role: h.from === 'user' ? 'user' : 'assistant', content: h.text })
  }
  messages.push({ role: 'user', content: task })

  const r = await geminiChat(messages, fallback)
  let result = r || fallback
  if (hasHistory && result) result = stripLeadingGreeting(result)
  return result
}

async function extract(question, userText, fallback = '') {
  const messages = [
    { role: 'system', content: 'Você é um extrator de dados preciso. Responda APENAS com o valor pedido, sem explicação, sem pontuação extra. Se não conseguir identificar com certeza, responda exatamente: ?' },
    { role: 'user', content: `${question}\n\nMensagem da pessoa: "${userText}"` },
  ]
  const r = await geminiChat(messages, '?')
  return (r && r !== '?') ? r.trim() : fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Studio context
// ─────────────────────────────────────────────────────────────────────────────
// Retorna contexto do agendamento atual (suporta novo formato conv.g e legado conv.data)
function bookingCtx(conv) {
  const d = conv.g || conv.data || {}
  const parts = []
  const svcName = d.bundleServices?.length > 1
    ? d.bundleServices.map(s => s.name).join(' e ')
    : d.service?.name
  if (svcName) parts.push(`Serviço: ${svcName}`)
  if (d.date) parts.push(`Data: ${formatDatePt(d.date)}`)
  if (d.slots?.length && !d.time) parts.push(`Horários disponíveis: ${slotsToNatural(d.slots)}`)
  if (d.time) parts.push(`Horário: ${d.time}`)
  const name = d.name || d.customerName
  if (name) parts.push(`Nome da cliente: ${name}`)
  if (d.time && d.bundleServices?.length > 1) {
    const assignments = d.slotAssignments?.[d.time] || []
    const uniqueProfs = new Set(assignments.map(a => a.professionalId))
    if (uniqueProfs.size >= 2) {
      const dur = bundleParallelDuration(d.bundleServices)
      if (dur) parts.push(`Duração: ~${dur} (2 profissionais trabalham ao mesmo tempo)`)
      parts.push(`Profissionais: ${describeBundleSlot(assignments)}`)
    } else {
      const seqMins = d.bundleServices.map(s => parseDurationMins(s.duration)).filter(Boolean).reduce((a,b)=>a+b,0)
      if (seqMins) {
        const h = Math.floor(seqMins/60), m = seqMins%60
        const seqDur = h ? `${h}h${m||''}` : `${m}min`
        parts.push(`Duração: ~${seqDur} (1 profissional, em sequência)`)
      }
      if (assignments.length) parts.push(`Profissional: ${assignments[0]?.professionalName || ''}`)
    }
  } else if (d.professional?.name) {
    parts.push(`Profissional: ${d.professional.name}`)
  }
  return parts.join(' | ')
}

function buildStudioCtx(services, contact, businessHours = [], testimonials = []) {
  const DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

  const svcList = services.length
    ? services.map(s => {
        const profs = s.professionals?.length
          ? ` — atendido por: ${s.professionals.map(p => p.name).join(', ')}`
          : ''
        const desc = s.description && s.description.toLowerCase().trim() !== s.name.toLowerCase().trim()
          ? ` (${s.description.slice(0, 90)})`
          : ''
        return `• ${s.name}: ${s.price}, duração ${s.duration}${profs}${desc}`
      }).join('\n')
    : 'Serviços não disponíveis no momento'

  const lines = [`Serviços do SC Studio & Esmalteria:\n${svcList}`]

  if (businessHours?.length) {
    const hoursStr = businessHours
      .map(h => h.isClosed
        ? `${DAYS[h.weekday]}: fechado`
        : `${DAYS[h.weekday]}: ${h.opensAt} às ${h.closesAt}`)
      .join(', ')
    lines.push(`Horários de funcionamento: ${hoursStr}`)
  }

  if (contact?.whatsappDisplay || contact?.phone) lines.push(`WhatsApp/tel: ${contact.whatsappDisplay || contact.phone}`)
  if (contact?.addressText) lines.push(`Endereço: ${contact.addressText}`)
  if (contact?.instagramHandle) lines.push(`Instagram: @${contact.instagramHandle}`)

  if (testimonials?.length) {
    const top = testimonials.slice(0, 2)
    lines.push(`Depoimentos reais de clientes: ${top.map(t => `"${t.body.slice(0, 100)}" — ${t.authorName}`).join(' | ')}`)
  }

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// PIX
// ─────────────────────────────────────────────────────────────────────────────
function calcPixAmount(priceCents) {
  if (priceCents > PIX_THRESHOLD_CENTS) return { cents: Math.round(priceCents * 0.5), label: '50% de entrada' }
  return { cents: priceCents, label: 'valor integral' }
}
function formatBRL(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}
function buildPixMessage(priceCents) {
  const { cents, label } = calcPixAmount(priceCents)
  return `Para confirmar seu agendamento, a gente pede o ${label} via PIX 😊\n\nValor: *${formatBRL(cents)}*\nChave PIX: *${PIX_KEY}*\n\nAssim que fizer o pagamento, me manda o comprovante aqui!`
}

// ─────────────────────────────────────────────────────────────────────────────
// Date / time helpers
// ─────────────────────────────────────────────────────────────────────────────
const WEEKDAYS_PT = { domingo:0, segunda:1,'segunda-feira':1, terca:2,'terca-feira':2, quarta:3,'quarta-feira':3, quinta:4,'quinta-feira':4, sexta:5,'sexta-feira':5, sabado:6 }
const MONTHS_PT = { janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 }

function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim() }
function toIso(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

function parseDate(text) {
  const t = norm(text)
  const today = new Date(); today.setHours(0,0,0,0)
  if (/\bhoje\b/.test(t)) return toIso(today)
  if (/depois de amanha/.test(t)) { const d=new Date(today); d.setDate(d.getDate()+2); return toIso(d) }
  if (/\bamanha\b/.test(t)) { const d=new Date(today); d.setDate(d.getDate()+1); return toIso(d) }
  // fim de semana / fds → próximo sábado
  if (/\b(fim de semana|fds|esse fds|nesse fds|final de semana)\b/.test(t)) {
    const d = new Date(today)
    const diff = (6 - d.getDay() + 7) % 7 || 7
    d.setDate(d.getDate() + diff)
    return toIso(d)
  }
  // "essa semana" → interpretado como hoje (próximos dias, o cliente especifica depois)
  // "semana que vem" / "próxima semana" → segunda-feira seguinte
  if (/\b(semana que vem|proxima semana|semana passada)\b/.test(t)) {
    const d = new Date(today)
    const toNextMon = (8 - d.getDay()) % 7 || 7
    d.setDate(d.getDate() + toNextMon)
    return toIso(d)
  }
  // "dia 28", "dia 30" → mesmo mês ou próximo
  const diaMatch = t.match(/\bdia\s+(\d{1,2})\b/)
  if (diaMatch) {
    const day = parseInt(diaMatch[1])
    const d = new Date(today.getFullYear(), today.getMonth(), day)
    if (d < today) d.setMonth(d.getMonth() + 1)
    if (!isNaN(d.getTime()) && day >= 1 && day <= 31) return toIso(d)
  }
  const dm = t.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
  if (dm) {
    let y = dm[3] ? parseInt(dm[3]) : today.getFullYear()
    if (y < 100) y += 2000
    const d = new Date(y, parseInt(dm[2])-1, parseInt(dm[1]))
    if (!isNaN(d.getTime()) && d >= today) return toIso(d)
  }
  const mMatch = t.match(/(\d{1,2})\s+de\s+([a-z]+)/)
  if (mMatch) {
    const month = MONTHS_PT[mMatch[2]]
    if (month) {
      const d = new Date(today.getFullYear(), month-1, parseInt(mMatch[1]))
      if (d < today) d.setFullYear(d.getFullYear()+1)
      return toIso(d)
    }
  }
  const isNext = /pr[oó]xim[ao]|semana que vem/.test(t)
  for (const [name, wday] of Object.entries(WEEKDAYS_PT)) {
    if (t.includes(name)) {
      const d = new Date(today)
      const diff = ((wday - d.getDay()) + 7) % 7
      d.setDate(d.getDate() + (diff === 0 ? 7 : diff) + (isNext ? 7 : 0))
      return toIso(d)
    }
  }
  return null
}

function formatDatePt(iso) {
  const [y,m,day] = iso.split('-').map(Number)
  const d = new Date(y, m-1, day)
  const wd = ['domingo','segunda-feira','terca-feira','quarta-feira','quinta-feira','sexta-feira','sabado']
  const mo = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  return `${wd[d.getDay()]}, ${day} de ${mo[m-1]}`
}

function slotTime(slot) {
  const [h, min] = slot.split(':')
  return min === '00' ? `${parseInt(h)}h` : `${parseInt(h)}h${min}`
}

function slotsToNatural(slots) {
  return slots.map(slotTime).join(', ').replace(/,([^,]*)$/, ' e$1')
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic message builders — zero LLM, zero hallucination
// ─────────────────────────────────────────────────────────────────────────────

function calcEffectiveDuration(bundleServices, assignments) {
  if (!bundleServices?.length) return null
  const uniqueProfs = new Set((assignments || []).map(a => a.professionalId)).size
  if (uniqueProfs >= 2) return bundleParallelDuration(bundleServices)
  const m = bundleServices.map(s => parseDurationMins(s.duration)).filter(Boolean).reduce((a,b)=>a+b,0)
  if (!m) return null
  const h = Math.floor(m/60), min = m%60
  return h ? `${h}h${min||''}` : `${m}min`
}

// Listagem de horários — nunca varia, nunca mente
function buildSlotListMsg(g, clientName) {
  const isBundle = g.bundleServices?.length > 1
  const slots = g.slots || []
  const dateStr = formatDatePt(g.date)
  const svcLabel = isBundle
    ? g.bundleServices.map(s => s.name).join(' + ')
    : g.service?.name
  const clientFirst = clientName ? clientName.split(' ')[0] : null
  const nameStr = clientFirst ? `${clientFirst}, ` : ''
  const para = nameStr ? 'para' : 'Para'
  const svcChunk = svcLabel ? `${para} *${svcLabel}* no ${dateStr}` : (nameStr ? `no ${dateStr}` : `No ${dateStr}`)

  if (isBundle && g.slotAssignments && Object.keys(g.slotAssignments).length) {
    const { dual, single } = categorizeBundleSlots(slots, g.slotAssignments)
    const parallelDur = bundleParallelDuration(g.bundleServices)
    const seqMins = g.bundleServices.map(s => parseDurationMins(s.duration)).filter(Boolean).reduce((a,b)=>a+b,0)
    const seqDur = seqMins >= 60 ? `${Math.floor(seqMins/60)}h${seqMins%60||''}` : `${seqMins}min`
    const lines = [`${nameStr}${svcChunk} tem:`]
    if (dual.length) lines.push(`✅ Com 2 profissionais (~${parallelDur}): ${slotsToNatural(dual)}`)
    if (single.length) lines.push(`👤 Com 1 profissional (~${seqDur}): ${slotsToNatural(single)}`)
    lines.push('\nQual horário prefere?')
    return lines.join('\n')
  }

  if (shouldAskPeriod(slots)) {
    const manha = filterSlotsByPeriod(slots, 'manha')
    const tarde = filterSlotsByPeriod(slots, 'tarde')
    const lines = [`${nameStr}${svcChunk} temos:`]
    if (manha.length) lines.push(`☀️ Manhã: ${slotsToNatural(manha)}`)
    if (tarde.length) lines.push(`🌤️ Tarde: ${slotsToNatural(tarde)}`)
    lines.push('\nQual prefere?')
    return lines.join('\n')
  }

  return `${nameStr}${svcChunk} temos: ${slotsToNatural(slots)}\n\nQual prefere?`
}

// Pedido de confirmação — monta tudo do g, nada inventado
function buildConfirmMsg(g, clientName) {
  const isBundle = g.bundleServices?.length > 1
  const svcLabel = isBundle ? g.bundleServices.map(s => s.name).join(' e ') : g.service?.name
  const assignments = isBundle ? (g.slotAssignments?.[g.time] || []) : []
  const profLine = isBundle && assignments.length
    ? describeBundleSlot(assignments)
    : (g.professional ? `com ${g.professional.displayName || g.professional.name}` : '')
  const dur = isBundle ? calcEffectiveDuration(g.bundleServices, assignments) : null
  const name = clientName || g.name

  const lines = ['Fica assim:']
  lines.push(`📋 *${svcLabel}*${profLine ? `\n👥 ${profLine}` : ''}`)
  lines.push(`📅 ${formatDatePt(g.date)} às ${g.time}${dur ? ` (~${dur})` : ''}`)
  if (name) lines.push(`👤 ${name}`)
  lines.push('\nConfirma? 😊')
  return lines.join('\n')
}

// Booking criado com sucesso — determinístico
function buildSuccessMsg(g, clientName) {
  const isBundle = g.bundleServices?.length > 1
  const svcLabel = isBundle ? g.bundleServices.map(s => s.name).join(' e ') : g.service?.name
  const assignments = isBundle ? (g.slotAssignments?.[g.time] || []) : []
  const profLine = isBundle && assignments.length
    ? describeBundleSlot(assignments)
    : (g.professional ? `com ${g.professional.displayName || g.professional.name}` : '')
  const dur = isBundle ? calcEffectiveDuration(g.bundleServices, assignments) : null
  const name = (clientName || g.name || '').split(' ')[0]

  const lines = ['Reservado! ✅']
  lines.push(`📋 *${svcLabel}*${profLine ? `\n👥 ${profLine}` : ''}`)
  lines.push(`📅 ${formatDatePt(g.date)} às ${g.time}${dur ? ` (~${dur})` : ''}`)
  lines.push(`\nTe esperamos lá${name ? `, ${name}` : ''}! 😊`)
  return lines.join('\n')
}

// Mensagem PIX — determinística
function buildPixRequestMsg(priceCents) {
  const { cents, label } = calcPixAmount(priceCents)
  return `Agora é só garantir com o sinal! 💰\n\nValor: *${formatBRL(cents)}* (${label})\nChave PIX: *${PIX_KEY}*\n\nMe manda o comprovante aqui quando fizer que confirmo na hora! 😊`
}

// Converte "40min", "1h", "1h10", "1h10min" para minutos
function parseDurationMins(str) {
  if (!str) return null
  const s = String(str).toLowerCase()
  const h = s.match(/(\d+)\s*h/)
  const m = s.match(/(\d+)\s*min/)
  const total = (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0)
  return total || null
}

// Para bundle com 2 profissionais simultâneas: duração efetiva = max das durações individuais
function bundleParallelDuration(bundleServices) {
  if (!bundleServices?.length) return null
  const mins = bundleServices.map(s => parseDurationMins(s.duration)).filter(Boolean)
  if (!mins.length) return null
  const maxMin = Math.max(...mins)
  if (maxMin >= 60) {
    const h = Math.floor(maxMin / 60)
    const m = maxMin % 60
    return m ? `${h}h${m}min` : `${h}h`
  }
  return `${maxMin}min`
}

// Para bundle: separa slots com 2 profissionais simultâneas vs 1
function categorizeBundleSlots(slots, slotAssignments) {
  const dual = [], single = []
  for (const s of slots) {
    const assignments = slotAssignments?.[s] || []
    const uniqueProfs = new Set(assignments.map(a => a.professionalId))
    if (uniqueProfs.size >= 2) dual.push(s)
    else single.push(s)
  }
  return { dual, single }
}

// Descreve um slot com suas profissionais: "8h (pé com Kelly e mão com Suellen)"
function slotWithProfs(slot, slotAssignments) {
  const assignments = slotAssignments?.[slot] || []
  const desc = describeBundleSlot(assignments)
  return desc ? `${slotTime(slot)} (${desc})` : slotTime(slot)
}

// Filtra slots por período do dia
function detectPeriod(text) {
  const t = norm(text)
  if (/\b(manha|cedo|começo|primeiro horario|abertura|mais cedo|hora do almoco)\b/.test(t)) return 'manha'
  if (/\b(tarde|pos almoco|depois do almoco|meio da tarde)\b/.test(t)) return 'tarde'
  if (/\b(noite|fim do dia|ultimo horario|mais tarde|final)\b/.test(t)) return 'noite'
  return null
}

function countByPeriod(slots) {
  let morning = 0, afternoon = 0, night = 0
  for (const s of slots) {
    const h = parseInt(s.split(':')[0])
    if (h < 12) morning++
    else if (h < 18) afternoon++
    else night++
  }
  return { morning, afternoon, night }
}

// Só pergunta manhã/tarde se ambos os períodos tiverem horários suficientes
// Se um período tiver poucos slots (< 4), mostra tudo de uma vez
const PERIOD_ASK_THRESHOLD = 4

function shouldAskPeriod(slots) {
  const { morning, afternoon } = countByPeriod(slots)
  return morning >= PERIOD_ASK_THRESHOLD && afternoon >= PERIOD_ASK_THRESHOLD
}

function filterSlotsByPeriod(slots, period) {
  if (!period) return slots
  return slots.filter(s => {
    const h = parseInt(s.split(':')[0])
    if (period === 'manha') return h < 12
    if (period === 'tarde') return h >= 12 && h < 18
    if (period === 'noite') return h >= 18
    return true
  })
}

// Extrai horário de texto livre, incluindo só números ("9", "10")
function extractTime(text, slots) {
  // Formato "9h30", "10:00", "10h"
  const tm = text.match(/(\d{1,2})[:h](\d{0,2})/)
  if (tm) {
    const candidate = `${tm[1].padStart(2,'0')}:${(tm[2]||'00').padStart(2,'0')}`
    if (slots.includes(candidate)) return candidate
    const fuzzy = slots.find(s => s.startsWith(tm[1].padStart(2,'0')+':'))
    if (fuzzy) return fuzzy
  }
  // "às 14", "as 14h", "pelas 9", "as 10?" — hora precedida de preposição
  const ctxMatch = text.match(/(?:(?:[àa]s?|pelas?)\s+)(\d{1,2})\b/i)
  if (ctxMatch) {
    const h = ctxMatch[1].padStart(2,'0')
    const exact = slots.find(s => s === `${h}:00`)
    if (exact) return exact
    const fuzzy = slots.find(s => s.startsWith(h+':'))
    if (fuzzy) return fuzzy
  }
  // Só número ("9", "10", "14") — interpreta como hora
  const numOnly = text.match(/^\s*(\d{1,2})\s*$/)
  if (numOnly) {
    const h = numOnly[1].padStart(2,'0')
    const exact = slots.find(s => s === `${h}:00`)
    if (exact) return exact
    const fuzzy = slots.find(s => s.startsWith(h+':'))
    if (fuzzy) return fuzzy
  }
  return null
}

// Busca os próximos N dias com disponibilidade a partir de uma data
async function findNextAvailableDays(serviceIdOrIds, fromDate, count = 3) {
  const results = []
  const d = new Date(fromDate)
  let attempts = 0
  while (results.length < count && attempts < 21) {
    d.setDate(d.getDate() + 1)
    attempts++
    const iso = toIso(d)
    const avail = await getAvailability(serviceIdOrIds, iso)
    if (avail?.allAvailableSlots?.length) results.push({ date: iso, slots: avail.allAvailableSlots, slotAssignments: avail.slotAssignments || {} })
  }
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent / matching
// ─────────────────────────────────────────────────────────────────────────────
// Palavras genéricas que não identificam serviços
const STOP_WORDS = new Set(['quem','qual','quais','quanto','quando','onde','como','para','voce','voces','fazer','fazem','faz','atende','atendem','tem','que','uma','uns','umas','meu','minha','seu','sua','pelo','pela','mais','menos','pode','posso'])

// Sinônimos populares → nome canônico (parcial, para matching)
const SERVICE_SYNONYMS = [
  [/\bblindagem\b/g, 'banho de gel'],
  [/\bblindado\b/g, 'banho de gel'],
  [/\bgel uv\b/g, 'banho de gel'],
  [/\bunha gel\b/g, 'banho de gel'],
  [/\bunha de gel\b/g, 'banho de gel'],
  [/\bacrili?co\b/g, 'alongamento'],
  [/\bfibra de vidro\b/g, 'alongamento'],
  [/\bunha acrilica\b/g, 'alongamento'],
  [/\bunhas posticas\b/g, 'alongamento'],
  [/\bextensao de unhas\b/g, 'alongamento'],
  [/\bmanicure\b/g, 'esmaltacao'],
  [/\bpedicure\b/g, 'esmaltacao'],
  [/\besmaltacao permanente\b/g, 'esmaltacao em gel'],
  [/\besmalte em gel\b/g, 'esmaltacao em gel'],
  [/\bcolocar cilios\b/g, 'cilios'],
  [/\bcolocacao de cilios\b/g, 'cilios'],
  [/\bdesign de cilios\b/g, 'cilios'],
  [/\bextensao de cilios\b/g, 'cilios'],
  [/\bcilio\b/g, 'cilios'],
  [/\blash\b/g, 'cilios'],
  [/\bvolume (russo|classico|natural)\b/g, 'cilios'],
  [/\bdesign (de sobrancelha|sobrancelha)\b/g, 'sobrancelha'],
  [/\bhena\b/g, 'henna'],
  [/\bbrow\b/g, 'sobrancelha'],
]

const SERVICE_ALIAS_GROUPS = [
  {
    triggers: [/\bsobrancelh(?:a|as)\b/, /\bbrow\b/],
    serviceTerms: ['sobrancelha', 'design', 'henna', 'brow', 'laminacao'],
  },
  {
    triggers: [/\bcilios?\b/, /\blash\b/],
    serviceTerms: ['cilios', 'lash', 'extensao', 'volume'],
  },
]

function applySynonyms(text) {
  let t = cleanText(text)
  for (const [re, canon] of SERVICE_SYNONYMS) t = t.replace(re, canon)
  return t
}

// Detecta "pé e mão" — intenção de agendar para pés E mãos
function detectPeEmao(text, services) {
  const t = norm(text)
  const hasPe = /\b(pe|pes|pedicure|dos pes)\b/.test(t)
  const hasMao = /\b(mao|maos|manicure|das maos|das unhas)\b/.test(t)
  if (!hasPe || !hasMao) return null

  // 1. Serviços unitários separados → bundle (2 profissionais na mesma janela)
  // Prefere o nome mais curto para evitar pegar "Esmaltação do pé" antes de "Pé"
  const footCandidates = services
    .filter(s => /\b(pe|pes|pedicure)\b/.test(norm(s.name)) && !/\b(mao|maos)\b/.test(norm(s.name)))
    .sort((a, b) => a.name.length - b.name.length)
  const handCandidates = services
    .filter(s => /\b(mao|maos|manicure)\b/.test(norm(s.name)) && !/\b(pe|pes)\b/.test(norm(s.name)))
    .sort((a, b) => a.name.length - b.name.length)
  const footSvc = footCandidates[0]
  const handSvc = handCandidates[0]
  if (footSvc && handSvc && footSvc.id !== handSvc.id) return { type: 'dual', foot: footSvc, hand: handSvc, combined: services.find(s => { const n = norm(s.name); return /\b(pe|pes)\b/.test(n) && /\b(mao|maos)\b/.test(n) }) || null }

  // 2. Serviço combinado no catálogo ("Pé e Mão") como fallback
  const combined = services.find(s => {
    const n = norm(s.name)
    return /\b(pe|pes)\b/.test(n) && /\b(mao|maos)\b/.test(n)
  })
  if (combined) return { type: 'single', svc: combined }

  const any = footSvc || handSvc
  if (any) return { type: 'fallback', svc: any }
  return null
}

function cleanText(s) { return norm(s).replace(/[^a-z0-9\s]/g, '') }

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsWholePhrase(text, phrase) {
  const normalizedText = cleanText(text)
  const normalizedPhrase = cleanText(phrase)
  if (!normalizedPhrase) return false
  return new RegExp(`(^|\\s)${escapeRegex(normalizedPhrase)}(?=\\s|$)`).test(normalizedText)
}

function uniqueServices(services) {
  return [...new Map((services || []).map(service => [service.id, service])).values()]
}

function findServicesByAliasGroup(text, services) {
  const normalized = cleanText(text)
  return SERVICE_ALIAS_GROUPS.flatMap(group => {
    const triggered = group.triggers.some(re => re.test(normalized))
    if (!triggered) return []
    return services.filter(service => {
      const serviceName = cleanText(service.name)
      return group.serviceTerms.some(term => serviceName.includes(term))
    })
  })
}

function findAllServicesByKeyword(text, services) {
  const t = applySynonyms(text)
  // Nome exato tem prioridade — "Pé e Mão" → só o serviço combinado, não Pé e Mão separados
  const exactName = services.filter(s => cleanText(s.name) === t)
  if (exactName.length) return uniqueServices(exactName)
  const exact = services.filter(s => containsWholePhrase(t, s.name))
  if (exact.length) return uniqueServices(exact)
  const words = t.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  const byWords = services.filter(s => words.some(w => cleanText(s.name).includes(w)))
  const byAlias = findServicesByAliasGroup(text, services)
  return uniqueServices([...byWords, ...byAlias])
}

function matchServiceKeyword(text, services) {
  const matches = findAllServicesByKeyword(text, services)
  return matches.length === 1 ? matches[0] : null
}

function buildServiceClarification(matches, clientWord = '') {
  const names = uniqueServices(matches).map(service => service.name)
  if (!names.length) return 'Qual serviço você quer fazer?'
  if (names.length === 1) return `Você quer ${names[0]}?`
  const intro = clientWord ? `Por "${clientWord}" você quer dizer` : 'Pra essa opção, eu tenho'
  return `${intro}: ${names.join(', ')}. Qual deles você quer?`
}

async function matchServiceOllama(userText, services) {
  const keywordMatches = findAllServicesByKeyword(userText, services)
  if (keywordMatches.length > 1) return null
  const names = services.map(s => s.name).join(', ')
  const r = await extract(`Serviços disponíveis: ${names}.\nQual serviço a pessoa quer? Responda APENAS com o nome exato do serviço.`, userText, '?')
  if (r === '?') return null
  return services.find(s => norm(s.name) === norm(r) || norm(r).includes(norm(s.name))) || null
}

function isYes(text) {
  const t = norm(text)
  return /\b(sim|s\b|yes|confirmo|confirmado|ok|pode|isso|certo|perfeito|e isso|ta bom|tudo bem|confirma|fechado|pode ser|claro|com certeza|exato|bora|vamos|feito|combinado|otimo|isso mesmo|pode confirmar|confirma ai|vai|manda ver)\b/.test(t)
    || /^[👍✅👌🤝💯✔]+$/.test(text.trim())
}

function isNo(text) {
  const t = norm(text)
  return /\b(nao|n\b|no\b|cancelar|desistir|nope|negativo|para|chega)\b/.test(t)
    || /^[👎❌🚫]+$/.test(text.trim())
}

function isPagou(text) {
  const t = norm(text)
  return /\b(paguei|fiz o pix|fiz o pagamento|pagamento feito|ja paguei|pago|transferi|realizei|efetuei|mandei|enviei|efetuado|concluido|finalizado)\b/.test(t)
}

function isBookingIntent(text, services = []) {
  const t = norm(text)
  const tSyn = applySynonyms(text)
  return (
    /\b(agendar|agende|agendem|marcar|marca\b|marque|marquem|reservar|reserve|quero marcar|quero agendar|queria agendar|precisava agendar|preciso agendar|preciso marcar|quero fazer|queria fazer|quero colocar|queria colocar|coloca\b|coloque\b|vou agendar|vim agendar|gostaria de agendar|gostaria de marcar|gostaria de fazer)\b/.test(t) ||
    /\b(tem horario|tem horarios|tem disponibilidade|tem vaga|tem disponivel|voces tem|voce tem|tem como marcar|tem como agendar|teria como|teria um horario|seria possivel|consigo horario|consigo marcar|consigo agendar|consegue marcar|consegue agendar|posso marcar|posso agendar|da pra marcar|da pra agendar|ha horario|ha disponibilidade|tem um espacinho|tem espacinho)\b/.test(t) ||
    services.some((service) => t.includes(norm(service.name))) ||
    services.some((service) => tSyn.includes(cleanText(service.name))) ||
    findAllServicesByKeyword(text, services).length > 0
  )
}

function isInfoQuestion(text) {
  const t = norm(text)
  return /\b(quanto custa|qual.*preco|preco|valor|duracao|quanto tempo|quanto dura|horario|que horas|onde fica|endereco|como chego|servicos|o que voces|que tipo|tem.*servico|fazem|trabalham|atendem|qual.*servico|voces fazem|quais sao|me conta|me fala|faz.*unhas|faz.*cilios|faz.*design|instagram|telefone|contato|site|como funciona|o que e|o que eh|diferenca|diferença|tem desconto|tem promocao|promocao|novidade|proximo horario disponivel|tem vaga|tem horario|quem faz|quem atende|quem e a|qual profissional|qual especialista|quem cuida|quem trabalha|recomenda|indicar|qual.*melhor|melhor opcao|mais procurado|mais pedido|o que e bom|o que voce indica|funciona bem|resultado|quanto.*demora|quanto.*dura|demora muito|dura quanto|aceita|forma de pagamento|pagar|cartao|pix|dinheiro|estacionamento|fica longe|bairro|cidade|regiao|onde voces)\b/.test(t)
}

function isRecommendation(text) {
  const t = norm(text)
  return /\b(recomenda|indica|qual.*melhor|melhor opcao|mais procurado|mais pedido|o que e bom|o que voce indica|o que eu deveria|por onde comecar|o que fazer|me sugere|me indica)\b/.test(t)
}

// Responde perguntas comuns DIRETAMENTE dos dados, sem precisar do Ollama
// Retorna string se souber responder, null se precisar do Ollama
function tryDirectAnswer(text, services, contact, businessHours = []) {
  const t = norm(text)
  const DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

  // Lista de serviços
  if (/\b(quais servicos|que servicos|quais sao os servicos|o que voces fazem|o que fazem|que tipo de servico|o que tem|quais opcoes|que opcoes|me fala os servicos|me conta os servicos|servicos de voces|voces fazem|tem servico de|cardapio|menu)\b/.test(t) || (t.includes('servico') && /\b(quais|que|tem|lista|ver|mostrar)\b/.test(t))) {
    if (!services.length) return null
    const groups = { unhas: [], cilios: [], 'bem-estar': [] }
    for (const s of services) groups[s.category]?.push(s) || groups.unhas.push(s)
    const LABELS = { unhas: 'Unhas', cilios: 'Cílios', 'bem-estar': 'Bem-estar' }
    const parts = Object.entries(groups)
      .filter(([, arr]) => arr.length)
      .map(([cat, arr]) => `${LABELS[cat]}: ${arr.map(s => `${s.name} (${s.price})`).join(', ')}`)
    return `No SC Studio temos:\n${parts.join('\n')}`
  }

  // Profissional de serviço específico
  if (/\b(quem faz|quem atende|qual profissional|quem e a|quem cuida|quem trabalha)\b/.test(t)) {
    const matched = findAllServicesByKeyword(text, services)
    if (matched.length) {
      // Junta profissionais únicos de todos os serviços que batem
      const allProfs = [...new Set(matched.flatMap(s => (s.professionals || []).map(p => p.name)))]
      if (allProfs.length) {
        const svcNames = [...new Set(matched.map(s => s.name))].join(', ')
        return `${svcNames} é atendido por ${allProfs.join(', ')}.`
      }
    }
    return null // sem profissional vinculado — Ollama responde
  }

  // Preço de serviço específico
  if (/\b(quanto custa|qual.*preco|preco|valor|caro|barato)\b/.test(t)) {
    const svc = matchServiceKeyword(text, services)
    if (svc) return `O ${svc.name} custa ${svc.price} e dura ${svc.duration}.`
    if (services.length) {
      const list = services.map(s => `${s.name}: ${s.price}`).join(', ')
      return `Os preços são: ${list}.`
    }
  }

  // Duração de serviço específico
  if (/\b(quanto tempo|quanto dura|duracao|demora)\b/.test(t)) {
    // Pé e mão juntos com 2 profissionais = tempo paralelo
    const isPeEmao = /\b(pe e mao|pe e a mao|maos e pes|pes e maos|pedicure e manicure|manicure e pedicure)\b/.test(t)
    if (isPeEmao) {
      const peEmaoResult = detectPeEmao(text, services)
      if (peEmaoResult?.type === 'dual') {
        const both = [peEmaoResult.foot, peEmaoResult.hand]
        const par = bundleParallelDuration(both)
        if (par) return `Pé e Mão juntos com 2 profissionais leva em média ~${par} (elas trabalham ao mesmo tempo, uma em cada serviço).`
      }
    }
    const svc = matchServiceKeyword(text, services)
    if (svc) return `O ${svc.name} dura em média ${svc.duration}.`
    if (services.length) {
      const list = services.map(s => `${s.name}: ${s.duration}`).join(', ')
      return `As durações são: ${list}.`
    }
  }

  // Endereço
  if (/\b(onde fica|endereco|localizacao|como chego|onde voces ficam|qual o endereco)\b/.test(t)) {
    if (contact?.addressText) return `Ficamos em ${contact.addressText}.`
  }

  // Horários de funcionamento
  if (/\b(horario de funcionamento|que horas abre|que horas fecha|horario de atendimento|quando abrem|quando fecham|qual o horario|horarios de voces|horario de voces|funcionamento|que horas|quando voces)\b/.test(t)) {
    if (businessHours?.length) {
      const open = businessHours.filter(h => !h.isClosed)
      if (open.length) {
        const str = open.map(h => `${DAYS[h.weekday]}: ${h.opensAt} às ${h.closesAt}`).join(', ')
        return `Nosso horário de atendimento: ${str}.`
      }
    }
    return `Para confirmar nossos horários disponíveis, entra em contato pelo WhatsApp ou consulta nossa agenda!`
  }

  // Instagram
  if (/\b(instagram|rede social|insta|ig)\b/.test(t)) {
    if (contact?.instagramHandle) return `Nosso Instagram é @${contact.instagramHandle}.`
  }

  // Telefone / contato
  if (/\b(telefone|numero|contato|ligar|fone|cel|celular|zap)\b/.test(t)) {
    const display = contact?.whatsappDisplay || contact?.phone
    if (display) return `Nosso número é ${display}.`
  }

  // Pagamento / PIX
  if (/\b(pix|chave pix|como pagar|forma de pagamento|aceita cartao|aceita dinheiro|pagamento|formas de pagamento)\b/.test(t)) {
    return `Aceitamos PIX (chave: ${PIX_KEY}), dinheiro e cartão! Para confirmar o agendamento pedimos uma entrada via PIX 😊`
  }

  return null
}

function isRobotQuestion(text) {
  const t = norm(text)
  return /\b(voce e (robo|robot|ia|inteligencia|bot|automatico)|ta falando com robo|e robo|e humano|e automatico|fala com humano|falar com atendente|falar com pessoa)\b/.test(t)
}

function isCompliment(text) {
  const t = norm(text)
  return /\b(amei|adorei|otimo|excelente|perfeito|incrivel|maravilhoso|top|show|muito bom|muito boa|parabens|obrigad|grata|amo|lindo|linda|sensacional)\b/.test(t)
}

function isGreeting(text) {
  const t = norm(text)
  return /^(oi+|ola+|olá+|opa+|e ai|eae|bom dia|boa tarde|boa noite|tudo bem|tem alguem ai|tem alguém ai|tem alguem ai\?|tem alguém ai\?)$/.test(t)
    || /^(oi+|ola+|olá+|opa+)[!.? ]*$/.test(t)
}

function isComplaint(text) {
  const t = norm(text)
  return /\b(problema|reclamacao|reclamar|insatisfeit|ruim|pessimo|horrivel|errado|nao gostei|decepcionante|frustrante|nao funcionou|defeito)\b/.test(t)
}

function isFarewell(text) {
  const t = norm(text)
  return /\b(obrigad|valeu|vlw|ate logo|ate mais|ate ja|flw|tchau|xau|era so isso|so era isso|por enquanto e so|nao preciso de mais|mais nada|nao tenho mais nada|pode encerrar|pode fechar)\b/.test(t)
}

// Tenta extrair nome de terceiro ("para minha filha Ana", "é pra minha amiga Joana")
function extractThirdPartyName(text) {
  const m = text.match(/(?:para|pra|é para|é pra|é pro|pro)\s+(?:minha|meu|a|o|uma|um)?\s*(?:filha|filho|amiga|amigo|mae|mãe|pai|prima|primo|irmã|irma|irmao|irmão|namorada|namorado|esposa|esposo|mulher|marido|colega|cliente)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i)
  if (m) return m[1].trim()
  const m2 = text.match(/(?:para|pra)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)\b/i)
  if (m2 && m2[1].length > 2 && !/^(mim|minha|meu|você|voce|ela|ele)$/i.test(m2[1])) return m2[1].trim()
  return null
}

// One-shot: tenta extrair serviço + data + horário + nome + profissional de uma mensagem única
async function tryOneShotExtract(text, services, forceSvc = null) {
  const svc = forceSvc || matchServiceKeyword(text, services) || await matchServiceOllama(text, services)
  if (!svc) return null
  const date = parseDate(text)
  const avail = date ? await getAvailability(svc.id, date) : null
  // Detecta profissional pedida antes de filtrar slots
  const allProfessionals = avail?.professionals || svc.professionals || []
  const professional = extractRequestedProfessional(text, allProfessionals)
  const slots = professional
    ? slotsForProfessional(avail, professional)
    : (avail?.allAvailableSlots || [])
  const time = slots.length ? extractTime(text, slots) : null
  const thirdPartyName = extractThirdPartyName(text)
  return { svc, date, time, slots, thirdPartyName, professional, avail }
}

// Detecta mudança de ideia no meio do fluxo
function detectMindChange(text, conv, services) {
  const t = norm(text)
  const hasSignal = /\bna verdade\b|\bquero mudar\b|\bna real\b|\bespera\b|\bperae\b|\bpera\b|\bpoderia mudar\b|\bmuda\b|\bpode mudar\b/.test(t)

  if (conv.state !== 'await_date' && conv.state !== 'idle' && conv.state !== 'await_loose') {
    const newDate = parseDate(text)
    if (newDate && (hasSignal || /\b(segunda|terca|quarta|quinta|sexta|sabado|domingo|amanha|hoje|dia\s+\d|\d+\/\d+)/i.test(t))) {
      return { type: 'date', value: newDate }
    }
  }

  if (conv.state !== 'await_service' && conv.state !== 'idle' && services?.length) {
    const newSvc = matchServiceKeyword(text, services)
    if (newSvc && newSvc.id !== conv.data?.service?.id && (hasSignal || conv.state === 'await_date')) {
      return { type: 'service', value: newSvc }
    }
  }

  if (/\brecomecar\b|\bcomeca(r)? de novo\b|\bzerar\b|\btudo de novo\b|\bvoltar ao inicio\b/.test(t)) {
    return { type: 'restart' }
  }

  return null
}

// Após responder info question em mid-flow, lembra o que estava sendo discutido
async function resumeFlowHint(conv, studioCtx) {
  const g = conv.g || {}
  const phase = conv.phase || 'booking'
  if (phase === 'booking') {
    const bCtx = bookingCtx(conv)
    if (!bCtx) return null
    return await reply(`Lembre brevemente onde paramos: ${bCtx}. Peça o próximo dado que falta.`, studioCtx, null, conv)
  }
  if (phase === 'confirm') {
    const bCtx = bookingCtx(conv)
    return await reply(`Pergunte brevemente se confirma o agendamento: ${bCtx}.`, studioCtx, 'Confirma o agendamento?', conv)
  }
  if (phase === 'payment') return await reply('Lembre brevemente que aguarda o PIX.', studioCtx, 'Assim que puder, manda o comprovante do PIX 😊', conv)
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Unavailability helper — sugere próximas datas com vaga
// ─────────────────────────────────────────────────────────────────────────────
async function handleNoAvailability(id, conv, date, studioCtx) {
  const g = conv.g || conv.data || {}
  const svc = g.service
  const nextDays = await findNextAvailableDays(svc.id, date, 3)
  if (!nextDays.length) {
    return await reply(
      `Não tem horários disponíveis para ${svc.name} nos próximos dias. Diga isso naturalmente e peça pra entrar em contato.`,
      studioCtx, `Não encontrei horários disponíveis nos próximos dias para esse serviço. Pode entrar em contato pelo telefone para verificar!`
    )
  }
  const suggestions = nextDays.map(d => `${formatDatePt(d.date)} (${slotsToNatural(d.slots.slice(0,3))})`).join(', ')
  const gNow = conv.g || conv.data || {}
  conv.g = { ...gNow, date: undefined, slots: undefined, time: undefined }
  conv.phase = 'booking'
  saveConv(id, conv)
  return await reply(
    `Não tem horário em ${formatDatePt(date)}. Sugira as próximas datas disponíveis: ${suggestions}. Pergunte qual prefere.`,
    `Serviço: ${svc.name}.`,
    `Essa data não tem horário disponível, mas tem vaga em ${suggestions}. Qual funciona pra você?`
  )
}

// Retorna nome para o agendamento: WhatsApp name > nome coletado > número
function resolveCustomerName(conv, id) {
  return conv.whatsappName || conv.g?.name || conv.data?.customerName || id.split('@')[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking Engine — LLM-driven slot collection (replaces state machine)
// ─────────────────────────────────────────────────────────────────────────────

// What's still needed to complete a booking
function getMissing(g) {
  const missing = []
  if (!g.service) missing.push('service')
  else if (!g.date) missing.push('date')
  else if (g.slots !== undefined && !g.slots?.length) missing.push('no_avail')
  else if (!g.time) missing.push('time')
  if (!g.name) missing.push('name')
  return missing
}

// Merge extracted fields into current gathered data (undefined = clear field)
function mergeGathered(current, extracted) {
  const merged = { ...current }
  for (const [k, v] of Object.entries(extracted)) {
    if (k.startsWith('_')) continue
    if (v === undefined) delete merged[k]
    else merged[k] = v
  }
  return merged
}

// Extract all available info — LLM primary, regex/keyword as complement/fallback
// llm = pre-computed extractWithLLM result (passed from handleInbound to avoid double call)
async function extractFromMessage(text, services, g, conv, llm = {}) {
  const ex = {}
  const t = norm(text)

  // Thread LLM intent/question/change through _* fields
  if (llm.intent) ex._intent = llm.intent
  if (llm.question) ex._question = llm.question
  if (llm.change_field) ex._change = llm.change_field

  // ── Service ──
  // Try regex bundle detection first (needs catalog), use LLM is_pe_e_mao as fallback signal
  let peEmao = detectPeEmao(text, services)
  // LLM fallback para is_pe_e_mao só ativa se o texto contiver palavra de "mão"/"manicure"
  // (evita falso positivo com "manutenção" que o LLM às vezes confunde com "mão")
  const maoNoTexto = /\b(mao|maos|manicure)\b/.test(norm(text))
  if (!peEmao && llm.is_pe_e_mao && maoNoTexto) {
    // LLM detected pe+mão intent that regex missed (e.g. "quero unhas de mão e pé")
    // Sort by name length so "Pé" wins over "Esmaltação do pé", "Mão" wins over "Esmaltação de unha Mão"
    const footSvc = services.filter(s => /\b(pe|pes|pedicure)\b/.test(norm(s.name)) && !/\b(mao|maos)\b/.test(norm(s.name))).sort((a,b) => a.name.length - b.name.length)[0]
    const handSvc = services.filter(s => /\b(mao|maos|manicure)\b/.test(norm(s.name)) && !/\b(pe|pes)\b/.test(norm(s.name))).sort((a,b) => a.name.length - b.name.length)[0]
    if (footSvc && handSvc && footSvc.id !== handSvc.id) peEmao = { type: 'dual', foot: footSvc, hand: handSvc, combined: null }
    else if (footSvc || handSvc) peEmao = { type: 'fallback', svc: footSvc || handSvc }
  }

  if (peEmao?.type === 'dual') {
    if (!g.bundleServices?.length) {
      ex.service = peEmao.foot; ex.bundleServices = [peEmao.foot, peEmao.hand]; ex.combinedService = peEmao.combined
      if (g.service && g.service.id === peEmao.foot.id) {
        // Já tem o serviço de pé — mantém a data, só limpa slots/horário para buscar disponibilidade do bundle
        ex.slots = undefined; ex.time = undefined
      } else if (g.service) {
        // Serviço diferente — limpa tudo
        ex.date = undefined; ex.slots = undefined; ex.time = undefined
      }
    }
  } else if (peEmao?.type === 'single') {
    if (!g.service || g.service.id !== peEmao.svc.id) {
      ex.service = peEmao.svc; ex.bundleServices = null
      if (g.service) { ex.date = undefined; ex.slots = undefined; ex.time = undefined }
    }
  } else if (!g.service) {
    // LLM service name takes priority (handles synonyms, creative phrasings)
    let svc = null
    if (llm.service) {
      svc = services.find(s => norm(s.name) === norm(llm.service))
        || services.find(s => norm(s.name).includes(norm(llm.service)) || norm(llm.service).includes(norm(s.name)))
    }
    if (!svc) {
      const matches = findAllServicesByKeyword(text, services)
      if (matches.length === 1) svc = matches[0]
      else if (matches.length > 1) ex._serviceMatches = matches
    }
    if (!svc && !ex._serviceMatches) svc = await matchServiceOllama(text, services)
    if (svc) { ex.service = svc; ex.bundleServices = null }
  }

  // ── Bundle upgrade: serviço já selecionado, cliente quer adicionar o complementar ──
  // Ex: já tem "Spa dos pés", diz "tem como incluir a mão?" → detecta bundle pé+mão
  if (g.service && !g.bundleServices && !ex.bundleServices) {
    const footInSvc = /\b(pe|pes|spa|pedicure)\b/.test(norm(g.service.name))
    const handInSvc = /\b(mao|maos|manicure)\b/.test(norm(g.service.name))
    const tBundleCheck = norm(text)
    const wantsMao = /\b(mao|maos|manicure)\b/.test(tBundleCheck)
    const wantsPe  = /\b(pe|pes|pedicure)\b/.test(tBundleCheck)
    const bundleSignal = llm.intent === 'add_servico' ||
      ((llm.intent !== 'info') && /\b(incluir|adicionar|junto|ao mesmo|mesm[oa] hora|fazer a mao|fazer o pe|coloca.*mao|coloca.*pe)\b/.test(tBundleCheck))
    const doUpgrade = (footInSvc && wantsMao && bundleSignal) || (handInSvc && wantsPe && bundleSignal)
    if (doUpgrade) {
      const synthText = footInSvc ? (g.service.name + ' e mão') : ('pé e ' + g.service.name)
      const upgraded = detectPeEmao(synthText, services)
      if (upgraded?.type === 'dual') {
        ex.service = upgraded.foot
        ex.bundleServices = [upgraded.foot, upgraded.hand]
        ex.combinedService = upgraded.combined
        ex.slots = undefined
        ex.time = undefined
        console.log('[bundle-upgrade] detectado mid-flow:', g.service.name, '→', upgraded.foot.name, '+', upgraded.hand.name)
      }
    }
  }

  // ── Date: LLM ISO first (handles "sexta", "amanhã", "dia 30" naturally), regex fallback ──
  const date = llm.date_iso || parseDate(text)
  if (date && date !== g.date) {
    ex.date = date; ex.slots = undefined; ex.time = undefined
  }

  // ── Fetch availability when service + date are known ──
  const effService = ex.service || g.service
  const effDate = ex.date !== undefined ? ex.date : g.date
  const effBundle = ex.bundleServices !== undefined ? ex.bundleServices : g.bundleServices
  const needSlots = effService && effDate && (ex.date !== undefined || ex.service || !g.slots?.length)
  if (needSlots) {
    const svcParam = effBundle?.length > 1 ? effBundle.map(s => s.id) : effService.id
    const avail = await getAvailability(svcParam, effDate)
    ex.slots = avail?.allAvailableSlots || []
    if (effBundle?.length > 1) ex.slotAssignments = avail?.slotAssignments || {}
  }

  // ── Period filter: LLM or regex ──
  const period = llm.period || detectPeriod(text)
  if (period && !g.time) {
    const baseSlots = ex.slots !== undefined ? ex.slots : g.slots
    if (baseSlots?.length) {
      const filtered = filterSlotsByPeriod(baseSlots, period)
      if (filtered.length) ex.slots = filtered
    }
  }

  // ── Time: LLM HH:MM first (handles "meio-dia", "pelas 10", etc.), regex fallback ──
  // Quando o LLM extrai um horário específico, só aceita match EXATO — nunca fuzzy.
  // Se não existe, marca _requestedUnavailableTime para o handler avisar a cliente.
  const effSlots = ex.slots !== undefined ? ex.slots : g.slots
  if (effSlots?.length && !g.time) {
    let time = null
    if (llm.time_hhmm) {
      if (effSlots.includes(llm.time_hhmm)) {
        time = llm.time_hhmm
      } else {
        ex._requestedUnavailableTime = llm.time_hhmm  // horário pedido mas indisponível
      }
    }
    if (!time) {
      if (/\b(qualquer|tanto faz|pode ser qualquer|mais cedo|primeiro disponivel|nao importa|sem preferencia|primeiro horario|qual o primeiro|me faz no primeiro|me bota no primeiro)\b/.test(t)) {
        time = effSlots[0]
      } else if (!llm.time_hhmm) {
        // Só usa regex fuzzy se o LLM não detectou horário específico
        time = extractTime(text, effSlots)
      }
    }
    if (time) ex.time = time
  }

  // ── Name: LLM first (entende "é pra mim, Kaike"), heuristics fallback ──
  if (!g.name) {
    const stopWords = /^(sim|nao|ok|bom|tudo|pode|ola|oi|hey|e isso|claro|certo|perfeito|otimo|fechado|confirmo|confirmado)$/i
    if (llm.name && llm.name.length > 1 && !stopWords.test(norm(llm.name))) {
      ex.name = llm.name
    } else {
      const thirdParty = extractThirdPartyName(text)
      if (thirdParty) ex.name = thirdParty
      else if (conv?.whatsappName) ex.name = conv.whatsappName.split(' ')[0]
    }
  }

  // ── Professional: LLM or regex ──
  if (!g.professional) {
    const allProfs = (ex.service || g.service)?.professionals || []
    if (allProfs.length) {
      const profName = llm.professional || text
      const found = extractRequestedProfessional(profName, allProfs)
      if (found) ex.professional = found
    }
  }

  return ex
}

// Perguntar dado faltante. Horários e nome: determinístico. Serviço/data: LLM com contexto limpo.
async function buildAskMissing(text, g, missing, studioCtx, conv, question = null) {
  const svcLabel = g.bundleServices?.length > 1
    ? g.bundleServices.map(s => s.name).join(' e ')
    : g.service?.name
  const clientName = (conv.whatsappName || g.name || '').split(' ')[0]
  const namePrefix = clientName ? `${clientName}, ` : ''
  const first = missing[0]

  // ── Horários: 100% determinístico, LLM só responde pergunta embutida se houver ──
  if (first === 'time') {
    const slotMsg = buildSlotListMsg(g, conv.whatsappName || g.name)
    // "tem horário?" é a própria intenção de agendar — não adiciona prefixo LLM (evita dia errado)
    const isAvailabilityQ = question && /\btem horario\b|\btem vaga\b|\btem disponib\b|\btem como\b|\bprimeiro horario\b|\bqual o primeiro\b/.test(norm(question))
    if (question && !isAvailabilityQ) {
      const qAnswer = await reply(
        `Responda brevemente esta dúvida em 1-2 frases (NÃO mencione dia da semana): "${question}". Seja direta.`,
        studioCtx, '', conv
      )
      return qAnswer ? `${qAnswer}\n\n${slotMsg}` : slotMsg
    }
    // Echo determinístico para sinônimos que não aparecem no nome do serviço
    const tNorm = norm(text)
    if (/\brepor?\b/.test(tNorm)) return `Claro! Para *reposição*:\n\n${slotMsg}`
    if (/\bremov/.test(tNorm)) return `Claro! Pode *remover*:\n\n${slotMsg}`
    if (/\bcilio/.test(tNorm)) return `Para seus cilios:\n\n${slotMsg}`
    return slotMsg
  }

  // ── Nome: determinístico ──
  if (first === 'name') {
    return `${namePrefix}qual é o seu nome para o agendamento?`
  }

  // ── Resto: LLM com contexto limpo (não inclui histórico de slots/profissionais) ──
  const knownStr = [
    g.service && `serviço: ${svcLabel}`,
    g.date && `data: ${formatDatePt(g.date)}`,
    g.time && `horário: ${g.time}`,
  ].filter(Boolean).join(', ')
  const qNote = question ? `Responda brevemente: "${question}". Depois, ` : ''

  if (first === 'service') {
    const task = `${qNote}A cliente disse: "${text}". Descubra qual serviço ela quer de forma natural. Se for saudação, cumprimente e pergunte como pode ajudar.`
    return await reply(task, studioCtx, `${namePrefix}qual serviço você quer agendar? 😊`, conv)
  }
  if (first === 'date') {
    const task = `${qNote}${knownStr ? `Já temos: ${knownStr}. ` : ''}Pergunte qual data a cliente prefere para ${svcLabel}.`
    return await reply(task, studioCtx, `${namePrefix}para qual data você prefere agendar?`, conv)
  }
  if (first === 'no_avail') {
    const task = `${qNote}Não há horário disponível para ${svcLabel} em ${formatDatePt(g.date)}. Informe gentilmente e pergunte se quer outra data.`
    return await reply(task, studioCtx, `Essa data não tem horário disponível para ${svcLabel}. Quer tentar outra data?`, conv)
  }

  return await reply(`${qNote}Responda a mensagem: "${text}" de forma natural.`, studioCtx, 'Como posso te ajudar?', conv)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main booking phase — LLM-driven slot collection
// ─────────────────────────────────────────────────────────────────────────────
async function handleBookingPhase(id, text, conv, services, studioCtx, llm = {}) {
  const t = norm(text)
  const g = conv.g || {}
  const intent = llm.intent || 'outro'

  // Cancelamento (LLM intent ou regex)
  if (intent === 'cancelar' || /\b(cancelar|desmarcar|cancelamento)\b/.test(t)) {
    const bookings = await getCustomerBookings(id)
    const active = bookings.filter(b => ['pending','confirmed','pending_payment'].includes(b.status))
    if (active.length) return startCancelFlow(id, conv, active, studioCtx)
    else return 'Não encontrei nenhum agendamento ativo para cancelar 😊 Posso te ajudar com outra coisa?'
  }

  // Ver agendamentos
  if (/\b(meu agendamento|ver agendamento|meus agendamentos)\b/.test(t)) {
    const bookings = await getCustomerBookings(id)
    const active = bookings.filter(b => ['pending','confirmed','pending_payment'].includes(b.status))
    return showBookings(id, active, studioCtx, conv)
  }

  // Mudança de serviço/data detectada pelo LLM
  // Só limpa campo se o LLM também forneceu um novo valor — senão extractFromMessage cuida
  if (llm.change_field === 'servico' && g.service) {
    conv.g = { ...g, service: null, bundleServices: null, date: undefined, slots: undefined, time: undefined }
    saveConv(id, conv)
  } else if (llm.change_field === 'data' && g.date && llm.date_iso && llm.date_iso !== g.date) {
    // Só limpa data se uma nova data diferente foi realmente fornecida
    conv.g = { ...g, date: undefined, slots: undefined, time: undefined }
    saveConv(id, conv)
  } else if (llm.change_field === 'horario' && g.time) {
    conv.g = { ...g, time: undefined }
    saveConv(id, conv)
  }

  // Detecta bundle upgrade ANTES do caminho direto para não bloquear detecção
  const tBundlePre = t
  const gPre = conv.g || {}
  const footInSvcPre = gPre.service && !gPre.bundleServices && /\b(pe|pes|spa|pedicure)\b/.test(norm(gPre.service?.name || ''))
  const handInSvcPre = gPre.service && !gPre.bundleServices && /\b(mao|maos|manicure)\b/.test(norm(gPre.service?.name || ''))
  const wantsMaoPre = /\b(mao|maos|manicure)\b/.test(tBundlePre)
  const wantsPePre  = /\b(pe|pes|pedicure)\b/.test(tBundlePre)
  const bundleSignalPre = intent === 'add_servico' ||
    ((intent !== 'info') && /\b(incluir|adicionar|junto|ao mesmo|mesm[oa] hora|fazer a mao|fazer o pe|coloca.*mao|coloca.*pe)\b/.test(tBundlePre))
  const isBundleUpgrade = (footInSvcPre && wantsMaoPre && bundleSignalPre) ||
                          (handInSvcPre && wantsPePre && bundleSignalPre)

  // Caminho direto para seleção de horário (não entra se for bundle upgrade)
  const gNow = conv.g || {}
  if (!isBundleUpgrade && gNow.service && gNow.date && gNow.slots?.length && !gNow.time) {
    // LLM horário pedido → só exact. Fuzzy silencioso não existe mais.
    if (llm.time_hhmm && !gNow.slots.includes(llm.time_hhmm)) {
      return `${slotTime(llm.time_hhmm)} não está disponível.\n\n${buildSlotListMsg(gNow, conv.whatsappName)}`
    }
    // "confirmar" em booking com slots disponíveis → auto-pick primeiro slot e vai direto ao pagamento
    const quickTime = (intent === 'confirmar' ? gNow.slots[0] : null)
      || (llm.time_hhmm && gNow.slots.includes(llm.time_hhmm) ? llm.time_hhmm : null)
      || extractTime(text, gNow.slots)
    if (quickTime) {
      const newG = { ...gNow, time: quickTime }
      if (!newG.name && conv.whatsappName) newG.name = conv.whatsappName.split(' ')[0]
      conv.g = newG; saveConv(id, conv)
      const stillMissing = getMissing(newG)
      if (stillMissing.length === 0 || (stillMissing.length === 1 && stillMissing[0] === 'name' && newG.name)) {
        if (intent === 'confirmar') {
          const confirmCard = buildConfirmMsg(newG, conv.whatsappName)
          const paymentMsg = await createBookingFromGathered(id, newG, conv, studioCtx, null)
          return `${confirmCard}\n\n${paymentMsg}`
        }
        conv.phase = 'confirm'; saveConv(id, conv)
        return buildConfirmMsg(newG, conv.whatsappName)
      }
      return await buildAskMissing(text, newG, stillMissing, studioCtx, conv)
    }
  }

  // "confirmar" sem data → busca próximo dia disponível e agenda automaticamente
  if ((intent === 'confirmar' || isYes(text)) && gNow.service && !gNow.date) {
    const isBundleConf = gNow.bundleServices?.length > 1
    const brt = new Date(Date.now() - 3 * 60 * 60 * 1000)
    for (let i = 1; i <= 7; i++) {
      const tryDate = new Date(brt); tryDate.setDate(brt.getDate() + i)
      const tryDateStr = toIso(tryDate)
      const avail = await getAvailability(isBundleConf ? gNow.bundleServices.map(s => s.id) : gNow.service.id, tryDateStr)
      if (avail?.allAvailableSlots?.length) {
        const newG = { ...gNow, date: tryDateStr, slots: avail.allAvailableSlots, slotAssignments: avail.slotAssignments || {}, time: avail.allAvailableSlots[0] }
        if (!newG.name && conv.whatsappName) newG.name = conv.whatsappName.split(' ')[0]
        conv.g = newG; saveConv(id, conv)
        const confirmCard2 = buildConfirmMsg(newG, conv.whatsappName)
        const paymentMsg2 = await createBookingFromGathered(id, newG, conv, studioCtx, null)
        return `${confirmCard2}\n\n${paymentMsg2}`
      }
    }
  }

  // Extract with LLM context already available (avoids double LLM call)
  const extracted = await extractFromMessage(text, services, conv.g || {}, conv, llm)
  const userQuestion = extracted._question || null

  // Ambiguous service — resposta determinística para não parafrasear nome de serviço
  if (extracted._serviceMatches?.length > 1 && !extracted.service) {
    const tNorm = norm(text)
    const clientWord = /\bmanicure\b/.test(tNorm) ? 'manicure'
      : /\bpedicure\b/.test(tNorm) ? 'pedicure'
      : /\besmalte\b/.test(tNorm) ? 'esmalte'
      : /\bsobrancelh/.test(tNorm) ? 'sobrancelha'
      : ''
    return buildServiceClarification(extracted._serviceMatches, clientWord)
  }

  // Merge and save
  const newG = mergeGathered(conv.g || {}, extracted)
  conv.g = newG; saveConv(id, conv)

  // No availability
  if (newG.date && newG.service && newG.slots !== undefined && !newG.slots?.length) {
    return handleNoAvailability(id, conv, newG.date, studioCtx)
  }

  // Horário pedido não disponível — avisa e lista os slots reais
  if (extracted._requestedUnavailableTime && !newG.time && newG.slots?.length) {
    return `${slotTime(extracted._requestedUnavailableTime)} não está disponível.\n\n${buildSlotListMsg(newG, conv.whatsappName)}`
  }

  const missing = getMissing(newG)

  // All data collected — move to confirm with deterministic message
  if (missing.length === 0 || (missing.length === 1 && missing[0] === 'name' && newG.name)) {
    conv.phase = 'confirm'; saveConv(id, conv)
    const confirmMsg = buildConfirmMsg(newG, conv.whatsappName)
    // Echo sinônimo do cliente antes do confirm card (pedicure, manicure, etc.)
    const tNormFull = norm(text)
    const isBundle = newG.bundleServices?.length > 1
    const echoSynonym = !isBundle && /\bpedicure\b/.test(tNormFull) ? 'pedicure'
      : !isBundle && /\bmanicure\b/.test(tNormFull) ? 'manicure'
      : !isBundle && /\bcilio/.test(norm(text)) ? 'cilios'
      : !isBundle && /\besmalt/.test(norm(text)) ? 'esmaltar'
      : null
    const echoPrefix = echoSynonym === 'cilios'
      ? `Que legal! Para seus *cilios*:\n\n`
      : echoSynonym === 'esmaltar'
      ? `Certo! Vou esmaltar agora 😊\n\n`
      : echoSynonym ? `Ótima escolha! Sua *${echoSynonym}* está marcada 😊\n\n`
      : ''
    // Pergunta de disponibilidade ("qual o primeiro horário?") — mostra confirm direto, sem LLM
    const isAvailabilityQ = userQuestion && /\btem horario\b|\btem vaga\b|\btem disponib\b|\btem como\b|\bprimeiro horario\b|\bqual o primeiro\b/.test(norm(userQuestion))
    if (userQuestion && !isAvailabilityQ) {
      const qAnswer = await reply(
        `Responda brevemente em 1-2 frases: "${userQuestion}".`,
        studioCtx, '', conv
      )
      return qAnswer ? `${echoPrefix}${qAnswer}\n\n${confirmMsg}` : `${echoPrefix}${confirmMsg}`
    }
    return `${echoPrefix}${confirmMsg}`
  }

  return await buildAskMissing(text, newG, missing, studioCtx, conv, userQuestion)
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm phase — waits for yes/no, handles changes
// ─────────────────────────────────────────────────────────────────────────────
async function handleConfirmPhase(id, text, conv, services, studioCtx, llm = {}) {
  const g = conv.g || {}
  const intent = llm.intent || 'outro'
  const userQuestion = llm.question || (text.includes('?') ? text : null)

  // Mudança de data ou serviço — verifica ANTES do isDeny (LLM às vezes retorna negar + date_iso)
  const changeField = llm.change_field || null
  const isBundle = g.bundleServices?.length > 1

  if (changeField === 'data' || changeField === 'horario' || (intent === 'mudar_data' && llm.date_iso) || (intent === 'negar' && llm.date_iso)) {
    const newDate = llm.date_iso || (changeField === 'horario' ? g.date : null)
    if (newDate) {
      const avail = await getAvailability(isBundle ? g.bundleServices.map(s=>s.id) : g.service.id, newDate)
      if (!avail?.allAvailableSlots?.length) return handleNoAvailability(id, conv, newDate, studioCtx)
      conv.g = { ...g, date: newDate, slots: avail.allAvailableSlots, slotAssignments: avail.slotAssignments || {}, time: undefined }
      conv.phase = 'booking'; saveConv(id, conv)
      return buildSlotListMsg(conv.g, conv.whatsappName)
    }
  }
  if (changeField === 'servico') {
    const newSvc = llm.service ? services.find(s => norm(s.name) === norm(llm.service)) || matchServiceKeyword(text, services) : matchServiceKeyword(text, services)
    if (newSvc) {
      conv.g = { ...g, service: newSvc, bundleServices: null, date: undefined, slots: undefined, time: undefined }
      conv.phase = 'booking'; saveConv(id, conv)
      return await reply(`Cliente mudou pra ${newSvc.name}. Pergunte qual data.`, studioCtx, `Sem problema! Pra ${newSvc.name}, qual data você prefere?`, conv)
    }
  }

  // Negar (LLM detecta "não quero assim", "prefiro mudar", etc. além do regex)
  const isDeny = intent === 'negar' || (isNo(text) && !userQuestion)
  if (isDeny) {
    conv.phase = 'booking'; saveConv(id, conv)
    return await reply('Cliente não confirmou. Pergunte o que quer mudar de forma natural e simpática.', studioCtx, 'O que você gostaria de mudar?', conv)
  }

  // Fallback: regex detectMindChange para compatibilidade
  const change = detectMindChange(text, { data: g, state: 'await_confirm' }, services)
  if (change?.type === 'date') {
    const avail = await getAvailability(isBundle ? g.bundleServices.map(s=>s.id) : g.service.id, change.value)
    if (!avail?.allAvailableSlots?.length) return handleNoAvailability(id, conv, change.value, studioCtx)
    conv.g = { ...g, date: change.value, slots: avail.allAvailableSlots, slotAssignments: avail.slotAssignments || {}, time: undefined }
    conv.phase = 'booking'; saveConv(id, conv)
    return buildSlotListMsg(conv.g, conv.whatsappName)
  }
  if (change?.type === 'service') {
    conv.g = { ...g, service: change.value, bundleServices: null, date: undefined, slots: undefined, time: undefined }
    conv.phase = 'booking'; saveConv(id, conv)
    return await reply(`Cliente mudou pra ${change.value.name}. Pergunte qual data.`, studioCtx, `Sem problema! Pra ${change.value.name}, qual data você prefere?`, conv)
  }
  if (change?.type === 'restart') { resetConv(id); return 'Claro! Como posso te ajudar?' }

  // Confirmar (LLM detecta "isso mesmo", "pode ser", "tá bom", etc. além do regex)
  if (intent === 'confirmar' || isYes(text)) {
    return await createBookingFromGathered(id, g, conv, studioCtx, userQuestion)
  }

  // Preferência de profissional no confirm — "com a Kelly", "quero a Grace Kelly"
  const allConfirmProfs = isBundle
    ? g.bundleServices.flatMap(s => s.professionals || [])
    : (g.service?.professionals || [])
  const requestedProf = allConfirmProfs.length ? extractRequestedProfessional(text, allConfirmProfs) : null
  if (requestedProf) {
    const currentAssignments = isBundle ? (g.slotAssignments?.[g.time] || []) : []
    const alreadyAssigned = currentAssignments.find(a => a.professionalId === requestedProf.id)
    const profDisplayName = requestedProf.displayName || requestedProf.name
    if (alreadyAssigned) {
      // Já está atribuída — confirma e mostra o card
      return `Já está com a ${profDisplayName} mesmo! 😊\n\n${buildConfirmMsg(g, conv.whatsappName)}`
    }
    // Não está atribuída — volta ao booking para buscar slots com essa profissional
    conv.g = { ...g, time: undefined, slots: undefined, slotAssignments: undefined, professional: requestedProf }
    conv.phase = 'booking'; saveConv(id, conv)
    const avail = await getAvailability(isBundle ? g.bundleServices.map(s => s.id) : g.service.id, g.date)
    if (avail?.allAvailableSlots?.length) {
      conv.g = { ...conv.g, slots: avail.allAvailableSlots, slotAssignments: avail.slotAssignments || {} }
      saveConv(id, conv)
      return buildSlotListMsg(conv.g, conv.whatsappName)
    }
    return await reply(`Não há horário disponível com a ${profDisplayName} em ${formatDatePt(g.date)}. Sugira tentar outra data.`, studioCtx, `Não encontrei horário com a ${profDisplayName} para essa data. Quer tentar outro dia?`, conv)
  }

  // Ambíguo ou pergunta — responde e re-confirma (determinístico)
  const confirmMsg = buildConfirmMsg(g, conv.whatsappName)
  if (userQuestion) {
    const qAnswer = await reply(
      `Responda brevemente em 1-2 frases: "${userQuestion}". Seja direta.`,
      studioCtx, '', conv
    )
    return qAnswer ? `${qAnswer}\n\n${confirmMsg}` : confirmMsg
  }
  return confirmMsg
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking creation (called from confirm phase)
// ─────────────────────────────────────────────────────────────────────────────
async function createBookingFromGathered(id, g, conv, studioCtx, pendingQuestion = null) {
  const { service, date, time, name, professional, bundleServices, slotAssignments, combinedService } = g
  const profId = professional?.id || null
  const profName = professional ? (professional.displayName || professional.name) : null
  const isBundle = bundleServices?.length > 1
  const assignments = isBundle ? (slotAssignments?.[time] || []) : []

  const bookingPayload = {
    name, phone: id, date, time,
    ...(isBundle
      ? { serviceIds: bundleServices.map(s => s.id), professionalSelections: assignments.map(a => ({ serviceId: a.serviceId, professionalId: a.professionalId })) }
      : { serviceId: service.id, professionalId: profId }),
  }

  const result = await createBooking(bookingPayload)
  if (!result.ok) {
    if (result.status === 409) {
      conv.g = { ...g, time: undefined, slots: undefined }
      conv.phase = 'booking'; saveConv(id, conv)
      return await reply('Horário ocupado agora mesmo. Informe gentilmente e ofereça os outros horários disponíveis.', studioCtx, 'Esse horário acabou de ser ocupado 😕 Quer tentar outro?', conv)
    }
    return 'Tive um probleminha ao confirmar. Pode tentar de novo ou entrar em contato!'
  }

  const bookingId = result.data?.bookingId || result.data?.bookingIds?.[0]
  const automation = result.data?.automation || {}

  // Para bundle (Pé + Mão), usa o preço do serviço combinado do catálogo quando existir.
  // O server soma os preços individuais (R$35 + R$35 = R$70), mas o studio cobra R$60 pelo conjunto.
  const individualSum = isBundle ? bundleServices.reduce((sum, s) => sum + (s.priceCents ?? 0), 0) : 0
  const priceCents = isBundle
    ? (combinedService?.priceCents || individualSum)
    : (service.priceCents ?? 0)

  const requiresDeposit = Boolean(automation.requiresDeposit || (isBundle && priceCents > PIX_THRESHOLD_CENTS))

  const successMsg = automation.bookingSummaryMessage || buildSuccessMsg(g, conv.whatsappName)

  if (!requiresDeposit) {
    resetConv(id)
    if (pendingQuestion) {
      const qAnswer = await reply(`Responda brevemente em 1-2 frases: "${pendingQuestion}". Seja direta.`, studioCtx, '', conv)
      return qAnswer ? `${qAnswer}\n\n${successMsg}` : successMsg
    }
    return successMsg
  }

  conv.phase = 'payment'; conv.bookingId = bookingId; conv.priceCents = priceCents; saveConv(id, conv)
  if (pendingQuestion) {
    const qAnswer = await reply(`Responda brevemente em 1-2 frases: "${pendingQuestion}". Seja direta.`, studioCtx, '', conv)
    await sendMessage(id, qAnswer ? `${qAnswer}\n\n${successMsg}` : successMsg)
  } else {
    await sendMessage(id, successMsg)
  }
  // Para bundle, sempre usa nossa mensagem PIX com o preço correto (combinado).
  // O server calcula pelo preço individual dos agendamentos (não sabe do desconto conjunto).
  return isBundle ? buildPixRequestMsg(priceCents) : (automation.paymentMessage || buildPixRequestMsg(priceCents))
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment phase
// ─────────────────────────────────────────────────────────────────────────────
async function handlePaymentPhase(id, text, conv, services, studioCtx, llm = {}) {
  const intent = llm.intent || 'outro'
  // Text claim of payment — ask for actual proof image (confirmation happens on image receipt)
  if (isPagou(text) || /\b(comprovante|pago|pix feito|transferencia|ja mandei|mandei o pix)\b/.test(norm(text))) {
    return await reply(
      `Cliente disse que fez o pagamento. Peça gentilmente que mande o comprovante como foto/imagem aqui no WhatsApp para confirmar.`,
      `${studioCtx}\n${bookingCtx(conv)}`,
      `Que ótimo! Manda o comprovante aqui pra mim como foto que já confirmo o seu horário 😊`,
      conv
    )
  }
  if (isNo(text) || /\b(nao vou pagar|desisti|nao quero mais|cancela|nao quero|esquece|deixa pra la|nao tenho|sem dinheiro)\b/.test(norm(text))) {
    if (conv.bookingId) await cancelBookingById(conv.bookingId)
    conv.phase = 'booking'
    conv.g = {}; conv.bookingId = null; conv.priceCents = null
    saveConv(id, conv)
    return await reply('Diga que cancelou o agendamento e que pode ajudar quando quiser.', studioCtx, 'Tudo bem, cancelei! Se quiser remarcar depois é só chamar 😊', conv)
  }
  if (/\b(em dinheiro|dinheiro|pagar la|pago la|pago na hora|pago presencial|cartao|cartão|na hora|no ato)\b/.test(norm(text))) {
    return await reply(
      `Cliente quer pagar em dinheiro ou no ato. Explique que pra GARANTIR o horário o estúdio pede 50% de sinal via PIX antecipado. Sem o sinal o horário pode ser liberado pra outra cliente.`,
      `${studioCtx}\n${bookingCtx(conv)}`,
      `Aceitamos dinheiro na hora sim! Mas pra garantir o horário a gente pede um sinalzinho de 50% via PIX. Sem o sinal o horário pode ser liberado pra outra cliente 😊 Quer enviar o PIX?`,
      conv
    )
  }
  // Perguntas de informação (ex: "quanto custa o pé?") — NÃO tratar como booking intent
  // Responde a pergunta e lembra sutilmente do PIX
  if (isInfoQuestion(text) && !isPagou(text)) {
    return await reply(
      `Responda a pergunta: "${text}". Depois lembre sutilmente que o horário precisa do sinal via PIX para ser garantido.`,
      `${studioCtx}\n${bookingCtx(conv)}`,
      `Me manda o comprovante do PIX quando fizer que confirmo na hora 😊`,
      conv
    )
  }

  // Perguntando sobre agendar outro serviço/horário durante o pagamento
  if (isBookingIntent(text, services || []) && !isInfoQuestion(text)) {
    const curSvc = conv.g?.bundleServices?.length > 1
      ? conv.g.bundleServices.map(s => s.name).join(' e ')
      : (conv.g?.service?.name || 'serviço')
    return await reply(
      `A cliente perguntou sobre agendar outro serviço. Diga que com prazer vai ajudar com isso, mas que primeiro precisa confirmar o ${curSvc} com o PIX. Depois confirmar é só falar novamente.`,
      `${studioCtx}\n${bookingCtx(conv)}`,
      `Com prazer! Depois de confirmar o ${curSvc} com o PIX, pode chamar que marco o outro serviço também 😊 Me manda o comprovante quando fizer!`,
      conv
    )
  }

  // Qualquer outra mensagem — LLM responde e lembra do PIX
  return await reply(
    `Responda a mensagem da cliente: "${text}". Depois lembre sutilmente que o horário precisa do sinal via PIX para ser garantido. NÃO envie o PIX de novo — só lembre que aguarda o comprovante.`,
    `${studioCtx}\n${bookingCtx(conv)}`,
    `Me manda o comprovante do PIX quando fizer que confirmo na hora 😊`,
    conv
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel phase
// ─────────────────────────────────────────────────────────────────────────────
async function handleCancelSelectPhase(id, text, conv, studioCtx) {
  if (/\b(sair|voltar|encerrar|tchau)\b/.test(norm(text))) { resetConv(id); return 'Ok! Se precisar é só chamar.' }
  const active = conv.activeBookings || []
  const num = parseInt(norm(text))
  const booking = (!isNaN(num) && num >= 1 && num <= active.length)
    ? active[num-1]
    : active.find(b => norm(text).includes(norm(b.service_name_snapshot)))
  if (!booking) {
    const list = active.map(b => `${b.service_name_snapshot} (${formatDatePt(b.booking_date)} às ${b.booking_time})`).join(' ou ')
    return await reply(`Não entendeu qual cancelar. Especifique: ${list}`, studioCtx, `Qual agendamento você quer cancelar? Você tem ${list}.`, conv)
  }
  conv.selectedBooking = booking; saveConv(id, conv)
  return await reply(`Confirme que vai cancelar e pergunte se tem certeza.`, `${studioCtx}\nAgendamento: ${booking.service_name_snapshot} em ${formatDatePt(booking.booking_date)} às ${booking.booking_time}.`, `Você quer cancelar o ${booking.service_name_snapshot} da ${formatDatePt(booking.booking_date)} às ${booking.booking_time}, tem certeza?`, conv)
}

async function handleCancelConfirmPhase(id, text, conv, studioCtx) {
  if (isYes(text)) {
    const result = await cancelBookingById(conv.selectedBooking.id)
    if (!result.ok) return 'Não consegui cancelar agora. Tenta de novo ou entra em contato!'
    conv.phase = 'closing'; conv.g = {}; conv.selectedBooking = null; conv.activeBookings = null
    saveConv(id, conv)
    return await reply(`Confirme o cancelamento de forma natural e pergunte se pode ajudar em algo mais.`, studioCtx, `Cancelado! 😊 Te ajudo em algo mais?`, conv)
  }
  if (isNo(text)) {
    conv.phase = 'closing'; saveConv(id, conv)
    return await reply('Diga que manteve o agendamento e pergunte se pode ajudar em algo mais.', studioCtx, 'Ótimo, então mantido! 😊 Te ajudo em algo mais?', conv)
  }
  return await reply('Peça pra confirmar o cancelamento ou não.', studioCtx, 'Confirma o cancelamento?', conv)
}

async function startCancelFlow(id, conv, active, studioCtx) {
  if (!active.length) return await reply('Diga que não tem agendamentos ativos.', studioCtx, 'Não encontrei agendamentos ativos no seu número!', conv)
  const list = active.map(b => `${b.service_name_snapshot} (${formatDatePt(b.booking_date)} às ${b.booking_time})`).join(' e ')
  conv.phase = 'cancel'; conv.activeBookings = active; conv.selectedBooking = null; saveConv(id, conv)
  return await reply(`Pergunte qual cancelar, mencionando os agendamentos naturalmente.`, `${studioCtx}\nAgendamentos: ${list}.`, `Você tem ${list}. Qual quer cancelar?`, conv)
}

async function showBookings(id, active, studioCtx, conv) {
  if (!active.length) return await reply('Diga que não tem agendamentos ativos.', studioCtx, 'Não encontrei agendamentos no seu número!', conv)
  const list = active.map(b => `${b.service_name_snapshot} na ${formatDatePt(b.booking_date)} às ${b.booking_time}${b.status === 'pending_payment' ? ' (aguardando pagamento PIX)' : ''}`).join(' e ')
  return await reply(`Informe os agendamentos de forma natural.`, `${studioCtx}\nAgendamentos: ${list}.`, `Você tem ${list} agendado!`, conv)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main router
// ─────────────────────────────────────────────────────────────────────────────
// Deduplicação de webhooks — Evolution API às vezes entrega a mesma mensagem 2x
const _seenMsgIds = new Map()
function _isDuplicate(msgId) {
  const now = Date.now()
  if (_seenMsgIds.has(msgId)) return true
  _seenMsgIds.set(msgId, now)
  for (const [k, v] of _seenMsgIds) if (now - v > 30000) _seenMsgIds.delete(k)
  return false
}

// Fase closing: conversa chegou a um ponto natural de encerramento.
// Farewell → reset total. Nova solicitação → sai do closing e processa normalmente.
async function handleClosingPhase(id, text, conv, services, studioCtx, llm) {
  const llmIntent = llm.intent || 'outro'
  if (llmIntent === 'despedida' || isFarewell(text)) {
    resetConv(id)
    return reply('Despeça-se de forma calorosa e curta, diga que pode ajudar quando precisar.', studioCtx, 'Até logo! Qualquer coisa é só chamar 😊', conv)
  }
  // Nova solicitação — sai do closing e retoma normalmente
  conv.phase = 'booking'
  saveConv(id, conv)
  return handleBookingPhase(id, text, conv, services, studioCtx, llm)
}

async function handleInbound(payload) {
  const remoteJid = payload?.data?.key?.remoteJid || ''
  if (payload?.data?.key?.fromMe) return { ignored: true, reason: 'fromMe' }
  if (remoteJid.includes('@g.us')) return { ignored: true, reason: 'group' }
  // Dedup só quando NÃO veio do buffer (buffer já fez dedup no servidor)
  const msgId = payload?.data?.key?.id
  if (msgId && !payload._combinedText && _isDuplicate(msgId)) return { ignored: true, reason: 'duplicate' }

  // Detecta mídia (áudio, imagem, sticker, vídeo)
  const hasImage = !!(payload?.data?.message?.imageMessage || payload?.data?.message?.documentMessage)
  const hasMedia = payload?.data?.message && (
    payload.data.message.audioMessage ||
    payload.data.message.imageMessage ||
    payload.data.message.videoMessage ||
    payload.data.message.stickerMessage ||
    payload.data.message.documentMessage
  )
  if (hasMedia) {
    const convNow = getConv(remoteJid)
    // Na fase de payment, imagem = comprovante PIX
    if (hasImage && (convNow.phase === 'payment' || convNow.state === 'await_payment')) {
      const name = convNow.g?.name || convNow.data?.customerName || ''
      resetConv(remoteJid)
      await sendMessage(remoteJid, `Recebi o comprovante! 🙏 Vou confirmar o pagamento aqui e já te aviso, ${name.split(' ')[0] || ''}! Te esperamos 😊`)
      return { ignored: false, reason: 'payment_proof_received' }
    }
    if (!hasImage) {
      // Áudio/vídeo/sticker → pede pra digitar
      await sendMessage(remoteJid, 'Não consigo ouvir áudios aqui, mas pode digitar que respondo na hora! 😊')
    }
    // Imagem fora do pagamento → silêncio, humano atende
    return { ignored: false, reason: 'media_replied' }
  }

  const text = (
    payload?._combinedText ||
    payload?.data?.message?.conversation ||
    payload?.data?.message?.extendedTextMessage?.text ||
    payload?.data?.text || ''
  ).trim()

  if (!remoteJid || !text) return { ignored: true, reason: 'no jid or text' }

  // Nome do WhatsApp da pessoa (pushName vem no payload do Evolution API)
  const pushName = (payload?.data?.pushName || payload?.data?.key?.pushName || '').trim()

  const id = remoteJid
  const conv = getConv(id)

  const pendingCustomerConfirmation = await getPendingCustomerConfirmation(id)
  if (pendingCustomerConfirmation) {
    if (isYes(text)) {
      await registerCustomerConfirmationResponse(pendingCustomerConfirmation.bookingId, 'confirmed')
      await sendMessage(id, `Perfeito! Ja deixei confirmado aqui. Te esperamos na ${formatDatePt(pendingCustomerConfirmation.bookingDate)} as ${pendingCustomerConfirmation.bookingTime}.`)
      return { ignored: false, reason: 'customer_confirmation_confirmed' }
    }

    if (isNo(text) || /\b(remarcar|mudar|nao vou conseguir|nao consigo|nao posso|vou me atrasar)\b/.test(norm(text))) {
      await registerCustomerConfirmationResponse(pendingCustomerConfirmation.bookingId, 'declined')
      await sendMessage(id, 'Obrigada por me avisar. Vou sinalizar a equipe daqui para seguir com voce, tudo bem?')
      return { ignored: false, reason: 'customer_confirmation_declined' }
    }
  }

  // Salva o nome do WhatsApp na conversa (atualiza a cada mensagem caso mude)
  if (pushName && !conv.whatsappName) {
    conv.whatsappName = pushName
    saveConv(id, conv)
  }

  // Carrega contexto do estúdio (cache na conversa)
  let services = conv.data?.services
  let contact = conv.data?.contact
  let businessHours = conv.data?.businessHours
  if (!services) {
    const fetched = await fetchStudio()
    services = fetched.services
    contact = fetched.contact
    businessHours = fetched.businessHours
    saveConv(id, conv)
  }
  const { testimonials = [] } = await fetchStudio()
  const studioCtxBase = buildStudioCtx(services, contact, businessHours, testimonials)

  // ── Tratamentos globais ──
  const history = conv.history || []
  const historyLines = history.length
    ? `\nHistórico da conversa:\n${history.map(h => `${h.from === 'user' ? 'Cliente' : 'Julia'}: ${h.text}`).join('\n')}`
    : ''
  const currentBCtx = bookingCtx(conv)
  const studioCtx = studioCtxBase
    + (currentBCtx ? `\nAgendamento em andamento: ${currentBCtx}` : '')
    + historyLines
  const tGlobal = norm(text)
  const phase = conv.phase || 'booking'

  // Saída / abort explícito em qualquer fase ativa
  if (phase !== 'booking' || (conv.g && Object.values(conv.g).some(v => v !== null && v !== undefined))) {
    const isBye = /\b(tchau|ate mais|flw|ate logo|sair|encerrar|obrigad|valeu|vlw|ate ja|xau|era so isso|so era isso|por enquanto e so|nao preciso de mais|mais nada)\b/.test(tGlobal)
    const isAbort = /\b(desistir|desisti|nao quero mais|esquece|deixa pra la|chega|nao quero|abort|para tudo|pode parar)\b/.test(tGlobal)
    if (isBye || isAbort) {
      if (isAbort && conv.bookingId) await cancelBookingById(conv.bookingId)
      // Em payment + despedida simples: não reseta — só confirma que aguarda comprovante
      if (phase === 'payment' && isBye && !isAbort) {
        const ack = 'Ótimo! Me manda o comprovante do PIX quando estiver pronto e seu horário fica garantido 😊'
        pushHistory(conv, 'user', text)
        pushHistory(conv, 'agent', ack)
        saveConv(id, conv)
        await sendMessage(id, ack)
        return { ignored: false, phase: 'payment' }
      }
      resetConv(id)
      const farewell = isBye
        ? 'Ok! Se precisar é só chamar 😊'
        : 'Tudo bem, cancelei tudo! Quando quiser marcar de novo é só chamar 😊'
      await sendMessage(id, farewell)
      return { ignored: false, state: 'idle' }
    }
  }

  // "Você é robô?"
  if (isRobotQuestion(text)) {
    const msg = await reply(
      `O cliente perguntou se você é robô. Seja honesta mas natural: diga que é a Julia, atendente virtual do SC Studio, e que funciona direitinho! Ofereça ajuda.`,
      studioCtx, `Sou a Julia, atendente virtual do SC Studio 😊 Posso te ajudar com agendamentos, informações e muito mais! Como posso te ajudar?`, conv
    )
    pushHistory(conv, 'user', text); pushHistory(conv, 'agent', msg); saveConv(id, conv)
    await sendMessage(id, msg); return { ignored: false, state: conv.state }
  }

  // ── LLM extraction (1 chamada por mensagem, compartilhada com todos os handlers) ──
  const llm = await extractWithLLM(text, services, conv.g || {}, conv.history || [])
  const llmIntent = llm.intent || 'outro'

  // ── Roteamento por fase ──────────────────────────────────────────────────────
  // Fases ativas (payment / confirm / cancel): vão DIRETO ao handler da fase.
  // Nenhum filtro global intercepta — cada handler já trata perguntas, elogios, etc.
  // Fase booking sem serviço: passa pelos filtros globais (info, recomendação, etc.)
  // ─────────────────────────────────────────────────────────────────────────────
  const isActivephase = phase === 'payment' || phase === 'confirm' || phase === 'cancel' || phase === 'closing'

  let msg
  let infoResume = null
  try {
    if (isActivephase) {
      // ── Fases ativas: handler direto ──
      if (phase === 'payment') {
        msg = await handlePaymentPhase(id, text, conv, services, studioCtx, llm)
      } else if (phase === 'cancel') {
        msg = conv.selectedBooking
          ? await handleCancelConfirmPhase(id, text, conv, studioCtx)
          : await handleCancelSelectPhase(id, text, conv, studioCtx)
      } else if (phase === 'closing') {
        msg = await handleClosingPhase(id, text, conv, services, studioCtx, llm)
      } else {
        msg = await handleConfirmPhase(id, text, conv, services, studioCtx, llm)
      }
    } else {
      // ── Fase booking: LLM como árbitro único ──
      // Apenas llmIntent determina o ramo — sem regex duplicados disputando controle.
      // Todos os ramos atribuem a `msg`; o bloco inferior centraliza log, history e send.

      if ((llmIntent === 'despedida' || isFarewell(text)) && !conv.g?.service) {
        resetConv(id)
        msg = await reply('Despeça-se brevemente e diga que pode ajudar quando precisar.', studioCtx, 'Até logo! Se precisar de algo é só chamar 😊', conv)

      } else if (llmIntent === 'elogio' && !conv.g?.service) {
        msg = await reply(`Cliente fez um elogio. Responda de forma calorosa, use o nome se souber, e ofereça ajuda.`, studioCtx, `Que bom saber disso, fico feliz! 😊 Posso te ajudar com mais alguma coisa?`, conv)

      } else if (llmIntent === 'reclamacao' && !conv.g?.service) {
        msg = await reply(`Cliente tem uma reclamação. Reconheça com empatia e peça que detalhe o problema para poder ajudar.`, studioCtx, `Sinto muito por isso! 😔 Pode me contar melhor o que aconteceu? Quero resolver pra você.`, conv)

      } else if (llmIntent === 'info') {
        if (isRecommendation(text)) {
          const topSvcs = services.filter(s => s.category === 'unhas').slice(0, 3)
          const topTests = testimonials.slice(0, 2).map(t => `"${t.body.slice(0, 90)}" — ${t.authorName}`).join(' | ')
          const recCtx = [
            topSvcs.length ? `Serviços mais populares: ${topSvcs.map(s => `${s.name} (${s.price})`).join(', ')}.` : '',
            topTests ? `Depoimentos reais: ${topTests}` : '',
          ].filter(Boolean).join('\n') || studioCtx
          msg = await reply(
            `A cliente quer uma recomendação. Use os depoimentos reais e serviços populares do contexto para sugerir 1-2 serviços de forma calorosa e entusiasmada, mencionando o que clientes reais acharam. Ofereça para agendar.`,
            `${studioCtx}\n${recCtx}`, `O Alongamento é super querido aqui! Dura bastante e fica lindo 😍 Quer agendar?`, conv
          )
        } else {
          const direct = tryDirectAnswer(text, services, contact, businessHours)
          if (direct) {
            msg = direct
          } else {
            msg = await reply(
              `A cliente perguntou: "${text}". Responda de forma natural e calorosa usando APENAS os dados do contexto acima. Não invente informações.`,
              studioCtx,
              services.length ? `Posso te ajudar! Temos unhas, cílios e bem-estar 😊 Qual te interessa?` : `Pode me perguntar sobre serviços, preços, horários ou fazer um agendamento 😊`,
              conv
            )
          }
        }
        if (conv.g?.service) {
          // Booking parcial em andamento — lembra contexto
          infoResume = await resumeFlowHint(conv, studioCtx)
        } else {
          // Conversa de info sem booking — entra em closing para detectar encerramento
          conv.phase = 'closing'
          saveConv(id, conv)
          msg = msg + '\n\nTe ajudo em algo mais? 😊'
        }

      } else {
        // agendar, confirmar, negar, cancelar, mudar_*, saudacao, outro → booking handler
        // Mas verifica respostas diretas antes (ex: "quais serviços" que LLM pode classificar errado)
        const directFallback = !conv.g?.service ? tryDirectAnswer(text, services, contact, businessHours) : null
        if (directFallback) {
          msg = directFallback + '\n\nTe ajudo em algo mais? 😊'
          conv.phase = 'closing'; saveConv(id, conv)
        } else {
          msg = await handleBookingPhase(id, text, conv, services, studioCtx, llm)
        }
      }
    }
  } catch (err) {
    console.error('[agent] error:', err)
    msg = 'Desculpa, tive um probleminha aqui. Pode tentar de novo?'
  }

  if (msg) {
    if (!conv._reset) {
      pushHistory(conv, 'user', text)
      pushHistory(conv, 'agent', typeof msg === 'string' ? msg : '')
      saveConv(id, conv)
    }
    console.log('[out→' + id.split('@')[0] + ']', String(msg).slice(0, 300).replace(/\n/g, ' | '))
    await sendMessage(id, msg)
    if (infoResume) await sendMessage(id, infoResume)
  }
  console.log('[phase]', id.split('@')[0], conv.phase, '|', text.slice(0, 50))
  return { ignored: false, phase: conv.phase }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message buffer — agrega msgs em sequência rápida (ex: "pé e mão" + "pra sexta")
// ─────────────────────────────────────────────────────────────────────────────
const _msgBuffer  = new Map() // phone → { timer, texts, lastPayload }
const _userQueue  = new Map() // phone → Promise — garante processamento sequencial por usuário

function bufferMsg(remoteJid, text, payload, onDone) {
  const buf = _msgBuffer.get(remoteJid) || { texts: [], lastPayload: payload }
  clearTimeout(buf.timer)
  buf.texts.push(text)
  buf.lastPayload = payload
  buf.timer = setTimeout(() => {
    _msgBuffer.delete(remoteJid)
    onDone(buf.texts.join(' '), buf.lastPayload)
  }, 3500)
  _msgBuffer.set(remoteJid, buf)
}

function queueForUser(remoteJid, fn) {
  const prev = _userQueue.get(remoteJid) || Promise.resolve()
  const run = prev.catch(() => {}).then(fn)
  _userQueue.set(remoteJid, run)
  run.finally(() => {
    if (_userQueue.get(remoteJid) === run) _userQueue.delete(remoteJid)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP server
// ─────────────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (!req.url) { jsonRes(res, 404, { error: 'not found' }); return }
  if (req.method === 'GET' && req.url === '/health') { jsonRes(res, 200, { ok: true, model: GEMINI_MODEL }); return }
  if (req.method === 'POST' && req.url.startsWith('/webhooks/evolution')) {
    if (WEBHOOK_SECRET) {
      const secret = req.headers['x-evolution-secret'] || req.headers['x-webhook-secret']
      if (secret !== WEBHOOK_SECRET) { jsonRes(res, 401, { error: 'nao autorizado' }); return }
    }
    let payload
    try { payload = await readJson(req) } catch { jsonRes(res, 400, { error: 'invalid json' }); return }

    const bodyEvent = String(payload?.event || '').toLowerCase()
    const urlEvent = (req.url.split('/').pop() || '').toLowerCase().replace(/\./g, '_')
    const isMsg = bodyEvent.includes('messages') || urlEvent === 'messages_upsert' || urlEvent === 'messages-upsert'
    if (!isMsg) { jsonRes(res, 200, { ok: true, ignored: true }); return }

    const remoteJid = payload?.data?.key?.remoteJid || ''
    console.log('[webhook]', remoteJid.split('@')[0], payload?.data?.key?.fromMe ? 'fromMe' : 'in', (payload?.data?.message?.conversation || payload?.data?.message?.extendedTextMessage?.text || '').slice(0, 60))
    const fromMe = payload?.data?.key?.fromMe
    const isGroup = remoteJid.includes('@g.us')
    const hasMedia = payload?.data?.message && (
      payload.data.message.audioMessage || payload.data.message.imageMessage ||
      payload.data.message.videoMessage || payload.data.message.stickerMessage ||
      payload.data.message.documentMessage
    )
    const rawText = (
      payload?.data?.message?.conversation ||
      payload?.data?.message?.extendedTextMessage?.text ||
      payload?.data?.text || ''
    ).trim()

    if (fromMe || isGroup) { jsonRes(res, 200, { ok: true, ignored: true }); return }

    // Dedup antes de responder (não entra no buffer)
    const msgId = payload?.data?.key?.id
    if (msgId && _isDuplicate(msgId)) { jsonRes(res, 200, { ok: true, ignored: true, reason: 'duplicate' }); return }

    if (AGENT_V2_ENABLED) {
      jsonRes(res, 200, { ok: true, queued: true, bridge: 'agent-v2' })
      forwardWebhookToApp(payload)
        .then(result => console.log('[agent-v2-bridge]', remoteJid.split('@')[0], result.status, result.ok ? 'ok' : JSON.stringify(result.data).slice(0, 120)))
        .catch(err => console.error('[agent-v2-bridge] error:', err.message))
      return
    }

    // Responde imediatamente — processamento é async
    jsonRes(res, 200, { ok: true, queued: true })

    if (hasMedia || !rawText) {
      // Mídia vai direto (áudio, comprovante PIX, etc.)
      handleInbound(payload).catch(err => console.error('[async-media] error:', err))
      return
    }

    // Mensagens de texto: buffer de 3.5s para agregar msgs em sequência rápida
    bufferMsg(remoteJid, rawText, payload, (combinedText, lastPayload) => {
      queueForUser(remoteJid, () =>
        handleInbound({ ...lastPayload, _combinedText: combinedText })
          .catch(err => console.error('[buffer] error:', err))
      )
    })
    // Nota: buffer junta msgs com ' ' — "oi boa noite" chega como texto único
    return
  }
  jsonRes(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(`SC Studio agent v7 (gemini) | port ${PORT} | model ${GEMINI_MODEL}`)
})
