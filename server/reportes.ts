import type { RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import { perfilPeriodo } from './periodo-perfil.ts'
import { shortMonth, type Periodo } from './period.ts'
import { money, num } from './values.ts'

type MovementRow = RowDataPacket & {
  fecha: string
  monto: number | string
  efecto: string
  cuenta_en_periodo: number
  categoria: string | null
}

function inRange(fecha: string, desde: string, hasta: string) {
  return fecha >= desde && fecha <= hasta
}

export async function getReportes(periodo: Periodo) {
  const { moneda, resolved } = await perfilPeriodo(periodo)
  const year = new Date().getFullYear()
  const yearFrom = `${year}-01-01`
  const yearTo = `${year}-12-31`
  const [rows] = await pool.query<MovementRow[]>(
    `SELECT m.fecha, m.monto, t.efecto, t.cuenta_en_periodo, c.nombre AS categoria
     FROM movimientos m
     JOIN tipos_movimiento t ON t.id = m.tipo_id
     LEFT JOIN categorias c ON c.id = m.categoria_id
     WHERE m.fecha >= ? AND m.fecha <= ?`,
    [yearFrom, yearTo],
  )

  let ingresosAnio = 0
  let gastosAnio = 0
  let ahorroPeriodo = 0
  const serie = Array.from({ length: 12 }, (_, monthIndex) => ({
    month: shortMonth(monthIndex),
    income: 0,
    expense: 0,
  }))
  const porCategoria = new Map<string, number>()

  for (const row of rows) {
    const fecha = String(row.fecha).slice(0, 10)
    if (!row.cuenta_en_periodo) continue
    const monto = num(row.monto)
    const monthIndex = Number(fecha.slice(5, 7)) - 1
    const bucket = serie[monthIndex]
    if (row.efecto === 'suma') {
      ingresosAnio += monto
      if (bucket) bucket.income += monto
      if (inRange(fecha, resolved.range.desde, resolved.range.hasta)) ahorroPeriodo += monto
    }
    if (row.efecto === 'resta') {
      gastosAnio += monto
      if (bucket) bucket.expense += monto
      if (inRange(fecha, resolved.range.desde, resolved.range.hasta)) ahorroPeriodo -= monto
      const label = row.categoria || 'Sin categoría'
      porCategoria.set(label, (porCategoria.get(label) ?? 0) + monto)
    }
  }

  const categorias = [...porCategoria.entries()]
    .map(([label, value]) => ({ label, value: money(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return {
    moneda,
    anio: year,
    etiqueta: resolved.etiqueta,
    ingresosAnio: money(ingresosAnio),
    gastosAnio: money(gastosAnio),
    ahorroAnio: money(ingresosAnio - gastosAnio),
    ahorroPeriodo: money(ahorroPeriodo),
    serie: serie.map((point) => ({
      month: point.month,
      income: money(point.income),
      expense: money(point.expense),
    })),
    categorias,
  }
}
