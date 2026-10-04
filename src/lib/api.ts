export type Periodo = 'mes' | 'anterior' | 'anio'

export type DashboardData = {
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

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? body.error : undefined
    throw new Error(message || 'No se pudo completar la solicitud')
  }
  return body as T
}

export async function fetchDashboard(periodo: Periodo): Promise<DashboardData> {
  const response = await fetch(`/api/dashboard?periodo=${encodeURIComponent(periodo)}`)
  return readJson<DashboardData>(response)
}

export async function fetchCatalogos(): Promise<Catalogos> {
  const response = await fetch('/api/catalogos')
  return readJson<Catalogos>(response)
}

export type Cuenta = {
  id: number
  nombre: string
  institucion: string | null
  tipoCuentaId: number
  tipoCuenta: string
  saldoInicial: number
  fechaSaldoInicial: string
  saldoActual: number
  ultimaFecha: string | null
}

export type CuentasData = {
  moneda: string
  tipos: { id: number; nombre: string }[]
  cuentas: Cuenta[]
  movimientos: {
    id: number
    fecha: string
    descripcion: string
    cuenta: string
    cuentaDestino: string | null
    efecto: string
    monto: number
  }[]
}

export type CuentaInput = {
  nombre: string
  tipoCuentaId: number
  institucion: string
  saldoInicial: number
  fechaSaldoInicial: string
}

export async function fetchCuentas(): Promise<CuentasData> {
  const response = await fetch('/api/cuentas')
  return readJson<CuentasData>(response)
}

