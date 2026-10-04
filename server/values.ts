export function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function money(value: number): number {
  return Math.round(value * 100) / 100
}

export function asId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export function optionalId(value: unknown, label: string): number | null {
  if (value == null || value === '') return null
  const id = asId(value)
  if (!id) throw new Error(`${label} no es válido`)
  return id
}

export function dateOnly(value: string | Date | null): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${value.getFullYear()}-${month}-${day}`
  }
  return String(value).slice(0, 10)
}

export function recordOf(body: unknown, label: string): Record<string, unknown> {
  if (!body || typeof body !== 'object') throw new Error(label)
  return body as Record<string, unknown>
}

export function requiredText(value: unknown, label: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > max) {
    throw new Error(`${label} es obligatorio y debe tener hasta ${max} caracteres`)
  }
  return text
}

export function optionalText(value: unknown, label: string, max: number): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > max) throw new Error(`${label} debe tener hasta ${max} caracteres`)
  return text || null
}

export function isoDate(value: unknown, label: string): string {
  const text = typeof value === 'string' ? value : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label} no es válida`)
  return text
}

export function optionalIsoDate(value: unknown, label: string): string | null {
  if (value == null || value === '') return null
  return isoDate(value, label)
}

export function moneyField(value: unknown, label: string, min: number): number {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount < min) {
    throw new Error(min > 0 ? `${label} debe ser mayor que cero` : `${label} no puede ser negativo`)
  }
  return money(amount)
}
