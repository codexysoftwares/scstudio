import 'server-only'

import { NextResponse } from 'next/server'

import type { StaffSessionUser } from '@/lib/staff-auth'

export function isProfessionalSession(session: StaffSessionUser | null | undefined) {
  return session?.roleKey === 'professional'
}

export function ensureManagementSession(session: StaffSessionUser | null | undefined) {
  if (!session) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  return null
}

export function ensureManagementAgendaAccess(session: StaffSessionUser | null | undefined) {
  return ensureManagementSession(session)
}

export function ensureManagementAgendaWriteAccess(session: StaffSessionUser | null | undefined) {
  return ensureManagementSession(session)
}

export function ensureManagementWriteAccess(session: StaffSessionUser | null | undefined) {
  const unauthorized = ensureManagementSession(session)
  if (unauthorized) return unauthorized

  if (isProfessionalSession(session)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  return null
}

export function ensureManagementAdminReadAccess(session: StaffSessionUser | null | undefined) {
  return ensureManagementWriteAccess(session)
}