export async function saveCuenta(input: CuentaInput, id?: number): Promise<{ id: number }> {
  const response = await fetch(id ? `/api/cuentas/${id}` : '/api/cuentas', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readJson<{ id: number }>(response)
}

export async function removeCuenta(id: number): Promise<void> {
  const response = await fetch(`/api/cuentas/${id}`, { method: 'DELETE' })
  await readJson<{ ok: boolean }>(response)
}

export async function createMovimiento(input: MovimientoInput): Promise<{ id: number }> {
  return saveMovimiento(input)
}

export async function saveMovimiento(input: MovimientoInput, id?: number): Promise<{ id: number }> {
  const response = await fetch(id ? `/api/movimientos/${id}` : '/api/movimientos', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readJson<{ id: number }>(response)
}

export async function removeMovimiento(id: number): Promise<void> {
  const response = await fetch(`/api/movimientos/${id}`, { method: 'DELETE' })
  await readJson<{ ok: boolean }>(response)
}

export type TransaccionesData = {
  moneda: string
  etiqueta: string
  buscando: boolean
  movimientos: {
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
  }[]
}

export async function fetchTransacciones(periodo: Periodo, query = ''): Promise<TransaccionesData> {
  const params = new URLSearchParams({ periodo })
  if (query) params.set('q', query)
  return readJson<TransaccionesData>(await fetch(`/api/transacciones?${params}`))
}

export type Presupuesto = {
  id: number
  categoriaId: number
  categoria: string
  gastado: number
  tope: number
  excedido: boolean
}

export type PresupuestosData = {
  moneda: string
  anio: number
  mes: number
  etiqueta: string
  categorias: { id: number; nombre: string }[]
  presupuestos: Presupuesto[]
}

export async function fetchPresupuestos(periodo: Periodo): Promise<PresupuestosData> {
  return readJson<PresupuestosData>(await fetch(`/api/presupuestos?periodo=${periodo}`))
}

export async function savePresupuesto(
  input: { categoriaId: number; tope: number },
  periodo: Periodo,
  id?: number,
): Promise<{ id: number }> {
  const response = await fetch(id ? `/api/presupuestos/${id}` : `/api/presupuestos?periodo=${periodo}`, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readJson<{ id: number }>(response)
}

export async function removePresupuesto(id: number): Promise<void> {
  await readJson(await fetch(`/api/presupuestos/${id}`, { method: 'DELETE' }))
}

export type Meta = {
  id: number
  nombre: string
  objetivo: number
  fechaObjetivo: string | null
  cuentaId: number | null
  cuenta: string | null
  ahorradoInicial: number
  ahorrado: number
  porcentaje: number
}

export type MetasData = {
  moneda: string
  cuentas: { id: number; nombre: string }[]
  metas: Meta[]
  aportes: { id: number; fecha: string; descripcion: string; meta: string | null; monto: number }[]
}

export type MetaInput = {
  nombre: string
  objetivo: number
  fechaObjetivo: string | null
  cuentaId: number | null
  ahorradoInicial: number
}

export async function fetchMetas(): Promise<MetasData> {
  return readJson<MetasData>(await fetch('/api/metas'))
}

export async function saveMeta(input: MetaInput, id?: number): Promise<{ id: number }> {
  const response = await fetch(id ? `/api/metas/${id}` : '/api/metas', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readJson<{ id: number }>(response)
}

export async function removeMeta(id: number): Promise<void> {
  await readJson(await fetch(`/api/metas/${id}`, { method: 'DELETE' }))
}

export type Deuda = {
  id: number
  nombre: string
  acreedor: string | null
  saldoInicial: number
  cuota: number
  proximaFecha: string | null
  saldo: number
  estado: string
}

export type DeudasData = {
  moneda: string
  deudas: Deuda[]
  pagos: { id: number; fecha: string; descripcion: string; deuda: string | null; monto: number }[]
}

export type DeudaInput = {
  nombre: string
  acreedor: string
  saldoInicial: number
  cuota: number
  proximaFecha: string
}

export async function fetchDeudas(): Promise<DeudasData> {
  return readJson<DeudasData>(await fetch('/api/deudas'))
}

export async function saveDeuda(input: DeudaInput, id?: number): Promise<{ id: number }> {
  const response = await fetch(id ? `/api/deudas/${id}` : '/api/deudas', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readJson<{ id: number }>(response)
}

export async function removeDeuda(id: number): Promise<void> {
  await readJson(await fetch(`/api/deudas/${id}`, { method: 'DELETE' }))
}

export type Inversion = {
  id: number
  nombre: string
  tipoInversionId: number
  tipo: string
  valor: number
  variacion: number
}

export type InversionesData = {
  moneda: string
  tipos: { id: number; nombre: string }[]
  inversiones: Inversion[]
  historico: { id: number; fecha: string; nombre: string; valor: number; variacion: number }[]
}

export type InversionInput = {
  nombre: string
  tipoInversionId: number
  valorActual: number
  variacionPct: number
}

export async function fetchInversiones(): Promise<InversionesData> {
  return readJson<InversionesData>(await fetch('/api/inversiones'))
}

export async function saveInversion(input: InversionInput, id?: number): Promise<{ id: number }> {
  const response = await fetch(id ? `/api/inversiones/${id}` : '/api/inversiones', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readJson<{ id: number }>(response)
}

export async function removeInversion(id: number): Promise<void> {
  await readJson(await fetch(`/api/inversiones/${id}`, { method: 'DELETE' }))
}

export type Categoria = {
  id: number
  nombre: string
  tipoId: number
  tipoCodigo: string
  tipo: string
  total: number
}

export type CategoriasData = {
  moneda: string
  etiqueta: string
  tipos: { id: number; codigo: string; nombre: string }[]
  categorias: Categoria[]
}

export async function fetchCategorias(periodo: Periodo): Promise<CategoriasData> {
  return readJson<CategoriasData>(await fetch(`/api/categorias?periodo=${periodo}`))
}

export async function saveCategoria(input: { nombre: string; tipoId: number }, id?: number): Promise<{ id: number }> {
  const response = await fetch(id ? `/api/categorias/${id}` : '/api/categorias', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readJson<{ id: number }>(response)
}

export async function removeCategoria(id: number): Promise<void> {
  await readJson(await fetch(`/api/categorias/${id}`, { method: 'DELETE' }))
}

export type ReportesData = {
  moneda: string
  anio: number
  etiqueta: string
  ingresosAnio: number
  gastosAnio: number
  ahorroAnio: number
  ahorroPeriodo: number
  serie: { month: string; income: number; expense: number }[]
  categorias: { label: string; value: number }[]
}

export async function fetchReportes(periodo: Periodo): Promise<ReportesData> {
  return readJson<ReportesData>(await fetch(`/api/reportes?periodo=${periodo}`))
}

export type Perfil = {
  nombre: string
  correo: string
  moneda: string
  diaInicioMes: number
  avisoCuotas: boolean
  avisoPresupuesto: boolean
  resumenSemanal: boolean
}

export async function fetchPerfil(): Promise<Perfil> {
  return readJson<Perfil>(await fetch('/api/perfil'))
}

export async function savePerfil(input: Perfil): Promise<Perfil> {
  const response = await fetch('/api/perfil', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readJson<Perfil>(response)
}

export type Busqueda = {
  movimientos: {
    id: number
    fecha: string
    descripcion: string
    categoria: string | null
    cuenta: string
    efecto: string
    monto: number
  }[]
  categorias: { id: number; nombre: string; tipo: string }[]
  cuentas: { id: number; nombre: string }[]
}

export async function fetchBusqueda(query: string): Promise<Busqueda> {
  return readJson<Busqueda>(await fetch(`/api/buscar?q=${encodeURIComponent(query)}`))
}
