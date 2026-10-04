import { pingDatabase, pool } from './db.ts'

try {
  await pingDatabase()
  console.log('Conexión correcta con MySQL.')
} catch (error) {
  console.error('No se pudo conectar a MySQL.')
  console.error(error)
  process.exitCode = 1
} finally {
  await pool.end()
}
