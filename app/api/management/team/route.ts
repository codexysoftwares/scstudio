import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query } from '@/lib/db'
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

// ─── POST — create team member ────────────────────────────────────────────────

const createSchema = z.object({
  displayName: z.string().min(1).max(120),
  role: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  photoUrl: z.string().min(1).optional().or(z.literal('')),
  sortOrder: z.number().int().optional(),
})

export async function POST(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const orgId = await resolveOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

  const { displayName, photoUrl, sortOrder } = parsed.data
  const role = (parsed.data.category ?? parsed.data.role ?? '').trim()

  const r = await query<{ id: string }>(
    `INSERT INTO team_members (organization_id, display_name, role, photo_url, sort_order)
     VALUES ($1, $2, $3, $4, COALESCE($5, (SELECT COALESCE(MAX(sort_order),0)+1 FROM team_members WHERE organization_id = $1)))
     RETURNING id`,
    [orgId, displayName, role, photoUrl || null, sortOrder ?? null]
  )

  revalidatePath('/')
  revalidatePath('/gestao')
  return NextResponse.json({ success: true, id: r.rows[0].id })
}

// ─── PATCH — update team member ───────────────────────────────────────────────

const patchSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(120).optional(),
  role: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  photoUrl: z.string().min(1).optional().or(z.literal('')),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })

  const { id, displayName, photoUrl, sortOrder } = parsed.data
  const role = parsed.data.category ?? parsed.data.role

  const orgId = await resolveOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

  const sets: string[] = ['updated_at = NOW()']
  const values: unknown[] = []
  let idx = 1

  if (displayName !== undefined) { sets.push(`display_name = $${idx++}`); values.push(displayName) }
  if (role !== undefined) { sets.push(`role = $${idx++}`); values.push(role) }
  if (photoUrl !== undefined) { sets.push(`photo_url = $${idx++}`); values.push(photoUrl || null) }
  if (sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); values.push(sortOrder) }

  if (sets.length > 1) {
    values.push(id, orgId)
    await query(
      `UPDATE team_members SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}`,
      values
    )
  }

  revalidatePath('/')
  revalidatePath('/gestao')
  return NextResponse.json({ success: true })
}

// ─── DELETE — remove team member ──────────────────────────────────────────────

const deleteSchema = z.object({ id: z.string().uuid() })

export async function DELETE(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })

  const orgId = await resolveOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

  await query(
    'DELETE FROM team_members WHERE id = $1 AND organization_id = $2',
    [parsed.data.id, orgId]
  )

  revalidatePath('/')
  revalidatePath('/gestao')
  return NextResponse.json({ success: true })
}
