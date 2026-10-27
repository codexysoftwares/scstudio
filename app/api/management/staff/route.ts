import { randomBytes, scryptSync } from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { query, withTransaction, isDatabaseConfigured } from '@/lib/db'
import { ensureManagementAdminReadAccess, ensureManagementWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

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
      full_name: string
      email: string
      is_active: boolean
      role_key: string | null
      role_name: string | null
      professional_id: string | null
      professional_name: string | null
    }>(
      `SELECT su.id, su.full_name, su.email, su.is_active,
              ar.key AS role_key, ar.name AS role_name,
              p.id AS professional_id, p.display_name AS professional_name
       FROM staff_users su
       LEFT JOIN staff_role_assignments sra ON sra.staff_user_id = su.id
       LEFT JOIN access_roles ar ON ar.id = sra.role_id
       LEFT JOIN professionals p ON p.staff_user_id = su.id
       WHERE su.organization_id = $1
       ORDER BY su.full_name`,
      [orgId]
    )

    return NextResponse.json(r.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      isActive: row.is_active,
      roleKey: row.role_key ?? '',
      roleName: row.role_name ?? '',
      professionalId: row.professional_id ?? null,
      professionalName: row.professional_name ?? null,
    })))
  } catch (err) {
    console.error('[staff GET]', err)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

const createSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6),
  roleKey: z.enum(['admin', 'frontdesk', 'professional']),
  professionalId: z.string().uuid().optional().nullable(),
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
  if (!parsed.success) return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

    const { fullName, email, password, roleKey, professionalId } = parsed.data
    const passwordHash = hashPassword(password)

    let staffId = ''
    await withTransaction(async (client) => {
      const existing = await client.query<{ id: string }>('SELECT id FROM staff_users WHERE email = $1 LIMIT 1', [email])
      if (existing.rows[0]) throw new Error('EMAIL_EXISTS')

      const su = await client.query<{ id: string }>(
        `INSERT INTO staff_users (organization_id, full_name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [orgId, fullName, email, passwordHash]
      )
      staffId = su.rows[0].id

      const role = await client.query<{ id: string }>('SELECT id FROM access_roles WHERE key = $1 LIMIT 1', [roleKey])
      if (role.rows[0]) {
        await client.query(
          'INSERT INTO staff_role_assignments (staff_user_id, role_id) VALUES ($1, $2)',
          [staffId, role.rows[0].id]
        )
      }

      if (professionalId) {
        await client.query(
          'UPDATE professionals SET staff_user_id = $1 WHERE id = $2 AND organization_id = $3',
          [staffId, professionalId, orgId]
        )
      }
    })

    return NextResponse.json({ id: staffId })
  } catch (err) {
    if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
      return NextResponse.json({ error: 'E-mail ja cadastrado' }, { status: 409 })
    }
    console.error('[staff POST]', err)
    return NextResponse.json({ error: 'Erro ao criar usuario' }, { status: 500 })
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  roleKey: z.enum(['admin', 'frontdesk', 'professional']).optional(),
  professionalId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: Request) {
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

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })

  try {
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

    const { id, fullName, email, password, roleKey, professionalId, isActive } = parsed.data

    await withTransaction(async (client) => {
      const cols: string[] = ['updated_at = NOW()']
      const vals: unknown[] = []
      let i = 1

      if (fullName !== undefined) { cols.push(`full_name = $${i++}`); vals.push(fullName) }
      if (email !== undefined) { cols.push(`email = $${i++}`); vals.push(email) }
      if (password !== undefined) { cols.push(`password_hash = $${i++}`); vals.push(hashPassword(password)) }
      if (isActive !== undefined) { cols.push(`is_active = $${i++}`); vals.push(isActive) }

      if (cols.length > 1) {
        vals.push(id, orgId)
        await client.query(
          `UPDATE staff_users SET ${cols.join(', ')} WHERE id = $${i++} AND organization_id = $${i}`,
          vals
        )
      }

      if (roleKey !== undefined) {
        const role = await client.query<{ id: string }>('SELECT id FROM access_roles WHERE key = $1 LIMIT 1', [roleKey])
        if (role.rows[0]) {
          await client.query('DELETE FROM staff_role_assignments WHERE staff_user_id = $1', [id])
          await client.query(
            'INSERT INTO staff_role_assignments (staff_user_id, role_id) VALUES ($1, $2)',
            [id, role.rows[0].id]
          )
        }
      }

      if (professionalId !== undefined) {
        await client.query(
          'UPDATE professionals SET staff_user_id = NULL WHERE staff_user_id = $1 AND organization_id = $2',
          [id, orgId]
        )

        if (professionalId) {
          await client.query(
            'UPDATE professionals SET staff_user_id = $1 WHERE id = $2 AND organization_id = $3',
            [id, professionalId, orgId]
          )
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[staff PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar usuario' }, { status: 500 })
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
    const orgId = await resolveOrgId()
    if (!orgId) return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })

    await query(
      'UPDATE staff_users SET is_active = false, updated_at = NOW() WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[staff DELETE]', err)
    return NextResponse.json({ error: 'Erro ao desativar usuario' }, { status: 500 })
  }
}
