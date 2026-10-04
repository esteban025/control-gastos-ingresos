import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { dateOnly, money, moneyField, num, optionalIsoDate, optionalText, recordOf, requiredText } from './values.ts'

type DeudaRow = RowDataPacket & {
  id: number
  nombre: string
  acreedor: string | null
  saldo_inicial: number | string
  cuota: number | string
  proxima_fecha: string | Date | null
  saldo: number | string
  estado: string
}
type PagoRow = RowDataPacket & {
  id: number
  fecha: string | Date
  descripcion: string
  deuda: string | null
  monto: number | string
}
type CountRow = RowDataPacket & { total: number }
type MonedaRow = RowDataPacket & { moneda: string }

export type DeudaInput = {
  nombre: string
  acreedor: string | null
  saldoInicial: number
  cuota: number
  proximaFecha: string | null
}

function parseDeuda(body: unknown): DeudaInput {
  const record = recordOf(body, 'Los datos de la deuda no son válidos')
  return {
    nombre: requiredText(record.nombre, 'El nombre', 120),
    acreedor: optionalText(record.acreedor, 'El acreedor', 150),
    saldoInicial: moneyField(record.saldoInicial, 'El saldo inicial', 0),
    cuota: moneyField(record.cuota, 'La cuota', 0),
    proximaFecha: optionalIsoDate(record.proximaFecha, 'La próxima fecha'),
  }
}

export async function listDeudas() {
  const [monedaRows, deudas, pagos] = await Promise.all([
    pool.query<MonedaRow[]>('SELECT moneda FROM perfil WHERE id = 1'),
    pool.query<DeudaRow[]>(
      `SELECT id, nombre, acreedor, saldo_inicial, cuota, proxima_fecha, saldo, estado
       FROM v_deudas
       WHERE archivado = 0
       ORDER BY proxima_fecha IS NULL, proxima_fecha, nombre`,
    ),
    pool.query<PagoRow[]>(
      `SELECT id, fecha, descripcion, deuda, monto
       FROM v_movimientos
       WHERE deuda_id IS NOT NULL
       ORDER BY fecha DESC, id DESC
       LIMIT 8`,
    ),
  ])
  if (!monedaRows[0][0]) throw new Error('No hay un perfil en la base. Ejecuta db.sql.')

  return {
    moneda: monedaRows[0][0].moneda,
    deudas: deudas[0].map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      acreedor: row.acreedor,
      saldoInicial: money(num(row.saldo_inicial)),
      cuota: money(num(row.cuota)),
      proximaFecha: dateOnly(row.proxima_fecha),
      saldo: money(num(row.saldo)),
      estado: row.estado,
    })),
    pagos: pagos[0].map((row) => ({
      id: Number(row.id),
      fecha: dateOnly(row.fecha) ?? '',
      descripcion: row.descripcion,
      deuda: row.deuda,
      monto: money(num(row.monto)),
    })),
  }
}

export async function createDeuda(body: unknown): Promise<{ id: number }> {
  const input = parseDeuda(body)
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO deudas (nombre, acreedor, saldo_inicial, cuota, proxima_fecha)
     VALUES (?, ?, ?, ?, ?)`,
    [input.nombre, input.acreedor, input.saldoInicial, input.cuota, input.proximaFecha],
  )
  return { id: Number(result.insertId) }
}

export async function updateDeuda(id: number, body: unknown): Promise<void> {
  const input = parseDeuda(body)
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE deudas
     SET nombre = ?, acreedor = ?, saldo_inicial = ?, cuota = ?, proxima_fecha = ?
     WHERE id = ? AND archivado = 0`,
    [input.nombre, input.acreedor, input.saldoInicial, input.cuota, input.proximaFecha, id],
  )
  if (result.affectedRows === 0) throw new Error('La deuda no existe')
}

export async function deleteDeuda(id: number): Promise<void> {
  const [usage] = await pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM movimientos WHERE deuda_id = ?', [id])
  if (Number(usage[0]?.total) > 0) {
    throw new Error('No se puede eliminar: esta deuda ya tiene pagos')
  }
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM deudas WHERE id = ? AND archivado = 0', [id])
  if (result.affectedRows === 0) throw new Error('La deuda no existe')
}
