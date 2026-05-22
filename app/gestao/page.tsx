import type { Metadata } from 'next'

import ManagementDashboard from '@/components/management-dashboard'
import { getManagementDashboardData } from '@/lib/management-dashboard-data'

export const metadata: Metadata = {
  title: 'Gestao | SC Studio & Esmalteria',
  description:
    'Painel de gerenciamento para landing page, agenda online, profissionais, servicos e acessos da equipe.',
}

export default async function GestaoPage() {
  const data = await getManagementDashboardData()

  return <ManagementDashboard data={data} />
}
