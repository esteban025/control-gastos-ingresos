import type { RowDataPacket } from 'mysql2'
import { pool } from './db.ts'
import {
  rangeFromStart,
  resolvePeriod,
  shortMonth,
  type DateRange,
  type Periodo,
} from './period.ts'

export type DashboardPayload = {
  moneda: string
  periodo: Periodo
  etiqueta: string
  comparacion: string
  balance: number
  ingresos: number
  gastos: number
  ahorro: number
  ingresosDelta: number | null
  gastosDelta: number | null
  ahorroDelta: number | null
  serie: { month: string; income: number; expense: number }[]
  gastosPorCategoria: { label: string; value: number }[]
  presupuestos: { id: number; categoria: string; gastado: number; tope: number }[]
  movimientos: {
    id: number
    fecha: string
    descripcion: string
    categoria: string
    efecto: string
    monto: number
  }[]
  cuotas: { id: number; nombre: string; fecha: string; monto: number }[]
  metas: { id: number; nombre: string; ahorrado: number; objetivo: number }[]
  deudas: { id: number; nombre: string; proximaFecha: string | null; estado: string }[]
  inversiones: { id: number; nombre: string; tipo: string; variacion: number }[]
  avisos: { id: string; title: string; text: string }[]
}

type ProfileRow = RowDataPacket & {
  moneda: string
  dia_inicio_mes: number
  aviso_cuotas: number
  aviso_presupuesto: number
}

type AmountRow = RowDataPacket & { balance: number | string }

type MovementRow = RowDataPacket & {
  fecha: string | Date
  monto: number | string
  efecto: string
  cuenta_en_periodo: number
  categoria: string | null
}

type BudgetRow = RowDataPacket & {
  id: number
  categoria: string
  gastado: number | string
  tope: number | string
  excedido: number
}

type RecentRow = RowDataPacket & {
  id: number
  fecha: string | Date
  descripcion: string
  categoria: string | null
  efecto: string
  monto: number | string
}

type DebtRow = RowDataPacket & {
  id: number
  nombre: string
  proxima_fecha: string | Date | null
  estado: string
  cuota: number | string
}

type GoalRow = RowDataPacket & {
  id: number
  nombre: string
  ahorrado: number | string
  objetivo: number | string
  porcentaje: number | string
}

type InvestmentRow = RowDataPacket & {
  id: number
  nombre: string
  tipo: string
  variacion: number | string
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number): number {
  return Math.round(value * 100) / 100
}

