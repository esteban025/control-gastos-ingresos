import type { RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { resolvePeriod, type Periodo, type ResolvedPeriod } from './period.ts'

type ProfileRow = RowDataPacket & {
  nombre: string
  moneda: string
  dia_inicio_mes: number
}

export async function perfilPeriodo(periodo: Periodo): Promise<{
  moneda: string
  resolved: ResolvedPeriod
}> {
  const [rows] = await pool.query<ProfileRow[]>('SELECT nombre, moneda, dia_inicio_mes FROM perfil WHERE id = 1')
  const profile = rows[0]
  if (!profile) throw new Error('No hay un perfil en la base. Ejecuta db.sql.')
  const diaInicio = Number(profile.dia_inicio_mes) || 1
  return {
    moneda: profile.moneda,
    resolved: resolvePeriod(new Date(), diaInicio, periodo),
  }
}
