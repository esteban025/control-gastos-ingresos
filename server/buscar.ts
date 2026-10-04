import type { RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { dateOnly, money, num } from './values.ts'

type MovimientoRow = RowDataPacket & {
  id: number
  fecha: string | Date
  descripcion: string
  categoria: string | null
  cuenta: string
  efecto: string
  monto: number | string
}
type NombreRow = RowDataPacket & { id: number; nombre: string; tipo?: string }

export async function buscar(query: string) {
  const term = query.trim()
  if (term.length < 2) {
    return { movimientos: [], categorias: [], cuentas: [] }
  }
  const like = `%${term}%`
  const [movimientos, categorias, cuentas] = await Promise.all([
    pool.query<MovimientoRow[]>(
      `SELECT id, fecha, descripcion, categoria, cuenta, efecto, monto
       FROM v_movimientos
       WHERE descripcion LIKE ? OR categoria LIKE ? OR cuenta LIKE ?
       ORDER BY fecha DESC, id DESC
       LIMIT 6`,
      [like, like, like],
    ),
    pool.query<NombreRow[]>(
      `SELECT c.id, c.nombre, t.nombre AS tipo
       FROM categorias c
       JOIN tipos_movimiento t ON t.id = c.tipo_id
       WHERE c.archivado = 0 AND c.nombre LIKE ?
       ORDER BY c.nombre
       LIMIT 5`,
      [like],
    ),
    pool.query<NombreRow[]>(
      'SELECT id, nombre FROM cuentas WHERE archivado = 0 AND nombre LIKE ? ORDER BY nombre LIMIT 5',
      [like],
    ),
  ])

  return {
    movimientos: movimientos[0].map((row) => ({
      id: Number(row.id),
      fecha: dateOnly(row.fecha) ?? '',
      descripcion: row.descripcion || 'Sin descripción',
      categoria: row.categoria,
      cuenta: row.cuenta,
      efecto: row.efecto,
      monto: money(num(row.monto)),
    })),
    categorias: categorias[0].map((row) => ({ id: Number(row.id), nombre: row.nombre, tipo: row.tipo ?? '' })),
    cuentas: cuentas[0].map((row) => ({ id: Number(row.id), nombre: row.nombre })),
  }
}
