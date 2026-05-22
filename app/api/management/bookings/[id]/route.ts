import { NextResponse } from 'next/server'
import { isDatabaseConfigured, query } from '@/lib/db'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DB não configurado' }, { status: 503 })
  }
  try {
    const { id } = await params
    const { status } = await req.json() as { status: string }

    const allowed = ['pending', 'confirmed', 'cancelled', 'completed', 'rescheduled']
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    const r = await query(
      `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING id`,
      [status, id]
    )
    if (r.rowCount === 0) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[bookings PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 })
  }
}
