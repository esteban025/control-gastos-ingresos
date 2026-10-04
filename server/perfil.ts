import type { RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { recordOf, requiredText } from './values.ts'

type PerfilRow = RowDataPacket & {
  nombre: string
  correo: string
  moneda: string
  dia_inicio_mes: number
  aviso_cuotas: number
  aviso_presupuesto: number
  resumen_semanal: number
}

export type PerfilInput = {
  nombre: string
  correo: string
  moneda: string
  diaInicioMes: number
  avisoCuotas: boolean
  avisoPresupuesto: boolean
  resumenSemanal: boolean
}

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

function parsePerfil(body: unknown): PerfilInput {
  const record = recordOf(body, 'Los datos del perfil no son válidos')
  const nombre = requiredText(record.nombre, 'El nombre', 120)
  const correo = requiredText(record.correo, 'El correo', 180)
  if (!correo.includes('@')) throw new Error('El correo no es válido')
  const moneda = typeof record.moneda === 'string' ? record.moneda.trim().toUpperCase() : ''
  if (!/^[A-Z]{3}$/.test(moneda)) throw new Error('La moneda debe ser un código de 3 letras')
  const dia = typeof record.diaInicioMes === 'number' ? record.diaInicioMes : Number(record.diaInicioMes)
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
    throw new Error('El inicio de mes debe estar entre 1 y 28')
  }
  return {
    nombre,
    correo,
    moneda,
    diaInicioMes: dia,
    avisoCuotas: flag(record.avisoCuotas),
    avisoPresupuesto: flag(record.avisoPresupuesto),
    resumenSemanal: flag(record.resumenSemanal),
  }
}

function mapPerfil(row: PerfilRow) {
  return {
    nombre: row.nombre,
    correo: row.correo,
    moneda: row.moneda,
    diaInicioMes: Number(row.dia_inicio_mes),
    avisoCuotas: Boolean(row.aviso_cuotas),
    avisoPresupuesto: Boolean(row.aviso_presupuesto),
    resumenSemanal: Boolean(row.resumen_semanal),
  }
}

export async function getPerfil() {
  const [rows] = await pool.query<PerfilRow[]>(
    `SELECT nombre, correo, moneda, dia_inicio_mes, aviso_cuotas, aviso_presupuesto, resumen_semanal
     FROM perfil WHERE id = 1`,
  )
  const row = rows[0]
  if (!row) throw new Error('No hay un perfil en la base. Ejecuta db.sql.')
  return mapPerfil(row)
}

export async function updatePerfil(body: unknown) {
  const input = parsePerfil(body)
  await pool.execute(
    `UPDATE perfil
     SET nombre = ?, correo = ?, moneda = ?, dia_inicio_mes = ?,
         aviso_cuotas = ?, aviso_presupuesto = ?, resumen_semanal = ?
     WHERE id = 1`,
    [
      input.nombre,
      input.correo,
      input.moneda,
      input.diaInicioMes,
      input.avisoCuotas,
      input.avisoPresupuesto,
      input.resumenSemanal,
    ],
  )
  return getPerfil()
}
