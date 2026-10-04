export type MovementType = 'ingreso' | 'gasto'

export type Transaction = {
  id: string
  date: string
  description: string
  category: string
  account: string
  type: MovementType
  amount: number
}

export type Account = {
  id: string
  name: string
  type: string
  balance: number
  lastMove: string
}

export type Budget = {
  id: string
  category: string
  spent: number
  limit: number
}

export type Goal = {
  id: string
  name: string
  saved: number
  target: number
  due: string
}

export type Debt = {
  id: string
  name: string
  balance: number
  installment: number
  nextDate: string
  status: 'al dia' | 'proxima' | 'vencida'
}

export type Investment = {
  id: string
  name: string
  value: number
  change: number
  type: string
}

export type Category = {
  id: string
  name: string
  type: MovementType
  monthTotal: number
}

export type MonthPoint = {
  month: string
  income: number
  expense: number
}

export const profile = {
  name: 'Esteban',
  initials: 'ED',
  email: 'esteban@localhost',
}

export const kpis = {
  balance: 12840,
  income: 4850,
  expense: 3210,
  saved: 1640,
  incomeDelta: 8.4,
  expenseDelta: -3.1,
  savedDelta: 12.0,
}

export const monthlySeries: MonthPoint[] = [
  { month: 'Abr', income: 4100, expense: 2980 },
  { month: 'May', income: 4300, expense: 3120 },
  { month: 'Jun', income: 3900, expense: 3400 },
  { month: 'Jul', income: 4600, expense: 3050 },
  { month: 'Ago', income: 4400, expense: 2890 },
  { month: 'Sep', income: 4850, expense: 3210 },
]

export const transactions: Transaction[] = [
  { id: 't1', date: '2026-09-28', description: 'Nómina septiembre', category: 'Salario', account: 'Cuenta nómina', type: 'ingreso', amount: 3200 },
  { id: 't2', date: '2026-09-27', description: 'Supermercado Semana', category: 'Alimentación', account: 'Tarjeta débito', type: 'gasto', amount: 86.4 },
  { id: 't3', date: '2026-09-26', description: 'Freelance diseño', category: 'Freelance', account: 'Banco digital', type: 'ingreso', amount: 650 },
  { id: 't4', date: '2026-09-25', description: 'Renta departamento', category: 'Vivienda', account: 'Cuenta nómina', type: 'gasto', amount: 850 },
  { id: 't5', date: '2026-09-24', description: 'Metro y buses', category: 'Transporte', account: 'Efectivo', type: 'gasto', amount: 22.5 },
  { id: 't6', date: '2026-09-22', description: 'Cine y cena', category: 'Entretenimiento', account: 'Tarjeta débito', type: 'gasto', amount: 54 },
  { id: 't7', date: '2026-09-20', description: 'Farmacia', category: 'Salud', account: 'Cuenta nómina', type: 'gasto', amount: 31.2 },
  { id: 't8', date: '2026-09-18', description: 'Internet + móvil', category: 'Servicios', account: 'Cuenta nómina', type: 'gasto', amount: 68 },
  { id: 't9', date: '2026-09-15', description: 'Dividendos ETF', category: 'Inversiones', account: 'Banco digital', type: 'ingreso', amount: 42 },
  { id: 't10', date: '2026-09-12', description: 'Ropa temporada', category: 'Compras', account: 'Tarjeta débito', type: 'gasto', amount: 79 },
  { id: 't11', date: '2026-09-08', description: 'Transferencia extra', category: 'Otros ingresos', account: 'Cuenta nómina', type: 'ingreso', amount: 200 },
  { id: 't12', date: '2026-09-04', description: 'Gasolina', category: 'Transporte', account: 'Efectivo', type: 'gasto', amount: 38 },
]

export const upcoming = [
  { id: 'u1', label: 'Cuota préstamo auto', date: '02 oct', amount: 310 },
  { id: 'u2', label: 'Tarjeta de crédito', date: '05 oct', amount: 180 },
  { id: 'u3', label: 'Seguro de salud', date: '10 oct', amount: 95 },
]

