import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  serviceName: z.string().min(1),
  serviceDuration: z.string(),
  servicePrice: z.string(),
  date: z.string(),
  time: z.string(),
  notes: z.string().optional(),
})

async function sendZAPI(phone: string, message: string): Promise<boolean> {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN
  if (!instanceId || !token) return false
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clientToken ? { 'Client-Token': clientToken } : {}),
        },
        body: JSON.stringify({ phone, message }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}

const OWNER_PHONE = '5531990725053'
const STUDIO_ADDRESS = 'Rua Padre Correia de Almeida, 38 — Santa Efigênia, BH'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { name, phone, serviceName, serviceDuration, servicePrice, date, time, notes } =
    parsed.data

  const ownerMsg = [
    '🌸 *Novo Agendamento — SC Studio*',
    '',
    `👤 *Cliente:* ${name}`,
    `📱 *WhatsApp:* ${phone}`,
    `✂️ *Serviço:* ${serviceName} (${serviceDuration})`,
    `📅 *Data:* ${date}`,
    `🕐 *Horário:* ${time}`,
    `💰 *Valor:* ${servicePrice}`,
    ...(notes ? [`📝 *Obs:* ${notes}`] : []),
    '',
    '_Responda a este número para confirmar ou cancelar._',
  ].join('\n')

  const clientMsg = [
    '🌸 *Agendamento Solicitado — SC Studio & Esmalteria*',
    '',
    `Olá, ${name}! 😊`,
    'Seu agendamento foi solicitado com sucesso!',
    '',
    `✂️ *Serviço:* ${serviceName}`,
    `📅 *Data:* ${date}`,
    `🕐 *Horário:* ${time}`,
    `💰 *Valor:* ${servicePrice}`,
    `📍 ${STUDIO_ADDRESS}`,
    '',
    '*⚠️ Cancelamentos:* Avise com pelo menos 2h de antecedência.',
    '',
    'Aguardamos você! 💅',
  ].join('\n')

  const clientPhone = formatPhone(phone)
  const ownerSent = await sendZAPI(OWNER_PHONE, ownerMsg)
  const clientSent = await sendZAPI(clientPhone, clientMsg)

  return NextResponse.json({
    success: true,
    ownerSent,
    clientSent,
    ownerWhatsAppFallback: `https://wa.me/${OWNER_PHONE}?text=${encodeURIComponent(ownerMsg)}`,
    clientWhatsAppFallback: `https://wa.me/${clientPhone}?text=${encodeURIComponent(clientMsg)}`,
  })
}
