import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { asId, dateOnly, money, moneyField, num, recordOf, requiredText } from './values.ts'

type InversionRow = RowDataPacket & {
  id: number
  nombre: string
  tipo_inversion_id: number
  tipo: string
  valor_actual: number | string
  variacion_pct: number | string
}
type TipoRow = RowDataPacket & { id: number; nombre: string }
type HistoricoRow = RowDataPacket & {
  id: number
  fecha: string | Date
  nombre: string
  valor: number | string
  variacion_pct: number | string
}
type CountRow = RowDataPacket & { total: number }
type MonedaRow = RowDataPacket & { moneda: string }

export type InversionInput = {
  nombre: string
  tipoInversionId: number
  valorActual: number
  variacionPct: number
}

function parseInversion(body: unknown): InversionInput {
  const record = recordOf(body, 'Los datos de la inversión no son válidos')
  const tipoInversionId = asId(record.tipoInversionId)
  const variacion = typeof record.variacionPct === 'number' ? record.variacionPct : Number(record.variacionPct)
  if (!tipoInversionId) throw new Error('Elige un tipo de inversión')
  if (!Number.isFinite(variacion) || Math.abs(variacion) > 99999.99) {
    throw new Error('La variación no es válida')
  }
  return {
    nombre: requiredText(record.nombre, 'El nombre', 120),
    tipoInversionId,
    valorActual: moneyField(record.valorActual, 'El valor', 0),
    variacionPct: money(variacion),
  }
}

async function assertTipo(tipoInversionId: number) {
  const [rows] = await pool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM tipos_inversion WHERE id = ? AND archivado = 0',
    [tipoInversionId],
  )
  if (Number(rows[0]?.total) === 0) throw new Error('El tipo de inversión no existe o está archivado')
}

async function snapshot(id: number, valor: number, variacion: number) {
  await pool.execute(
    `INSERT INTO inversion_historico (inversion_id, fecha, valor, variacion_pct)
     VALUES (?, CURRENT_DATE, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), variacion_pct = VALUES(variacion_pct)`,
    [id, valor, variacion],
  )
}

export async function listInversiones() {
  const [monedaRows, inversiones, tipos, historico] = await Promise.all([
    pool.query<MonedaRow[]>('SELECT moneda FROM perfil WHERE id = 1'),
    pool.query<InversionRow[]>(
      `SELECT i.id, i.nombre, i.tipo_inversion_id, t.nombre AS tipo, i.valor_actual, i.variacion_pct
       FROM inversiones i
       JOIN tipos_inversion t ON t.id = i.tipo_inversion_id
       WHERE i.archivado = 0
       ORDER BY i.nombre`,
    ),
    pool.query<TipoRow[]>('SELECT id, nombre FROM tipos_inversion WHERE archivado = 0 ORDER BY nombre'),
    pool.query<HistoricoRow[]>(
      `SELECT h.id, h.fecha, i.nombre, h.valor, h.variacion_pct
       FROM inversion_historico h
       JOIN inversiones i ON i.id = h.inversion_id
       WHERE i.archivado = 0
       ORDER BY h.fecha DESC, h.id DESC
       LIMIT 8`,
    ),
  ])
  if (!monedaRows[0][0]) throw new Error('No hay un perfil en la base. Ejecuta db.sql.')

  return {
    moneda: monedaRows[0][0].moneda,
    tipos: tipos[0].map((row) => ({ id: Number(row.id), nombre: row.nombre })),
    inversiones: inversiones[0].map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      tipoInversionId: Number(row.tipo_inversion_id),
      tipo: row.tipo,
      valor: money(num(row.valor_actual)),
      variacion: money(num(row.variacion_pct)),
    })),
    historico: historico[0].map((row) => ({
      id: Number(row.id),
      fecha: dateOnly(row.fecha) ?? '',
      nombre: row.nombre,
      valor: money(num(row.valor)),
      variacion: money(num(row.variacion_pct)),
    })),
  }
}

export async function createInversion(body: unknown): Promise<{ id: number }> {
  const input = parseInversion(body)
  await assertTipo(input.tipoInversionId)
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO inversiones (tipo_inversion_id, nombre, valor_actual, variacion_pct)
     VALUES (?, ?, ?, ?)`,
    [input.tipoInversionId, input.nombre, input.valorActual, input.variacionPct],
  )
  const id = Number(result.insertId)
  await snapshot(id, input.valorActual, input.variacionPct)
  return { id }
}

export async function updateInversion(id: number, body: unknown): Promise<void> {
  const input = parseInversion(body)
  await assertTipo(input.tipoInversionId)
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE inversiones
     SET tipo_inversion_id = ?, nombre = ?, valor_actual = ?, variacion_pct = ?
     WHERE id = ? AND archivado = 0`,
    [input.tipoInversionId, input.nombre, input.valorActual, input.variacionPct, id],
  )
  if (result.affectedRows === 0) throw new Error('La inversión no existe')
  await snapshot(id, input.valorActual, input.variacionPct)
}

export async function deleteInversion(id: number): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM inversiones WHERE id = ? AND archivado = 0', [id])
  if (result.affectedRows === 0) throw new Error('La inversión no existe')
}
