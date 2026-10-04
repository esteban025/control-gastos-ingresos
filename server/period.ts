export type Periodo = 'mes' | 'anterior' | 'anio'

export type DateRange = {
  desde: string
  hasta: string
}

export type MonthStart = {
  year: number
  monthIndex: number
  day: number
}

const LONG_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function isPeriodo(value: string): value is Periodo {
  return value === 'mes' || value === 'anterior' || value === 'anio'
}

function iso(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, '0')
  const date = String(day).padStart(2, '0')
  return `${year}-${month}-${date}`
}

function shiftMonth(start: MonthStart, delta: number): MonthStart {
  const date = new Date(start.year, start.monthIndex + delta, start.day)
  return { year: date.getFullYear(), monthIndex: date.getMonth(), day: date.getDate() }
}

export function monthStartContaining(today: Date, diaInicio: number): MonthStart {
  const year = today.getFullYear()
  const monthIndex = today.getMonth()
  const day = today.getDate()
  if (day < diaInicio) return shiftMonth({ year, monthIndex, day: diaInicio }, -1)
  return { year, monthIndex, day: diaInicio }
}

export function rangeFromStart(start: MonthStart): DateRange {
  const next = shiftMonth(start, 1)
  const end = new Date(next.year, next.monthIndex, next.day - 1)
  return {
    desde: iso(start.year, start.monthIndex, start.day),
    hasta: iso(end.getFullYear(), end.getMonth(), end.getDate()),
  }
}

export function lastMonthStarts(anchor: MonthStart, count: number): MonthStart[] {
  const starts: MonthStart[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    starts.push(shiftMonth(anchor, -offset))
  }
  return starts
}

export function shortMonth(monthIndex: number): string {
  return SHORT_MONTHS[monthIndex] ?? ''
}

export function longMonth(monthIndex: number): string {
  return LONG_MONTHS[monthIndex] ?? ''
}

export type ResolvedPeriod = {
  range: DateRange
  previous: DateRange
  chartStarts: MonthStart[]
  budget: MonthStart
  etiqueta: string
  comparacion: string
}

export function resolvePeriod(today: Date, diaInicio: number, periodo: Periodo): ResolvedPeriod {
  const current = monthStartContaining(today, diaInicio)

  if (periodo === 'anio') {
    const year = today.getFullYear()
    return {
      range: { desde: `${year}-01-01`, hasta: `${year}-12-31` },
      previous: { desde: `${year - 1}-01-01`, hasta: `${year - 1}-12-31` },
      chartStarts: lastMonthStarts(current, 6),
      budget: current,
      etiqueta: String(year),
      comparacion: `vs ${year - 1}`,
    }
  }

  const selected = periodo === 'mes' ? current : shiftMonth(current, -1)
  const before = shiftMonth(selected, -1)
  return {
    range: rangeFromStart(selected),
    previous: rangeFromStart(before),
    chartStarts: lastMonthStarts(selected, 6),
    budget: selected,
    etiqueta: `${longMonth(selected.monthIndex)} ${selected.year}`,
    comparacion: `vs ${longMonth(before.monthIndex)}`,
  }
}
