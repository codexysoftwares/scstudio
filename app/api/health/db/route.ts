import { NextResponse } from 'next/server'

import { isDatabaseConfigured, query } from '@/lib/db'

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: 'DATABASE_URL nao configurada.',
      },
      { status: 503 }
    )
  }

  try {
    const result = await query<{ now: string }>('SELECT NOW()::text AS now')

    return NextResponse.json({
      ok: true,
      configured: true,
      timestamp: result.rows[0]?.now ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: error instanceof Error ? error.message : 'Falha na conexao com o banco.',
      },
      { status: 503 }
    )
  }
}
