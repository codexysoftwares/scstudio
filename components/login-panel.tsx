'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LockKeyhole, UserPlus2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  mode: 'login' | 'bootstrap'
}

export function LoginPanel({ mode }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
  })

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(mode === 'bootstrap' ? '/api/auth/bootstrap' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao autenticar')
      router.replace('/gestao')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'bootstrap' && (
        <div className="space-y-1">
          <Label htmlFor="fullName">Nome da dona</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Ex: Camila Souza"
            autoComplete="name"
            required
          />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="voce@scstudio.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder="••••••••"
          autoComplete={mode === 'bootstrap' ? 'new-password' : 'current-password'}
          required
        />
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando...
          </span>
        ) : mode === 'bootstrap' ? (
          <span className="inline-flex items-center gap-2">
            <UserPlus2 className="h-4 w-4" />
            Criar primeiro acesso
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <LockKeyhole className="h-4 w-4" />
            Entrar
          </span>
        )}
      </Button>
    </form>
  )
}
