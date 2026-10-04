import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { perfilPeriodo } from './periodo-perfil.ts'
import type { Periodo } from './period.ts'
import { asId, money, num, recordOf, requiredText } from './values.ts'

type CategoriaRow = RowDataPacket & {
  id: number
  nombre: string
  tipo_id: number
  tipo_codigo: string
  tipo: string
  total: number | string
}
type TipoRow = RowDataPacket & { id: number; codigo: string; nombre: string }
type CountRow = RowDataPacket & { total: number }

export type CategoriaInput = {
  nombre: string
  tipoId: number
}

function parseCategoria(body: unknown): CategoriaInput {
  const record = recordOf(body, 'Los datos de la categoría no son válidos')
  const tipoId = asId(record.tipoId)
  if (!tipoId) throw new Error('Elige un tipo')
  return { nombre: requiredText(record.nombre, 'El nombre', 80), tipoId }
}

export async function listCategorias(periodo: Periodo) {
  const { moneda, resolved } = await perfilPeriodo(periodo)
  const [categorias, tipos] = await Promise.all([
    pool.query<CategoriaRow[]>(
      `SELECT c.id, c.nombre, c.tipo_id, t.codigo AS tipo_codigo, t.nombre AS tipo,
              COALESCE((
                SELECT SUM(m.monto)
                FROM movimientos m
                JOIN tipos_movimiento tm ON tm.id = m.tipo_id
                WHERE m.categoria_id = c.id
                  AND m.fecha >= ? AND m.fecha <= ?
                  AND tm.cuenta_en_periodo = 1
                  AND tm.efecto = t.efecto
              ), 0) AS total
       FROM categorias c
       JOIN tipos_movimiento t ON t.id = c.tipo_id
       WHERE c.archivado = 0
       ORDER BY t.id, c.nombre`,
      [resolved.range.desde, resolved.range.hasta],
    ),
    pool.query<TipoRow[]>(
      `SELECT id, codigo, nombre FROM tipos_movimiento WHERE archivado = 0 ORDER BY id`,
    ),
  ])

  return {
    moneda,
    etiqueta: resolved.etiqueta,
    tipos: tipos[0].map((row) => ({ id: Number(row.id), codigo: row.codigo, nombre: row.nombre })),
    categorias: categorias[0].map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      tipoId: Number(row.tipo_id),
      tipoCodigo: row.tipo_codigo,
      tipo: row.tipo,
      total: money(num(row.total)),
    })),
  }
}

async function assertTipo(tipoId: number) {
  const [rows] = await pool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM tipos_movimiento WHERE id = ? AND archivado = 0',
    [tipoId],
  )
  if (Number(rows[0]?.total) === 0) throw new Error('El tipo no existe o está archivado')
}

async function assertNombreLibre(tipoId: number, nombre: string, ignoreId?: number) {
  const [rows] = await pool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM categorias WHERE tipo_id = ? AND nombre = ? AND id <> ?',
    [tipoId, nombre, ignoreId ?? 0],
  )
  if (Number(rows[0]?.total) > 0) throw new Error('Ya existe una categoría con ese nombre para este tipo')
}

export async function createCategoria(body: unknown): Promise<{ id: number }> {
  const input = parseCategoria(body)
  await assertTipo(input.tipoId)
  await assertNombreLibre(input.tipoId, input.nombre)
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO categorias (tipo_id, nombre) VALUES (?, ?)',
    [input.tipoId, input.nombre],
  )
  return { id: Number(result.insertId) }
}

export async function updateCategoria(id: number, body: unknown): Promise<void> {
  const input = parseCategoria(body)
  await assertTipo(input.tipoId)
  const [usage] = await pool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM movimientos WHERE categoria_id = ?',
    [id],
  )
  if (Number(usage[0]?.total) > 0) {
    const [current] = await pool.query<RowDataPacket[]>('SELECT tipo_id FROM categorias WHERE id = ?', [id])
    if (Number(current[0]?.tipo_id) !== input.tipoId) {
      throw new Error('No se puede cambiar el tipo: esta categoría ya tiene movimientos')
    }
  }
  await assertNombreLibre(input.tipoId, input.nombre, id)
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE categorias SET tipo_id = ?, nombre = ? WHERE id = ? AND archivado = 0',
    [input.tipoId, input.nombre, id],
  )
  if (result.affectedRows === 0) throw new Error('La categoría no existe')
}

export async function deleteCategoria(id: number): Promise<void> {
  const [usage] = await pool.query<CountRow[]>(
    `SELECT
       (SELECT COUNT(*) FROM movimientos WHERE categoria_id = ?)
       + (SELECT COUNT(*) FROM presupuestos WHERE categoria_id = ?) AS total`,
    [id, id],
  )
  if (Number(usage[0]?.total) > 0) {
    throw new Error('No se puede eliminar: esta categoría ya tiene movimientos o presupuestos')
  }
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM categorias WHERE id = ? AND archivado = 0', [id])
  if (result.affectedRows === 0) throw new Error('La categoría no existe')
}
