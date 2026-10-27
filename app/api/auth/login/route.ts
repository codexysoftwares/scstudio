import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isDatabaseConfigured, query } from '@/lib/db'
import { attachSessionCookie, createStaffSession, verifyPassword } from '@/lib/staff-auth'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DB nao configurado' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
  }

  const { email, password } = parsed.data
  const r = await query<{ id: string; password_hash: string | null }>(
    'SELECT id, password_hash FROM staff_users WHERE email = $1 AND is_active = TRUE LIMIT 1',
    [email]
  )
  const user = r.rows[0]
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: 'Credenciais invalidas' }, { status: 401 })
  }

  const token = await createStaffSession(user.id)
  const res = NextResponse.json({ ok: true })
  attachSessionCookie(res, token)
  return res
}