function dateOnly(value: string | Date | null): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${value.getFullYear()}-${month}-${day}`
  }
  return String(value).slice(0, 10)
}

function inRange(fecha: string, range: DateRange): boolean {
  return fecha >= range.desde && fecha <= range.hasta
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

function totals(rows: MovementRow[], range: DateRange) {
  let ingresos = 0
  let gastos = 0
  for (const row of rows) {
    const fecha = dateOnly(row.fecha)
    if (!fecha || !inRange(fecha, range) || !row.cuenta_en_periodo) continue
    if (row.efecto === 'suma') ingresos += num(row.monto)
    if (row.efecto === 'resta') gastos += num(row.monto)
  }
  return { ingresos: money(ingresos), gastos: money(gastos), ahorro: money(ingresos - gastos) }
}

export async function getDashboard(periodo: Periodo): Promise<DashboardPayload> {
  const [profiles] = await pool.query<ProfileRow[]>(
    'SELECT moneda, dia_inicio_mes, aviso_cuotas, aviso_presupuesto FROM perfil WHERE id = 1',
  )
  const profile = profiles[0]
  if (!profile) {
    throw new Error('No hay un perfil en la base. Ejecuta db.sql.')
  }

  const resolved = resolvePeriod(new Date(), Number(profile.dia_inicio_mes) || 1, periodo)
  const chartRanges = resolved.chartStarts.map((start) => ({
    start,
    range: rangeFromStart(start),
  }))
  const fetchDesde = [resolved.previous.desde, resolved.range.desde, chartRanges[0]?.range.desde ?? resolved.range.desde]
    .sort()[0]
  const fetchHasta = [resolved.previous.hasta, resolved.range.hasta, chartRanges.at(-1)?.range.hasta ?? resolved.range.hasta]
    .sort()
    .at(-1)

  const [balanceRows, movementRows, budgetRows, recentRows, cuotaRows, debtRows, goalRows, investmentRows] =
    await Promise.all([
      pool.query<AmountRow[]>('SELECT COALESCE(SUM(saldo_actual), 0) AS balance FROM v_cuentas WHERE archivado = 0'),
      pool.query<MovementRow[]>(
        `SELECT m.fecha, m.monto, t.efecto, t.cuenta_en_periodo, c.nombre AS categoria
         FROM movimientos m
         JOIN tipos_movimiento t ON t.id = m.tipo_id
         LEFT JOIN categorias c ON c.id = m.categoria_id
         WHERE m.fecha >= ? AND m.fecha <= ?`,
        [fetchDesde, fetchHasta],
      ),
      pool.query<BudgetRow[]>(
        `SELECT id, categoria, gastado, tope, excedido
         FROM v_presupuestos
         WHERE anio = ? AND mes = ?
         ORDER BY id`,
        [resolved.budget.year, resolved.budget.monthIndex + 1],
      ),
      pool.query<RecentRow[]>(
        `SELECT id, fecha, descripcion, categoria, efecto, monto
         FROM v_movimientos
         WHERE fecha >= ? AND fecha <= ?
         ORDER BY fecha DESC, id DESC
         LIMIT 5`,
        [resolved.range.desde, resolved.range.hasta],
      ),
      pool.query<DebtRow[]>(
        `SELECT id, nombre, proxima_fecha, estado, cuota
         FROM v_deudas
         WHERE archivado = 0 AND proxima_fecha IS NOT NULL
         ORDER BY proxima_fecha
         LIMIT 3`,
      ),
      pool.query<DebtRow[]>(
        `SELECT id, nombre, proxima_fecha, estado, cuota
         FROM v_deudas
         WHERE archivado = 0
         ORDER BY proxima_fecha IS NULL, proxima_fecha, id`,
      ),
      pool.query<GoalRow[]>(
        `SELECT id, nombre, ahorrado, objetivo, porcentaje
         FROM v_metas
         WHERE archivado = 0
         ORDER BY id`,
      ),
      pool.query<InvestmentRow[]>(
        `SELECT i.id, i.nombre, t.nombre AS tipo, i.variacion_pct AS variacion
         FROM inversiones i
         JOIN tipos_inversion t ON t.id = i.tipo_inversion_id
         WHERE i.archivado = 0
         ORDER BY i.nombre`,
      ),
    ])

  const movements = movementRows[0]
  const current = totals(movements, resolved.range)
  const previous = totals(movements, resolved.previous)

  const byCategory = new Map<string, number>()
  for (const row of movements) {
    const fecha = dateOnly(row.fecha)
    if (!fecha || !inRange(fecha, resolved.range) || !row.cuenta_en_periodo || row.efecto !== 'resta') continue
    const label = row.categoria ?? 'Sin categoría'
    byCategory.set(label, (byCategory.get(label) ?? 0) + num(row.monto))
  }

  const budgets = budgetRows[0].map((row) => ({
    id: Number(row.id),
    categoria: row.categoria,
    gastado: money(num(row.gastado)),
    tope: money(num(row.tope)),
    excedido: Number(row.excedido) === 1,
  }))

  const goals = goalRows[0].map((row) => ({
    id: Number(row.id),
    nombre: row.nombre,
    ahorrado: money(num(row.ahorrado)),
    objetivo: money(num(row.objetivo)),
    porcentaje: num(row.porcentaje),
  }))

  const avisos: DashboardPayload['avisos'] = []
  if (Number(profile.aviso_presupuesto) === 1) {
    for (const budget of budgets) {
      if (!budget.excedido) continue
      avisos.push({
        id: `presupuesto-${budget.id}`,
        title: `Presupuesto de ${budget.categoria.toLowerCase()}`,
        text: 'Ya superaste el límite de este mes.',
      })
    }
  }
  if (Number(profile.aviso_cuotas) === 1) {
    for (const debt of debtRows[0]) {
      if (debt.estado !== 'vencida') continue
      avisos.push({
        id: `deuda-${debt.id}`,
        title: 'Deuda vencida',
        text: `${debt.nombre} tiene una cuota pendiente.`,
      })
    }
  }
  for (const goal of goals) {
    if (goal.porcentaje < 80) continue
    avisos.push({
      id: `meta-${goal.id}`,
      title: goal.porcentaje >= 100 ? 'Meta cumplida' : 'Meta cercana',
      text: `${goal.nombre} está al ${Math.round(goal.porcentaje)}%.`,
    })
  }

  return {
    moneda: profile.moneda,
    periodo,
    etiqueta: resolved.etiqueta,
    comparacion: resolved.comparacion,
    balance: money(num(balanceRows[0][0]?.balance)),
    ingresos: current.ingresos,
    gastos: current.gastos,
    ahorro: current.ahorro,
    ingresosDelta: percentDelta(current.ingresos, previous.ingresos),
    gastosDelta: percentDelta(current.gastos, previous.gastos),
    ahorroDelta: percentDelta(current.ahorro, previous.ahorro),
    serie: chartRanges.map(({ start, range }) => {
      const point = totals(movements, range)
      return { month: shortMonth(start.monthIndex), income: point.ingresos, expense: point.gastos }
    }),
    gastosPorCategoria: [...byCategory.entries()]
      .map(([label, value]) => ({ label, value: money(value) }))
      .sort((a, b) => b.value - a.value),
    presupuestos: budgets.slice(0, 4).map(({ id, categoria, gastado, tope }) => ({ id, categoria, gastado, tope })),
    movimientos: recentRows[0].map((row) => ({
      id: Number(row.id),
      fecha: dateOnly(row.fecha) ?? '',
      descripcion: row.descripcion,
      categoria: row.categoria ?? 'Sin categoría',
      efecto: row.efecto,
      monto: money(num(row.monto)),
    })),
    cuotas: cuotaRows[0].map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      fecha: dateOnly(row.proxima_fecha) ?? '',
      monto: money(num(row.cuota)),
    })),
    metas: goals.map(({ id, nombre, ahorrado, objetivo }) => ({ id, nombre, ahorrado, objetivo })),
    deudas: debtRows[0].map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      proximaFecha: dateOnly(row.proxima_fecha),
      estado: row.estado,
    })),
    inversiones: investmentRows[0].map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      tipo: row.tipo,
      variacion: num(row.variacion),
    })),
    avisos,
  }
}
