import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from './db.ts'

export type Catalogos = {
  tipos: { id: number; codigo: string; nombre: string }[]
  categorias: { id: number; tipoId: number; nombre: string }[]
  cuentas: { id: number; nombre: string }[]
  modos: { id: number; nombre: string }[]
  metas: { id: number; nombre: string }[]
  deudas: { id: number; nombre: string }[]
}

export type MovimientoInput = {
  tipoId: number
  categoriaId: number
  cuentaId: number
  modoId: number | null
  metaId: number | null
  deudaId: number | null
  fecha: string
  monto: number
  descripcion: string
}

type TipoRow = RowDataPacket & { id: number; codigo: string; nombre: string }
type CategoriaRow = RowDataPacket & { id: number; tipo_id: number; nombre: string }
type NombreRow = RowDataPacket & { id: number; nombre: string }
type MetaDeudaRow = RowDataPacket & { id: number; nombre: string }

export async function getCatalogos(): Promise<Catalogos> {
  const [tipos] = await pool.query<TipoRow[]>(
    `SELECT id, codigo, nombre
     FROM tipos_movimiento
     WHERE archivado = 0 AND codigo IN ('ingreso', 'gasto')
     ORDER BY id`,
  )
  const tipoIds = tipos.map((tipo) => Number(tipo.id))
  const [categorias] = tipoIds.length
    ? await pool.query<CategoriaRow[]>(
        `SELECT id, tipo_id, nombre
         FROM categorias
         WHERE archivado = 0 AND tipo_id IN (?)
         ORDER BY nombre`,
        [tipoIds],
      )
    : [[] as CategoriaRow[]]
  const [cuentas] = await pool.query<NombreRow[]>(
    'SELECT id, nombre FROM cuentas WHERE archivado = 0 ORDER BY nombre',
  )
  const [modos] = await pool.query<NombreRow[]>(
    'SELECT id, nombre FROM modos WHERE archivado = 0 ORDER BY nombre',
  )
  const [metas] = await pool.query<MetaDeudaRow[]>(
    'SELECT id, nombre FROM metas WHERE archivado = 0 ORDER BY nombre',
  )
  const [deudas] = await pool.query<MetaDeudaRow[]>(
    'SELECT id, nombre FROM deudas WHERE archivado = 0 ORDER BY nombre',
  )

  return {
    tipos: tipos.map((row) => ({ id: Number(row.id), codigo: row.codigo, nombre: row.nombre })),
    categorias: categorias.map((row) => ({
      id: Number(row.id),
      tipoId: Number(row.tipo_id),
      nombre: row.nombre,
    })),
    cuentas: cuentas.map((row) => ({ id: Number(row.id), nombre: row.nombre })),
    modos: modos.map((row) => ({ id: Number(row.id), nombre: row.nombre })),
    metas: metas.map((row) => ({ id: Number(row.id), nombre: row.nombre })),
    deudas: deudas.map((row) => ({ id: Number(row.id), nombre: row.nombre })),
  }
}

function asId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export function parseMovimiento(body: unknown): MovimientoInput {
  if (!body || typeof body !== 'object') {
    throw new Error('El cuerpo del movimiento no es válido')
  }
  const record = body as Record<string, unknown>
  const tipoId = asId(record.tipoId)
  const categoriaId = asId(record.categoriaId)
  const cuentaId = asId(record.cuentaId)
  const modoRaw = record.modoId
  const modoId = modoRaw == null || modoRaw === '' ? null : asId(modoRaw)
  const metaRaw = record.metaId
  const metaId = metaRaw == null || metaRaw === '' ? null : asId(metaRaw)
  const deudaRaw = record.deudaId
  const deudaId = deudaRaw == null || deudaRaw === '' ? null : asId(deudaRaw)
  const fecha = typeof record.fecha === 'string' ? record.fecha : ''
  const monto = typeof record.monto === 'number' ? record.monto : Number(record.monto)
  const descripcion = typeof record.descripcion === 'string' ? record.descripcion.trim() : ''

  if (!tipoId || !categoriaId || !cuentaId) {
    throw new Error('Tipo, categoría y cuenta son obligatorios')
  }
  if (modoRaw != null && modoRaw !== '' && modoId == null) {
    throw new Error('El modo no es válido')
  }
  if (metaRaw != null && metaRaw !== '' && metaId == null) {
    throw new Error('La meta no es válida')
  }
  if (deudaRaw != null && deudaRaw !== '' && deudaId == null) {
    throw new Error('La deuda no es válida')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('La fecha no es válida')
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error('El monto debe ser mayor que cero')
  }

  return {
    tipoId,
    categoriaId,
    cuentaId,
    modoId,
    metaId,
    deudaId,
    fecha,
    monto,
    descripcion,
  }
}

export async function createMovimiento(input: MovimientoInput): Promise<{ id: number }> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO movimientos (tipo_id, categoria_id, modo_id, cuenta_id, meta_id, deuda_id, fecha, monto, descripcion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.tipoId,
      input.categoriaId,
      input.modoId,
      input.cuentaId,
      input.metaId,
      input.deudaId,
      input.fecha,
      input.monto,
      input.descripcion,
    ],
  )
  return { id: Number(result.insertId) }
}

export async function updateMovimiento(id: number, input: MovimientoInput): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE movimientos
     SET tipo_id = ?, categoria_id = ?, modo_id = ?, cuenta_id = ?, meta_id = ?, deuda_id = ?,
         fecha = ?, monto = ?, descripcion = ?
     WHERE id = ?`,
    [
      input.tipoId,
      input.categoriaId,
      input.modoId,
      input.cuentaId,
      input.metaId,
      input.deudaId,
      input.fecha,
      input.monto,
      input.descripcion,
      id,
    ],
  )
  if (result.affectedRows === 0) throw new Error('El movimiento no existe')
}

export async function deleteMovimiento(id: number): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM movimientos WHERE id = ?', [id])
  if (result.affectedRows === 0) throw new Error('El movimiento no existe')
}

export function databaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'sqlMessage' in error && typeof error.sqlMessage === 'string') {
    return error.sqlMessage
  }
  if (error instanceof Error && error.message) return error.message
  return 'No se pudo guardar el movimiento'
}
