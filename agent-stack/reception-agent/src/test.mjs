/**
 * Testes da camada 1: funções puras e máquina de estados
 * Rodar: node src/test.mjs
 *
 * NÃO testa LLM nem rede — apenas lógica determinística.
 */

// ─── helpers inline (cópia das funções do index.mjs) ───────────────────────
function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim() }
function cleanText(s) { return norm(s).replace(/[^a-z0-9\s]/g, '') }

const WEEKDAYS_PT = { domingo:0, segunda:1,'segunda-feira':1, terca:2,'terca-feira':2, quarta:3,'quarta-feira':3, quinta:4,'quinta-feira':4, sexta:5,'sexta-feira':5, sabado:6 }
const MONTHS_PT = { janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 }

function toIso(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

function parseDate(text) {
  const t = norm(text)
  const today = new Date(); today.setHours(0,0,0,0)
  if (/\bhoje\b/.test(t)) return toIso(today)
  if (/depois de amanha/.test(t)) { const d=new Date(today); d.setDate(d.getDate()+2); return toIso(d) }
  if (/\bamanha\b/.test(t)) { const d=new Date(today); d.setDate(d.getDate()+1); return toIso(d) }
  const diaMatch = t.match(/\bdia\s+(\d{1,2})\b/)
  if (diaMatch) { const day=parseInt(diaMatch[1]); const d=new Date(today.getFullYear(),today.getMonth(),day); if(d<today)d.setMonth(d.getMonth()+1); if(!isNaN(d.getTime())&&day>=1&&day<=31)return toIso(d) }
  const dm = t.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
  if (dm) { let y=dm[3]?parseInt(dm[3]):today.getFullYear(); if(y<100)y+=2000; const d=new Date(y,parseInt(dm[2])-1,parseInt(dm[1])); if(!isNaN(d.getTime())&&d>=today)return toIso(d) }
  const mMatch = t.match(/(\d{1,2})\s+de\s+([a-z]+)/)
  if (mMatch) { const month=MONTHS_PT[mMatch[2]]; if(month){const d=new Date(today.getFullYear(),month-1,parseInt(mMatch[1]));if(d<today)d.setFullYear(d.getFullYear()+1);return toIso(d)} }
  const isNext = /pr[oó]xim[ao]|semana que vem/.test(t)
  for (const [name, wday] of Object.entries(WEEKDAYS_PT)) {
    if (t.includes(name)) { const d=new Date(today); const diff=((wday-d.getDay())+7)%7; d.setDate(d.getDate()+(diff===0?7:diff)+(isNext?7:0)); return toIso(d) }
  }
  return null
}

function detectPeriod(text) {
  const t = norm(text)
  if (/\b(manha|cedo|começo|primeiro horario|abertura|mais cedo|hora do almoco)\b/.test(t)) return 'manha'
  if (/\b(tarde|pos almoco|depois do almoco|meio da tarde)\b/.test(t)) return 'tarde'
  if (/\b(noite|fim do dia|ultimo horario|mais tarde|final)\b/.test(t)) return 'noite'
  return null
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

function hasBothPeriods(slots) {
  return slots.some(s => parseInt(s.split(':')[0]) < 12) && slots.some(s => parseInt(s.split(':')[0]) >= 12)
}

const SERVICE_SYNONYMS = [
  [/\bblindagem\b/g, 'banho de gel'],
  [/\bblindado\b/g, 'banho de gel'],
  [/\bmanicure\b/g, 'esmaltacao'],
  [/\bpedicure\b/g, 'esmaltacao'],
  [/\bcolocar cilios\b/g, 'cilios'],
  [/\bcolocacao de cilios\b/g, 'cilios'],
  [/\bdesign de cilios\b/g, 'cilios'],
  [/\bextensao de cilios\b/g, 'cilios'],
  [/\bcilio\b/g, 'cilios'],
  [/\bextensao de unhas\b/g, 'alongamento'],
  [/\bunha de gel\b/g, 'banho de gel'],
]
function applySynonyms(text) {
  let t = cleanText(text)
  for (const [re, canon] of SERVICE_SYNONYMS) t = t.replace(re, canon)
  return t
}

function isBookingIntent(text, services = []) {
  const t = norm(text)
  const tSyn = applySynonyms(text)
  return (
    /\b(agendar|agende|agendem|marcar|marca\b|marque|marquem|reservar|reserve|quero marcar|quero agendar|queria agendar|precisava agendar|preciso agendar|preciso marcar|quero fazer|queria fazer|quero colocar|queria colocar|coloca\b|coloque\b|vou agendar|vim agendar|gostaria de agendar|gostaria de marcar|gostaria de fazer)\b/.test(t) ||
    /\b(tem horario|tem horarios|tem disponibilidade|tem vaga|tem disponivel|voces tem|voce tem|tem como marcar|tem como agendar|teria como|teria um horario|seria possivel|consigo horario|consigo marcar|consigo agendar|consegue marcar|consegue agendar|posso marcar|posso agendar|da pra marcar|da pra agendar|ha horario|ha disponibilidade|tem um espacinho|tem espacinho)\b/.test(t) ||
    services.some(s => t.includes(norm(s.name))) ||
    services.some(s => tSyn.includes(cleanText(s.name)))
  )
}

// ─── runner ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0
function test(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected)
  if (ok) { passed++; console.log(`  ✅ ${label}`) }
  else { failed++; console.log(`  ❌ ${label}\n     got:      ${JSON.stringify(got)}\n     expected: ${JSON.stringify(expected)}`) }
}

// ─── parseDate ──────────────────────────────────────────────────────────────
console.log('\n📅 parseDate')
const today = new Date(); today.setHours(0,0,0,0)
const d = (n) => { const x=new Date(today); x.setDate(x.getDate()+n); return toIso(x) }
const nextWeekday = (wday) => { const x=new Date(today); const diff=((wday-x.getDay())+7)%7; x.setDate(x.getDate()+(diff===0?7:diff)); return toIso(x) }

test('hoje',         parseDate('hoje'),            toIso(today))
test('amanha',       parseDate('amanhã'),           d(1))
test('depois amanha',parseDate('depois de amanhã'), d(2))
test('sexta-feira',  parseDate('sexta-feira'),      nextWeekday(5))
test('quarta',       parseDate('quarta'),           nextWeekday(3))
test('sabado',       parseDate('sábado'),           nextWeekday(6))
test('proxima sexta',parseDate('próxima sexta'),    (() => { const x=new Date(today); const diff=((5-x.getDay())+7)%7; x.setDate(x.getDate()+(diff===0?7:diff)+7); return toIso(x) })())
test('nenhuma data', parseDate('olá tudo bem?'),    null)

// ─── detectPeriod ───────────────────────────────────────────────────────────
console.log('\n🌅 detectPeriod')
test('de manhã',          detectPeriod('quero de manhã'),             'manha')
test('à tarde',           detectPeriod('prefiro à tarde'),            'tarde')
test('de tarde (sem acento)', detectPeriod('de tarde'),               'tarde')
test('à noite',           detectPeriod('só à noite'),                 'noite')
test('sem período',       detectPeriod('quero banho de gel sexta'),   null)
test('tem horario de tarde?', detectPeriod('tem horario de tarde?'),  'tarde')

// ─── filterSlotsByPeriod ────────────────────────────────────────────────────
console.log('\n🕐 filterSlotsByPeriod')
const slots = ['08:00','09:30','11:00','12:00','14:00','16:00','18:00','20:00']
test('manha',  filterSlotsByPeriod(slots,'manha'),  ['08:00','09:30','11:00'])
test('tarde',  filterSlotsByPeriod(slots,'tarde'),  ['12:00','14:00','16:00'])
test('noite',  filterSlotsByPeriod(slots,'noite'),  ['18:00','20:00'])
test('hasBothPeriods true',  hasBothPeriods(slots), true)
test('hasBothPeriods false', hasBothPeriods(['08:00','09:00']), false)

// ─── applySynonyms ──────────────────────────────────────────────────────────
console.log('\n🔄 applySynonyms')
test('blindagem → banho de gel', applySynonyms('blindagem nas unhas'), 'banho de gel nas unhas')
test('manicure → esmaltacao',    applySynonyms('quero manicure'),      'quero esmaltacao')
test('pedicure → esmaltacao',    applySynonyms('pedicure dos pes'),    'esmaltacao dos pes')
test('cilio → cilios',           applySynonyms('colocar cilio'),       'colocar cilios')
test('colocar cilios → cilios',  applySynonyms('colocar cilios'),      'cilios')
test('una de gel → banho de gel',applySynonyms('unha de gel'),         'banho de gel')
test('sem sinônimo',             applySynonyms('banho de gel'),        'banho de gel')

// ─── isBookingIntent ────────────────────────────────────────────────────────
console.log('\n🎯 isBookingIntent (as 13 msgs reais)')
const fakeServices = [
  { name: 'Banho de Gel' }, { name: 'Esmaltação de unha Mão' },
  { name: 'Esmaltação de unha Pé' }, { name: 'Pé e Mão' },
  { name: 'Alongamento de Unhas' }, { name: 'Cílios' },
]
const cases = [
  ['Oi você tem horário para sexta-feira para pé blindagem da mão',   true],
  ['Olá meninas agendem por favor pé e mão pra mim quarta-feira dia 27', true],
  ['seria possível um horário para pé e mão hoje ou amanhã',           true],
  ['você tem horário disponível para sábado após as 11h00',            true],
  ['Gostaria de agendar para sábado à tarde pé e mão',                 true],
  ['quero marcar pé e mão com a Suellen tem horário sábado',           true],
  ['vou ter que desmarcar a unha desse sábado',                        false], // cancelamento, não booking
  ['Tem horário pra manutenção hoje',                                  true],
  ['vocês tem horário para amanhã depois das 9:00',                    true],
  ['Marca pé e mão pra mim por favor',                                 true],
  ['gostaria de marcar um horário você tem horário pra colocar cílios',true],
  ['consigo horário pra pé e mão amanhã',                              true],
  ['tem horário pra pé e mão amanhã',                                  true],
]
for (const [msg, expected] of cases) {
  test(msg.slice(0, 55) + (msg.length > 55 ? '…' : ''), isBookingIntent(msg, fakeServices), expected)
}

// ─── resultado ──────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`)
console.log(`Resultado: ${passed} ✅  ${failed} ❌  de ${passed+failed} testes`)
if (failed === 0) console.log('Tudo passando! 🎉')
else console.log(`${failed} falharam — corrigir antes de deploy.`)
