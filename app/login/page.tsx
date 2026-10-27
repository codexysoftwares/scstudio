import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LoginPanel } from '@/components/login-panel'
import { getCurrentStaffSession, hasAnyStaffUsers } from '@/lib/staff-auth'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const session = await getCurrentStaffSession()
  if (session) redirect('/gestao')

  const needsBootstrap = !(await hasAnyStaffUsers())

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(177,93,100,0.15),_transparent_35%),linear-gradient(180deg,_var(--background),_var(--background))] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl p-8 md:p-10">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/35 mb-3">SC Studio & Esmalteria</p>
          <h1 className="text-3xl font-semibold text-foreground">
            {needsBootstrap ? 'Criar primeiro acesso' : 'Entrar no sistema'}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            {needsBootstrap
              ? 'Como nao existe nenhum usuario ainda, crie a conta da dona para iniciar o sistema.'
              : 'Use seu e-mail e senha para acessar a gestao.'}
          </p>

          <LoginPanel mode={needsBootstrap ? 'bootstrap' : 'login'} />

          <p className="text-[11px] text-white/35 mt-6 text-center">
            <Link href="/" className="hover:text-primary transition-colors">
              Voltar para a landing
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
