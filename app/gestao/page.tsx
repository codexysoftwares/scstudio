export const revalidate = 0
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import ManagementDashboard from '@/components/management-dashboard'
import { getManagementAgendaOnlyData, getManagementDashboardData } from '@/lib/management-dashboard-data'
import { getCurrentStaffSession } from '@/lib/staff-auth'

export const metadata: Metadata = {
  title: 'Gestao | SC Studio & Esmalteria',
  description:
    'Painel de gerenciamento para landing page, agenda online, profissionais, servicos e acessos da equipe.',
}

export default async function GestaoPage() {
  const session = await getCurrentStaffSession()
  if (!session) redirect('/login')

  const data = session.roleKey === 'professional'
    ? await getManagementAgendaOnlyData()
    : await getManagementDashboardData()

  return (
    <ManagementDashboard
      data={data}
      sessionProfessionalId={session.professionalId}
      sessionRoleKey={session.roleKey}
      sessionRoleName={session.roleName}
    />
  )
}
