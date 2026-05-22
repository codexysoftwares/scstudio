import { NextResponse } from 'next/server'
import { isDatabaseConfigured, query } from '@/lib/db'

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ transfers: [] })
  }
  try {
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ transfers: [] })

    const r = await query<{
      id: string; client_name: string; from_name: string | null; to_name: string | null
      booking_date: string; booking_time: string; transfer_reason: string | null
    }>(`
      SELECT bt.id,
             c.full_name AS client_name,
             fp.display_name AS from_name,
             tp.display_name AS to_name,
             b.booking_date::text,
             to_char(b.booking_time,'HH24:MI') AS booking_time,
             bt.transfer_reason
      FROM booking_transfers bt
      INNER JOIN bookings b ON b.id = bt.booking_id
      INNER JOIN customers c ON c.id = b.customer_id
      LEFT JOIN professionals fp ON fp.id = bt.from_professional_id
      LEFT JOIN professionals tp ON tp.id = bt.to_professional_id
      WHERE bt.organization_id = $1
      ORDER BY bt.transferred_at DESC
      LIMIT 20
    `, [orgId])

    const transfers = r.rows.map((row) => ({
      id: row.id,
      client: row.client_name,
      from: row.from_name ?? '—',
      to: row.to_name ?? '—',
      slot: `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${row.booking_date}T00:00:00`))} · ${row.booking_time}`,
      reason: row.transfer_reason ?? '—',
    }))

    return NextResponse.json({ transfers })
  } catch (err) {
    console.error('[transfers GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DB não configurado' }, { status: 503 })
  }
  try {
    const body = await req.json()
    const { bookingId, fromProfessionalId, toProfessionalId, transferReason } = body as {
      bookingId: string
      fromProfessionalId: string
      toProfessionalId: string
      transferReason: string
    }

    if (!bookingId || !toProfessionalId) {
      return NextResponse.json({ error: 'bookingId e toProfessionalId são obrigatórios' }, { status: 400 })
    }

    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

    const r = await query<{ id: string }>(
      `INSERT INTO booking_transfers
         (organization_id, booking_id, from_professional_id, to_professional_id, transfer_reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [orgId, bookingId, fromProfessionalId ?? null, toProfessionalId, transferReason ?? null]
    )

    await query('UPDATE bookings SET professional_id = $1 WHERE id = $2', [toProfessionalId, bookingId])

    return NextResponse.json({ id: r.rows[0].id }, { status: 201 })
  } catch (err) {
    console.error('[transfers POST]', err)
    return NextResponse.json({ error: 'Erro ao criar transferência' }, { status: 500 })
  }
}
