import { config as loadEnv } from 'dotenv'
import { createPool, type Pool } from 'mysql2/promise'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

loadEnv({ path: resolve(rootDir, '.env') })

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Falta ${name}. Copia .env.example a .env y completa la conexión.`)
  }
  return value
}

function portFromEnv(): number {
  const raw = process.env.DB_PORT?.trim() || '3306'
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT debe ser un entero entre 1 y 65535.')
  }
  return port
}

// Pool de MySQL. Solo se importa desde código de servidor, nunca desde React.
export const pool: Pool = createPool({
  host: process.env.DB_HOST?.trim() || '127.0.0.1',
  port: portFromEnv(),
  user: requiredEnv('DB_USER'),
  password: process.env.DB_PASSWORD ?? '',
  database: requiredEnv('DB_NAME'),
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  decimalNumbers: true,
  dateStrings: true,
  charset: 'utf8mb4',
})

export async function pingDatabase(): Promise<void> {
  const connection = await pool.getConnection()
  try {
    await connection.query('SELECT 1')
  } finally {
    connection.release()
  }
}
