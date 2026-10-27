import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import pg from 'pg'

const { Client } = pg

const migrationChecks = {
  '001_initial_schema.sql': async (client) =>
    tableExists(client, 'organizations'),
  '002_management_extensions.sql': async (client) =>
    tableExists(client, 'access_roles'),
  '003_seed.sql': async (client) =>
    rowExists(
      client,
      'SELECT 1 FROM organizations WHERE slug = $1 LIMIT 1',
      ['sc-studio']
    ),
  '004_automation_settings.sql': async (client) =>
    columnExists(client, 'organizations', 'auto_confirm_whatsapp'),
  '005_landing_sections.sql': async (client) =>
    columnExists(client, 'landing_page_settings', 'hero_badge_text'),
  '006_team_members.sql': async (client) =>
    tableExists(client, 'team_members'),
  '008_service_photos.sql': async (client) =>
    columnExists(client, 'services', 'photo_url'),
  '009_staff_sessions.sql': async (client) =>
    tableExists(client, 'staff_sessions'),
  '011_booking_groups.sql': async (client) =>
    tableExists(client, 'booking_groups'),
  '012_whatsapp_agent.sql': async (client) =>
    tableExists(client, 'whatsapp_integration_settings'),
}

async function tableExists(client, tableName) {
  return rowExists(
    client,
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
    `,
    [tableName]
  )
}

async function columnExists(client, tableName, columnName) {
  return rowExists(
    client,
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName]
  )
}

async function rowExists(client, text, params) {
  const result = await client.query(text, params)
  return result.rowCount > 0
}

async function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env')
  const contents = await readFile(envPath, 'utf8')

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

async function main() {
  await loadEnvFile()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL nao configurada.')
  }

  const initDir = path.resolve(process.cwd(), 'db', 'init')
  const files = (await readdir(initDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    for (const file of files) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1',
        [file]
      )
      if (alreadyApplied.rowCount) {
        continue
      }

      const isSatisfied = await migrationChecks[file]?.(client)
      if (isSatisfied) {
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        )
        console.log(`recorded ${file}`)
        continue
      }

      const sql = await readFile(path.join(initDir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        )
        await client.query('COMMIT')
        console.log(`applied ${file}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
