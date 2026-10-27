import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, withTransaction } from '@/lib/db'
import { ensureManagementWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

async function resolveOrgId(): Promise<string | null> {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
    [slug]
  )
  return r.rows[0]?.id ?? null
}

// ─── POST — create professional ───────────────────────────────────────────────

const createSchema = z.object({
  displayName: z.string().min(1).max(120),
  specialty: z.string().max(120).optional(),
  photoUrl: z.string().max(500).optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  acceptsOnlineBooking: z.boolean().optional(),
})

export async function POST(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const orgId = await resolveOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
  }

  const { displayName, specialty, photoUrl, commissionPercent = 40, acceptsOnlineBooking = true } = parsed.data

  let professionalId: string

  await withTransaction(async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO professionals (organization_id, display_name, specialty, photo_url, accepts_online_booking)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [orgId, displayName, specialty ?? null, photoUrl ?? null, acceptsOnlineBooking]
    )
    professionalId = r.rows[0].id

    await client.query(
      `INSERT INTO professional_payout_rules
         (organization_id, professional_id, rule_name, commission_percent, applies_to)
       VALUES ($1, $2, 'Padrão', $3, 'service')`,
      [orgId, professionalId, commissionPercent]
    )
  })

  revalidatePath('/')
  revalidatePath('/gestao')
  return NextResponse.json({ success: true, id: professionalId! })
}

// ─── PATCH — edit professional ────────────────────────────────────────────────

const patchSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(120).optional(),
  specialty: z.string().max(200).optional(),
  photoUrl: z.string().max(500).optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  acceptsOnlineBooking: z.boolean().optional(),
})

export async function PATCH(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json();
    // Forçar log para stdout/stderr
    console.log('[PATCH professionals] body:', JSON.stringify(body));
    // Também logar no erro para garantir saída
    console.error('[PATCH professionals] body:', JSON.stringify(body));
  } catch (err) {
    console.error('[PATCH professionals] JSON error:', err);
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })

  const { id, displayName, specialty, photoUrl, commissionPercent, acceptsOnlineBooking } = parsed.data

  const orgId = await resolveOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

  await withTransaction(async (client) => {
    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (displayName !== undefined) { updates.push(`display_name = $${idx++}`); values.push(displayName) }
    if (specialty !== undefined) { updates.push(`specialty = $${idx++}`); values.push(specialty) }
    if (photoUrl !== undefined) { updates.push(`photo_url = $${idx++}`); values.push(photoUrl || null) }
    if (acceptsOnlineBooking !== undefined) { updates.push(`accepts_online_booking = $${idx++}`); values.push(acceptsOnlineBooking) }
    updates.push(`updated_at = NOW()`)

    if (updates.length > 1) {
      values.push(id, orgId)
      await client.query(
        `UPDATE professionals SET ${updates.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}`,
        values
      )
    }

    if (commissionPercent !== undefined) {
      await client.query(
        `UPDATE professional_payout_rules SET commission_percent = $1, updated_at = NOW()
         WHERE professional_id = $2 AND organization_id = $3 AND applies_to = 'service'`,
        [commissionPercent, id, orgId]
      )
    }
  })

  revalidatePath('/')
  revalidatePath('/gestao')
  return NextResponse.json({ success: true })
}

// ─── DELETE — remove professional ─────────────────────────────────────────────

const deleteSchema = z.object({
  id: z.string().uuid(),
})

export async function DELETE(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
  }

  const orgId = await resolveOrgId()
  if (!orgId) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
  }

  await query(
    'DELETE FROM professionals WHERE id = $1 AND organization_id = $2',
    [parsed.data.id, orgId]
  )

  revalidatePath('/')
  revalidatePath('/gestao')
  return NextResponse.json({ success: true })
}
