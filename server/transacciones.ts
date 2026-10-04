import type { RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { perfilPeriodo } from './periodo-perfil.ts'
import type { Periodo } from './period.ts'
import { dateOnly, money, num } from './values.ts'

export type Transaccion = {
  id: number
  fecha: string
  descripcion: string
  categoria: string | null
  categoriaId: number | null
  cuenta: string
  cuentaId: number
  tipoId: number
  tipo: string
  efecto: string
  monto: number
  modoId: number | null
  metaId: number | null
  deudaId: number | null
}

type MovimientoRow = RowDataPacket & {
  id: number
  fecha: string | Date
  descripcion: string
  categoria: string | null
  categoria_id: number | null
  cuenta: string
  cuenta_id: number
  tipo_id: number
  tipo: string
  efecto: string
  monto: number | string
  modo_id: number | null
  meta_id: number | null
  deuda_id: number | null
}

function mapRow(row: MovimientoRow): Transaccion {
  return {
    id: Number(row.id),
    fecha: dateOnly(row.fecha) ?? '',
    descripcion: row.descripcion,
    categoria: row.categoria,
    categoriaId: row.categoria_id == null ? null : Number(row.categoria_id),
    cuenta: row.cuenta,
    cuentaId: Number(row.cuenta_id),
    tipoId: Number(row.tipo_id),
    tipo: row.tipo,
    efecto: row.efecto,
    monto: money(num(row.monto)),
    modoId: row.modo_id == null ? null : Number(row.modo_id),
    metaId: row.meta_id == null ? null : Number(row.meta_id),
    deudaId: row.deuda_id == null ? null : Number(row.deuda_id),
  }
}

export async function listTransacciones(periodo: Periodo, query: string) {
  const { moneda, resolved } = await perfilPeriodo(periodo)
  const term = query.trim()
  const searching = term.length > 0
  const like = `%${term}%`
  const [rows] = searching
    ? await pool.query<MovimientoRow[]>(
        `SELECT id, fecha, descripcion, categoria, categoria_id, cuenta, cuenta_id, tipo_id, tipo, efecto, monto, modo_id, meta_id, deuda_id
         FROM v_movimientos
         WHERE descripcion LIKE ? OR categoria LIKE ? OR cuenta LIKE ? OR tipo LIKE ?
         ORDER BY fecha DESC, id DESC
         LIMIT 200`,
        [like, like, like, like],
      )
    : await pool.query<MovimientoRow[]>(
        `SELECT id, fecha, descripcion, categoria, categoria_id, cuenta, cuenta_id, tipo_id, tipo, efecto, monto, modo_id, meta_id, deuda_id
         FROM v_movimientos
         WHERE fecha >= ? AND fecha <= ?
         ORDER BY fecha DESC, id DESC`,
        [resolved.range.desde, resolved.range.hasta],
      )

  return {
    moneda,
    etiqueta: searching ? `Resultados de “${term}”` : resolved.etiqueta,
    buscando: searching,
    movimientos: rows.map(mapRow),
  }
}
