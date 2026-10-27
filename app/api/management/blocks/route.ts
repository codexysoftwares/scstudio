import { NextResponse } from 'next/server'

import { isDatabaseConfigured, query } from '@/lib/db'
import { ensureManagementAgendaWriteAccess, ensureManagementSession } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

async function resolveOrgId() {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ blocks: [] })
  }

  const session = await requireStaffSession()
  const authError = ensureManagementSession(session)
  if (authError) return authError

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ blocks: [] })

    const r = await query<{
      id: string
      professional_name: string | null
      starts_at: string
      ends_at: string
      reason: string
    }>(
      `SELECT sb.id,
              p.display_name AS professional_name,
              sb.starts_at,
              sb.ends_at,
              sb.reason
       FROM schedule_blocks sb
       LEFT JOIN professionals p ON p.id = sb.professional_id
       WHERE sb.organization_id = $1
         AND sb.ends_at > NOW()
       ORDER BY sb.starts_at
       LIMIT 20`,
      [orgId]
    )

    const blocks = r.rows.map((row) => {
      const start = new Date(row.starts_at)
      const end = new Date(row.ends_at)
      const fmt = (d: Date) =>
        new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d)

      return {
        id: row.id,
        professional: row.professional_name ?? 'Todas',
        period: `${fmt(start)}-${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(end)}`,
        reason: row.reason,
        action: 'Bloquear agenda online',
      }
    })

    return NextResponse.json({ blocks })
  } catch (err) {
    console.error('[blocks GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DB nao configurado' }, { status: 503 })
  }

  const session = await requireStaffSession()
  const authError = ensureManagementAgendaWriteAccess(session)
  if (authError) return authError

  try {
    const body = await req.json()
    const { professionalId, startsAt, endsAt, reason } = body as {
      professionalId?: string
      startsAt: string
      endsAt: string
      reason: string
    }

    if (!startsAt || !endsAt || !reason?.trim()) {
      return NextResponse.json({ error: 'startsAt, endsAt e reason sao obrigatorios' }, { status: 400 })
    }

    const startDate = new Date(startsAt)
    const endDate = new Date(endsAt)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Datas do bloqueio invalidas' }, { status: 400 })
    }

    if (startDate >= endDate) {
      return NextResponse.json({ error: 'O bloqueio precisa terminar depois do inicio' }, { status: 400 })
    }

    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

    const r = await query<{ id: string }>(
      `INSERT INTO schedule_blocks (organization_id, professional_id, starts_at, ends_at, reason, affects_online_booking)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id`,
      [orgId, professionalId ?? null, startsAt, endsAt, reason.trim()]
    )

    return NextResponse.json({ id: r.rows[0].id }, { status: 201 })
  } catch (err) {
    console.error('[blocks POST]', err)
    return NextResponse.json({ error: 'Erro ao criar bloqueio' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DB nao configurado' }, { status: 503 })
  }

  const session = await requireStaffSession()
  const authError = ensureManagementAgendaWriteAccess(session)
  if (authError) return authError

  try {
    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

    await query('DELETE FROM schedule_blocks WHERE id = $1 AND organization_id = $2', [id, orgId])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[blocks DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover bloqueio' }, { status: 500 })
  }
}
