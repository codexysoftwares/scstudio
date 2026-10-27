import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { ensureManagementWriteAccess } from '@/lib/management-auth'
import { requireStaffSession } from '@/lib/staff-auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: Request) {
  const session = await requireStaffSession()
  const authError = ensureManagementWriteAccess(session)
  if (authError) return authError

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Tipo não suportado (jpeg, png, webp, gif)' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Arquivo muito grande (máx 5 MB)' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()

  try {
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })
    await writeFile(join(uploadDir, filename), Buffer.from(bytes))
    return NextResponse.json({ url: `/uploads/${filename}` })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Falha ao salvar arquivo' }, { status: 500 })
  }
}
