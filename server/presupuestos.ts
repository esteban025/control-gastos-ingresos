import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { perfilPeriodo } from './periodo-perfil.ts'
import { longMonth, type Periodo } from './period.ts'
import { asId, money, moneyField, num, recordOf } from './values.ts'

export type PresupuestoInput = {
  categoriaId: number
  tope: number
}

type BudgetRow = RowDataPacket & {
  id: number
  categoria_id: number
  categoria: string
  gastado: number | string
  tope: number | string
  excedido: number
}
type CategoriaRow = RowDataPacket & { id: number; nombre: string }
type CountRow = RowDataPacket & { total: number }

function parsePresupuesto(body: unknown): PresupuestoInput {
  const record = recordOf(body, 'Los datos del presupuesto no son válidos')
  const categoriaId = asId(record.categoriaId)
  if (!categoriaId) throw new Error('Elige una categoría de gasto')
  return { categoriaId, tope: moneyField(record.tope, 'El tope', 0) }
}

async function budgetMonth(periodo: Periodo) {
  const { moneda, resolved } = await perfilPeriodo(periodo)
  return {
    moneda,
    anio: resolved.budget.year,
    mes: resolved.budget.monthIndex + 1,
    etiqueta: `${longMonth(resolved.budget.monthIndex)} ${resolved.budget.year}`,
  }
}

export async function listPresupuestos(periodo: Periodo) {
  const month = await budgetMonth(periodo)
  const [budgets, categorias] = await Promise.all([
    pool.query<BudgetRow[]>(
      `SELECT id, categoria_id, categoria, gastado, tope, excedido
       FROM v_presupuestos
       WHERE anio = ? AND mes = ?
       ORDER BY categoria`,
      [month.anio, month.mes],
    ),
    pool.query<CategoriaRow[]>(
      `SELECT c.id, c.nombre
       FROM categorias c
       JOIN tipos_movimiento t ON t.id = c.tipo_id
       WHERE c.archivado = 0 AND t.codigo = 'gasto'
       ORDER BY c.nombre`,
    ),
  ])

  return {
    ...month,
    categorias: categorias[0].map((row) => ({ id: Number(row.id), nombre: row.nombre })),
    presupuestos: budgets[0].map((row) => ({
      id: Number(row.id),
      categoriaId: Number(row.categoria_id),
      categoria: row.categoria,
      gastado: money(num(row.gastado)),
      tope: money(num(row.tope)),
      excedido: Boolean(row.excedido),
    })),
  }
}

async function assertLibre(categoriaId: number, anio: number, mes: number, ignoreId?: number) {
  const [rows] = await pool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM presupuestos WHERE categoria_id = ? AND anio = ? AND mes = ? AND id <> ?',
    [categoriaId, anio, mes, ignoreId ?? 0],
  )
  if (Number(rows[0]?.total) > 0) {
    throw new Error('Ya existe un presupuesto de esa categoría en este mes')
  }
}

export async function createPresupuesto(periodo: Periodo, body: unknown): Promise<{ id: number }> {
  const input = parsePresupuesto(body)
  const month = await budgetMonth(periodo)
  await assertLibre(input.categoriaId, month.anio, month.mes)
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO presupuestos (categoria_id, anio, mes, tope) VALUES (?, ?, ?, ?)',
    [input.categoriaId, month.anio, month.mes, input.tope],
  )
  return { id: Number(result.insertId) }
}

export async function updatePresupuesto(id: number, body: unknown): Promise<void> {
  const input = parsePresupuesto(body)
  const [current] = await pool.query<RowDataPacket[]>('SELECT anio, mes FROM presupuestos WHERE id = ?', [id])
  const row = current[0]
  if (!row) throw new Error('El presupuesto no existe')
  await assertLibre(input.categoriaId, Number(row.anio), Number(row.mes), id)
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE presupuestos SET categoria_id = ?, tope = ? WHERE id = ?',
    [input.categoriaId, input.tope, id],
  )
  if (result.affectedRows === 0) throw new Error('El presupuesto no existe')
}

export async function deletePresupuesto(id: number): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM presupuestos WHERE id = ?', [id])
  if (result.affectedRows === 0) throw new Error('El presupuesto no existe')
}
