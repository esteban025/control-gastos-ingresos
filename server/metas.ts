import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { dateOnly, money, moneyField, num, optionalId, optionalIsoDate, recordOf, requiredText } from './values.ts'

type MetaRow = RowDataPacket & {
  id: number
  nombre: string
  objetivo: number | string
  fecha_objetivo: string | Date | null
  cuenta_id: number | null
  cuenta: string | null
  ahorrado_inicial: number | string
  ahorrado: number | string
  porcentaje: number | string
}
type CuentaRow = RowDataPacket & { id: number; nombre: string }
type AporteRow = RowDataPacket & {
  id: number
  fecha: string | Date
  descripcion: string
  meta: string | null
  monto: number | string
}
type CountRow = RowDataPacket & { total: number }
type MonedaRow = RowDataPacket & { moneda: string }

export type MetaInput = {
  nombre: string
  objetivo: number
  fechaObjetivo: string | null
  cuentaId: number | null
  ahorradoInicial: number
}

function parseMeta(body: unknown): MetaInput {
  const record = recordOf(body, 'Los datos de la meta no son válidos')
  return {
    nombre: requiredText(record.nombre, 'El nombre', 120),
    objetivo: moneyField(record.objetivo, 'El objetivo', 0.01),
    fechaObjetivo: optionalIsoDate(record.fechaObjetivo, 'La fecha objetivo'),
    cuentaId: optionalId(record.cuentaId, 'La cuenta'),
    ahorradoInicial: moneyField(record.ahorradoInicial, 'El ahorrado inicial', 0),
  }
}

async function moneda() {
  const [rows] = await pool.query<MonedaRow[]>('SELECT moneda FROM perfil WHERE id = 1')
  if (!rows[0]) throw new Error('No hay un perfil en la base. Ejecuta db.sql.')
  return rows[0].moneda
}

async function assertCuenta(cuentaId: number | null) {
  if (!cuentaId) return
  const [rows] = await pool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM cuentas WHERE id = ? AND archivado = 0',
    [cuentaId],
  )
  if (Number(rows[0]?.total) === 0) throw new Error('La cuenta no existe o está archivada')
}

export async function listMetas() {
  const [metas, cuentas, aportes] = await Promise.all([
    pool.query<MetaRow[]>(
      `SELECT g.id, g.nombre, g.objetivo, g.fecha_objetivo, g.cuenta_id, c.nombre AS cuenta,
              m.ahorrado_inicial, g.ahorrado, g.porcentaje
       FROM v_metas g
       JOIN metas m ON m.id = g.id
       LEFT JOIN cuentas c ON c.id = g.cuenta_id
       WHERE g.archivado = 0
       ORDER BY g.nombre`,
    ),
    pool.query<CuentaRow[]>('SELECT id, nombre FROM cuentas WHERE archivado = 0 ORDER BY nombre'),
    pool.query<AporteRow[]>(
      `SELECT id, fecha, descripcion, meta, monto
       FROM v_movimientos
       WHERE meta_id IS NOT NULL
       ORDER BY fecha DESC, id DESC
       LIMIT 8`,
    ),
  ])

  return {
    moneda: await moneda(),
    cuentas: cuentas[0].map((row) => ({ id: Number(row.id), nombre: row.nombre })),
    metas: metas[0].map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      objetivo: money(num(row.objetivo)),
      fechaObjetivo: dateOnly(row.fecha_objetivo),
      cuentaId: row.cuenta_id == null ? null : Number(row.cuenta_id),
      cuenta: row.cuenta,
      ahorradoInicial: money(num(row.ahorrado_inicial)),
      ahorrado: money(num(row.ahorrado)),
      porcentaje: money(num(row.porcentaje)),
    })),
    aportes: aportes[0].map((row) => ({
      id: Number(row.id),
      fecha: dateOnly(row.fecha) ?? '',
      descripcion: row.descripcion,
      meta: row.meta,
      monto: money(num(row.monto)),
    })),
  }
}

export async function createMeta(body: unknown): Promise<{ id: number }> {
  const input = parseMeta(body)
  await assertCuenta(input.cuentaId)
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO metas (nombre, objetivo, fecha_objetivo, cuenta_id, ahorrado_inicial)
     VALUES (?, ?, ?, ?, ?)`,
    [input.nombre, input.objetivo, input.fechaObjetivo, input.cuentaId, input.ahorradoInicial],
  )
  return { id: Number(result.insertId) }
}

export async function updateMeta(id: number, body: unknown): Promise<void> {
  const input = parseMeta(body)
  await assertCuenta(input.cuentaId)
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE metas
     SET nombre = ?, objetivo = ?, fecha_objetivo = ?, cuenta_id = ?, ahorrado_inicial = ?
     WHERE id = ? AND archivado = 0`,
    [input.nombre, input.objetivo, input.fechaObjetivo, input.cuentaId, input.ahorradoInicial, id],
  )
  if (result.affectedRows === 0) throw new Error('La meta no existe')
}

export async function deleteMeta(id: number): Promise<void> {
  const [usage] = await pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM movimientos WHERE meta_id = ?', [id])
  if (Number(usage[0]?.total) > 0) {
    throw new Error('No se puede eliminar: esta meta ya tiene aportes')
  }
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM metas WHERE id = ? AND archivado = 0', [id])
  if (result.affectedRows === 0) throw new Error('La meta no existe')
}
