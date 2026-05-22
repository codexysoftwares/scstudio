import { NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

const hourSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  isClosed: z.boolean(),
})

const schema = z.object({
  hours: z.array(hourSchema).min(1).max(7),
})

async function resolveOrgId(): Promise<string | null> {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )
  return r.rows[0]?.id ?? null
}

export async function PATCH(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const orgId = await resolveOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
  }

  const { hours } = parsed.data

  for (const h of hours) {
    await query(
      `INSERT INTO business_hours (organization_id, weekday, opens_at, closes_at, is_closed, updated_at)
       VALUES ($1, $2, $3::time, $4::time, $5, NOW())
       ON CONFLICT (organization_id, weekday)
       DO UPDATE SET
         opens_at  = EXCLUDED.opens_at,
         closes_at = EXCLUDED.closes_at,
         is_closed = EXCLUDED.is_closed,
         updated_at = NOW()`,
      [orgId, h.weekday, h.opensAt || null, h.closesAt || null, h.isClosed]
    )
  }

  return NextResponse.json({ success: true })
}
