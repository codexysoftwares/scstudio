import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isDatabaseConfigured, query } from '@/lib/db'
import { ensureManagementAdminReadAccess, ensureManagementWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

async function resolveOrgId(): Promise<string | null> {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json([])

  const session = await requireStaffSession()
  const authError = ensureManagementAdminReadAccess(session)
  if (authError) return authError

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json([])

    const r = await query<{
      id: string
      author_name: string
      body: string
      service_name: string | null
      sort_order: number
    }>(
      'SELECT id, author_name, body, service_name, sort_order FROM testimonials WHERE organization_id = $1 AND is_active = true ORDER BY sort_order ASC, created_at ASC',
      [orgId]
    )

    return NextResponse.json(r.rows.map((row) => ({
      id: row.id,
      authorName: row.author_name,
      body: row.body,
      serviceName: row.service_name ?? '',
      sortOrder: row.sort_order,
    })))
  } catch (err) {
    console.error('[testimonials GET]', err)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

const createSchema = z.object({
  authorName: z.string().min(1),
  body: z.string().min(1),
  serviceName: z.string().optional().default(''),
  sortOrder: z.number().int().optional().default(0),
})

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'DB nao configurado' }, { status: 503 })

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
  if (!parsed.success) return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

    const { authorName, body: testimonialBody, serviceName, sortOrder } = parsed.data
    const r = await query<{ id: string }>(
      'INSERT INTO testimonials (organization_id, author_name, body, service_name, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [orgId, authorName, testimonialBody, serviceName, sortOrder]
    )

    return NextResponse.json({ id: r.rows[0].id })
  } catch (err) {
    console.error('[testimonials POST]', err)
    return NextResponse.json({ error: 'Erro ao criar depoimento' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'DB nao configurado' }, { status: 503 })

  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const { id } = body as { id?: string }
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

  try {
    await query('UPDATE testimonials SET is_active = false WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[testimonials DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover depoimento' }, { status: 500 })
  }
}
