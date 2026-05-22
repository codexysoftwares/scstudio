import { Pool, type PoolClient, type QueryResultRow } from 'pg'

declare global {
  var __scstudioPool: Pool | undefined
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl())
}

export function getPool() {
  const connectionString = getDatabaseUrl()
  if (!connectionString) {
    throw new Error('DATABASE_URL nao configurada.')
  }

  if (!global.__scstudioPool) {
    global.__scstudioPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  }

  return global.__scstudioPool
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return getPool().query<T>(text, params)
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
) {
  const client = await getPool().connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