export const accounts: Account[] = [
  { id: 'a1', name: 'Efectivo', type: 'Efectivo', balance: 340, lastMove: 'Hace 2 días' },
  { id: 'a2', name: 'Cuenta nómina', type: 'Banco', balance: 7850, lastMove: 'Hoy' },
  { id: 'a3', name: 'Banco digital', type: 'Banco', balance: 4200, lastMove: 'Hace 4 días' },
  { id: 'a4', name: 'Tarjeta débito', type: 'Tarjeta', balance: 450, lastMove: 'Ayer' },
]

export const budgets: Budget[] = [
  { id: 'b1', category: 'Alimentación', spent: 420, limit: 500 },
  { id: 'b2', category: 'Transporte', spent: 180, limit: 200 },
  { id: 'b3', category: 'Vivienda', spent: 850, limit: 900 },
  { id: 'b4', category: 'Entretenimiento', spent: 210, limit: 150 },
  { id: 'b5', category: 'Salud', spent: 60, limit: 120 },
  { id: 'b6', category: 'Servicios', spent: 190, limit: 200 },
]

export const goals: Goal[] = [
  { id: 'g1', name: 'Fondo de emergencia', saved: 4200, target: 6000, due: 'Dic 2026' },
  { id: 'g2', name: 'Viaje', saved: 1150, target: 3000, due: 'Mar 2027' },
  { id: 'g3', name: 'Laptop nueva', saved: 800, target: 1200, due: 'Nov 2026' },
]

export const debts: Debt[] = [
  { id: 'd1', name: 'Tarjeta de crédito', balance: 2340, installment: 180, nextDate: '05 oct 2026', status: 'proxima' },
  { id: 'd2', name: 'Préstamo auto', balance: 8900, installment: 310, nextDate: '02 oct 2026', status: 'al dia' },
  { id: 'd3', name: 'Préstamo personal', balance: 640, installment: 80, nextDate: '18 sep 2026', status: 'vencida' },
]

export const investments: Investment[] = [
  { id: 'i1', name: 'ETF global', type: 'ETF', value: 3200, change: 4.2 },
  { id: 'i2', name: 'Fondo indexado', type: 'Fondo', value: 1800, change: 1.6 },
  { id: 'i3', name: 'Acciones locales', type: 'Acciones', value: 740, change: -0.8 },
]

export const categories: Category[] = [
  { id: 'c1', name: 'Salario', type: 'ingreso', monthTotal: 3200 },
  { id: 'c2', name: 'Freelance', type: 'ingreso', monthTotal: 650 },
  { id: 'c3', name: 'Inversiones', type: 'ingreso', monthTotal: 42 },
  { id: 'c4', name: 'Otros ingresos', type: 'ingreso', monthTotal: 200 },
  { id: 'c5', name: 'Alimentación', type: 'gasto', monthTotal: 420 },
  { id: 'c6', name: 'Vivienda', type: 'gasto', monthTotal: 850 },
  { id: 'c7', name: 'Transporte', type: 'gasto', monthTotal: 180 },
  { id: 'c8', name: 'Entretenimiento', type: 'gasto', monthTotal: 210 },
  { id: 'c9', name: 'Salud', type: 'gasto', monthTotal: 60 },
  { id: 'c10', name: 'Servicios', type: 'gasto', monthTotal: 190 },
  { id: 'c11', name: 'Compras', type: 'gasto', monthTotal: 79 },
]

export const notifications = [
  { id: 'n1', title: 'Presupuesto de entretenimiento', text: 'Ya superaste el límite de septiembre.' },
  { id: 'n2', title: 'Deuda vencida', text: 'El préstamo personal tiene una cuota pendiente.' },
  { id: 'n3', title: 'Meta cercana', text: 'La laptop nueva está al 67%.' },
]

export const yearCompare = [
  { month: 'Ene', income: 4000, expense: 3100 },
  { month: 'Feb', income: 4100, expense: 2900 },
  { month: 'Mar', income: 4250, expense: 3300 },
  { month: 'Abr', income: 4100, expense: 2980 },
  { month: 'May', income: 4300, expense: 3120 },
  { month: 'Jun', income: 3900, expense: 3400 },
  { month: 'Jul', income: 4600, expense: 3050 },
  { month: 'Ago', income: 4400, expense: 2890 },
  { month: 'Sep', income: 4850, expense: 3210 },
]
