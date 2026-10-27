import 'server-only'

import type { PoolClient } from 'pg'

import { query, withTransaction } from '@/lib/db'
import { normalizePhone } from '@/lib/agent-v2/utils'

export type AgentPhase =
  | 'idle'
  | 'info'
  | 'collecting'
  | 'offering_slots'
  | 'confirming'
  | 'payment'
  | 'cancel_select'
  | 'cancel_confirm'
  | 'handoff'

export type AgentGathered = {
  serviceId?: string
  serviceIds?: string[]
  serviceLabel?: string
  fallbackServiceId?: string | null
  date?: string
  time?: string
  name?: string
  professionalId?: string | null
  professionalName?: string | null
  slotAssignments?: Record<string, Array<{
    serviceId: string
    serviceName: string
    professionalId: string
    professionalName: string
    startsAt: string
    sequence: number
    durationMin: number
  }>>
  bookingId?: string
  bookingIds?: string[]
  bookingGroupId?: string | null
  cancelBookingId?: string
}

export type AgentSession = {
  id: string
  orgId: string
  phone: string
  phase: AgentPhase
  gathered: AgentGathered
  summary: string | null
}

type SessionRow = {
  id: string
  organization_id: string
  phone_e164: string
  phase: AgentPhase
  gathered: AgentGathered
  summary: string | null
}

export async function withAgentSessionLock<T>(
  orgId: string,
  phone: string,
  callback: () => Promise<T>
) {
  const normalizedPhone = normalizePhone(phone)
  return withTransaction(async (client: PoolClient) => {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [orgId, normalizedPhone]
    )
    return callback()
  })
}

export async function getOrCreateAgentSession(orgId: string, phone: string): Promise<AgentSession> {
  const normalizedPhone = normalizePhone(phone)
  const existing = await query<SessionRow>(
    `SELECT id, organization_id, phone_e164, phase, gathered, summary
     FROM agent_sessions
     WHERE organization_id = $1
       AND phone_e164 = $2
     LIMIT 1`,
    [orgId, normalizedPhone]
  )

  const row = existing.rows[0]
  if (row) {
    return {
      id: row.id,
      orgId: row.organization_id,
      phone: row.phone_e164,
      phase: row.phase,
      gathered: row.gathered ?? {},
      summary: row.summary,
    }
  }

  const created = await query<SessionRow>(
    `INSERT INTO agent_sessions (organization_id, phone_e164, phase, gathered, last_inbound_at)
     VALUES ($1, $2, 'idle', '{}'::jsonb, NOW())
     RETURNING id, organization_id, phone_e164, phase, gathered, summary`,
    [orgId, normalizedPhone]
  )

  const createdRow = created.rows[0]
  return {
    id: createdRow.id,
    orgId: createdRow.organization_id,
    phone: createdRow.phone_e164,
    phase: createdRow.phase,
    gathered: createdRow.gathered ?? {},
    summary: createdRow.summary,
  }
}

export async function saveAgentSession(session: AgentSession) {
  await query(
    `UPDATE agent_sessions
     SET phase = $1,
         gathered = $2::jsonb,
         summary = $3,
         last_outbound_at = NOW(),
         updated_at = NOW()
     WHERE id = $4`,
    [session.phase, JSON.stringify(session.gathered ?? {}), session.summary, session.id]
  )
}

export async function markAgentSessionInbound(sessionId: string) {
  await query(
    `UPDATE agent_sessions
     SET last_inbound_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [sessionId]
  )
}

export async function resetAgentSession(session: AgentSession) {
  session.phase = 'idle'
  session.gathered = {}
  await saveAgentSession(session)
}
