import 'server-only'

import type { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'crypto'
import { query, isDatabaseConfigured, withTransaction } from '@/lib/db'

const SESSION_COOKIE = 'scstudio_session'
const SESSION_TTL_DAYS = 30

export type StaffSessionUser = {
  id: string
  fullName: string
  email: string
  roleKey: string
  roleName: string
  professionalId: string | null
  professionalName: string | null
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const nextHash = scryptSync(plain, salt, 64).toString('hex')
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(nextHash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function resolveOrgId(): Promise<string | null> {
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'sc-studio'
  const r = await query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [slug])
  return r.rows[0]?.id ?? null
}

export async function hasAnyStaffUsers(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  const orgId = await resolveOrgId()
  if (!orgId) return false
  const r = await query('SELECT 1 FROM staff_users WHERE organization_id = $1 LIMIT 1', [orgId])
  return r.rowCount > 0
}

export async function createStaffSession(staffUserId: string): Promise<string> {
  if (!isDatabaseConfigured()) {
    throw new Error('DB nao configurado')
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await query(
    `INSERT INTO staff_sessions (staff_user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [staffUserId, tokenHash, expiresAt.toISOString()]
  )

  await query('UPDATE staff_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [staffUserId])
  return token
}

export async function getCurrentStaffSession(): Promise<StaffSessionUser | null> {
  if (!isDatabaseConfigured()) return null

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const tokenHash = hashToken(token)
  const orgId = await resolveOrgId()
  if (!orgId) return null

  const r = await query<{
    id: string
    full_name: string
    email: string
    role_key: string | null
    role_name: string | null
    professional_id: string | null
    professional_name: string | null
  }>(
    `
      SELECT su.id, su.full_name, su.email,
             ar.key AS role_key, ar.name AS role_name,
             p.id AS professional_id, p.display_name AS professional_name
      FROM staff_sessions ss
      INNER JOIN staff_users su ON su.id = ss.staff_user_id
      LEFT JOIN staff_role_assignments sra ON sra.staff_user_id = su.id
      LEFT JOIN access_roles ar ON ar.id = sra.role_id
      LEFT JOIN professionals p ON p.staff_user_id = su.id
      WHERE ss.token_hash = $1
        AND ss.expires_at > NOW()
        AND su.organization_id = $2
        AND su.is_active = TRUE
      LIMIT 1
    `,
    [tokenHash, orgId]
  )

  const row = r.rows[0]
  if (!row) return null

  await query('UPDATE staff_sessions SET last_used_at = NOW() WHERE token_hash = $1', [tokenHash])

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    roleKey: row.role_key ?? '',
    roleName: row.role_name ?? '',
    professionalId: row.professional_id ?? null,
    professionalName: row.professional_name ?? null,
  }
}

export async function requireStaffSession(): Promise<StaffSessionUser | null> {
  return getCurrentStaffSession()
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie(response: NextResponse) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token && isDatabaseConfigured()) {
    await query('DELETE FROM staff_sessions WHERE token_hash = $1', [hashToken(token)])
  }
  response.cookies.delete(SESSION_COOKIE)
}

export async function createFirstAdmin(input: { fullName: string; email: string; password: string }) {
  if (!isDatabaseConfigured()) {
    throw new Error('DB nao configurado')
  }

  const orgId = await resolveOrgId()
  if (!orgId) throw new Error('ORGANIZATION_NOT_FOUND')

  const hasUsers = await hasAnyStaffUsers()
  if (hasUsers) throw new Error('SETUP_ALREADY_DONE')

  const passwordHash = hashPassword(input.password)

  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>('SELECT id FROM staff_users WHERE email = $1 LIMIT 1', [input.email])
    if (existing.rows[0]) throw new Error('EMAIL_EXISTS')

    const staff = await client.query<{ id: string }>(
      `INSERT INTO staff_users (organization_id, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [orgId, input.fullName, input.email, passwordHash]
    )

    const role = await client.query<{ id: string }>('SELECT id FROM access_roles WHERE key = $1 LIMIT 1', ['admin'])
    if (role.rows[0]) {
      await client.query('INSERT INTO staff_role_assignments (staff_user_id, role_id) VALUES ($1, $2)', [staff.rows[0].id, role.rows[0].id])
    }

    return staff.rows[0].id
  })
}
