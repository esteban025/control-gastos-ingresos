import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from './db.ts'

export type CuentaInput = {
  nombre: string
  tipoCuentaId: number
  institucion: string | null
  saldoInicial: number
  fechaSaldoInicial: string
}

export type CuentasPayload = {
  moneda: string
  tipos: { id: number; nombre: string }[]
  cuentas: {
    id: number
    nombre: string
    institucion: string | null
    tipoCuentaId: number
    tipoCuenta: string
    saldoInicial: number
    fechaSaldoInicial: string
    saldoActual: number
    ultimaFecha: string | null
  }[]
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

type ProfileRow = RowDataPacket & { moneda: string }
type TipoRow = RowDataPacket & { id: number; nombre: string }
type CuentaRow = RowDataPacket & {
  id: number
  nombre: string
  institucion: string | null
  tipo_cuenta_id: number
  tipo_cuenta: string
  saldo_inicial: number | string
  fecha_saldo_inicial: string | Date
  saldo_actual: number | string
  ultima_fecha: string | Date | null
}
type MovimientoRow = RowDataPacket & {
  id: number
  fecha: string | Date
  descripcion: string
  cuenta: string
  cuenta_destino: string | null
  efecto: string
  monto: number | string
}
type CountRow = RowDataPacket & { total: number }

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

function asId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export function parseCuenta(body: unknown): CuentaInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Los datos de la cuenta no son válidos')
  }
  const record = body as Record<string, unknown>
  const nombre = typeof record.nombre === 'string' ? record.nombre.trim() : ''
  const tipoCuentaId = asId(record.tipoCuentaId)
  const institucionRaw = typeof record.institucion === 'string' ? record.institucion.trim() : ''
  const saldoInicial = typeof record.saldoInicial === 'number' ? record.saldoInicial : Number(record.saldoInicial)
  const fechaSaldoInicial = typeof record.fechaSaldoInicial === 'string' ? record.fechaSaldoInicial : ''

  if (!nombre || nombre.length > 120) {
    throw new Error('El nombre es obligatorio y debe tener hasta 120 caracteres')
  }
  if (!tipoCuentaId) {
    throw new Error('Elige un tipo de cuenta')
  }
  if (institucionRaw.length > 150) {
    throw new Error('La institución debe tener hasta 150 caracteres')
  }
  if (!Number.isFinite(saldoInicial)) {
    throw new Error('El saldo inicial no es válido')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaSaldoInicial)) {
    throw new Error('La fecha del saldo inicial no es válida')
  }

  return {
    nombre,
    tipoCuentaId,
    institucion: institucionRaw || null,
    saldoInicial: money(saldoInicial),
    fechaSaldoInicial,
  }
}

async function assertTipoActivo(tipoCuentaId: number) {
  const [rows] = await pool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM tipos_cuenta WHERE id = ? AND archivado = 0',
    [tipoCuentaId],
  )
  if (Number(rows[0]?.total) === 0) {
    throw new Error('El tipo de cuenta no existe o está archivado')
  }
}

export async function listCuentas(): Promise<CuentasPayload> {
  const [profiles] = await pool.query<ProfileRow[]>('SELECT moneda FROM perfil WHERE id = 1')
  const profile = profiles[0]
  if (!profile) throw new Error('No hay un perfil en la base. Ejecuta db.sql.')

  const [tipos, cuentas, movimientos] = await Promise.all([
    pool.query<TipoRow[]>('SELECT id, nombre FROM tipos_cuenta WHERE archivado = 0 ORDER BY nombre'),
    pool.query<CuentaRow[]>(
      `SELECT id, nombre, institucion, tipo_cuenta_id, tipo_cuenta, saldo_inicial, fecha_saldo_inicial, saldo_actual, ultima_fecha
       FROM v_cuentas
       WHERE archivado = 0
       ORDER BY nombre`,
    ),
    pool.query<MovimientoRow[]>(
      `SELECT id, fecha, descripcion, cuenta, cuenta_destino, efecto, monto
       FROM v_movimientos
       WHERE cuenta_id IN (SELECT id FROM cuentas WHERE archivado = 0)
          OR cuenta_destino_id IN (SELECT id FROM cuentas WHERE archivado = 0)
       ORDER BY fecha DESC, id DESC
       LIMIT 8`,
    ),
  ])

  return {
    moneda: profile.moneda,
    tipos: tipos[0].map((row) => ({ id: Number(row.id), nombre: row.nombre })),
    cuentas: cuentas[0].map((row) => ({
      id: Number(row.id),
      nombre: row.nombre,
      institucion: row.institucion,
      tipoCuentaId: Number(row.tipo_cuenta_id),
      tipoCuenta: row.tipo_cuenta,
      saldoInicial: money(num(row.saldo_inicial)),
      fechaSaldoInicial: dateOnly(row.fecha_saldo_inicial) ?? '',
      saldoActual: money(num(row.saldo_actual)),
      ultimaFecha: dateOnly(row.ultima_fecha),
    })),
    movimientos: movimientos[0].map((row) => ({
      id: Number(row.id),
      fecha: dateOnly(row.fecha) ?? '',
      descripcion: row.descripcion,
      cuenta: row.cuenta,
      cuentaDestino: row.cuenta_destino,
      efecto: row.efecto,
      monto: money(num(row.monto)),
    })),
  }
}

export async function createCuenta(input: CuentaInput): Promise<{ id: number }> {
  await assertTipoActivo(input.tipoCuentaId)
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO cuentas (tipo_cuenta_id, nombre, institucion, saldo_inicial, fecha_saldo_inicial)
     VALUES (?, ?, ?, ?, ?)`,
    [input.tipoCuentaId, input.nombre, input.institucion, input.saldoInicial, input.fechaSaldoInicial],
  )
  return { id: Number(result.insertId) }
}

export async function updateCuenta(id: number, input: CuentaInput): Promise<void> {
  await assertTipoActivo(input.tipoCuentaId)
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE cuentas
     SET tipo_cuenta_id = ?, nombre = ?, institucion = ?, saldo_inicial = ?, fecha_saldo_inicial = ?
     WHERE id = ? AND archivado = 0`,
    [input.tipoCuentaId, input.nombre, input.institucion, input.saldoInicial, input.fechaSaldoInicial, id],
  )
  if (result.affectedRows === 0) {
    throw new Error('La cuenta no existe')
  }
}

export async function deleteCuenta(id: number): Promise<void> {
  const [usage] = await pool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM movimientos WHERE cuenta_id = ? OR cuenta_destino_id = ?',
    [id, id],
  )
  if (Number(usage[0]?.total) > 0) {
    throw new Error('No se puede eliminar: esta cuenta ya tiene movimientos')
  }

  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM cuentas WHERE id = ? AND archivado = 0', [id])
  if (result.affectedRows === 0) {
    throw new Error('La cuenta no existe')
  }
}
