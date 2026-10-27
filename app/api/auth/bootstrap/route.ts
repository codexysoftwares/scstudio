import { NextResponse } from 'next/server'
import { z } from 'zod'
import { attachSessionCookie, createFirstAdmin, createStaffSession, hasAnyStaffUsers } from '@/lib/staff-auth'

const schema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6),
})

export async function POST(req: Request) {
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

  if (await hasAnyStaffUsers()) {
    return NextResponse.json({ error: 'Setup ja concluido' }, { status: 403 })
  }

  try {
    const id = await createFirstAdmin(parsed.data)
    const token = await createStaffSession(id)
    const res = NextResponse.json({ ok: true })
    attachSessionCookie(res, token)
    return res
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    if (msg === 'EMAIL_EXISTS') {
      return NextResponse.json({ error: 'E-mail ja cadastrado' }, { status: 409 })
    }
    if (msg === 'ORGANIZATION_NOT_FOUND') {
      return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao criar primeiro usuario' }, { status: 500 })
  }
}
