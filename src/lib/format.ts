export function formatMoney(value: number, currency = 'USD'): string {
  const sign = value < 0 ? '-' : ''
  try {
    const formatted = new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Math.abs(value))
    return `${sign}${formatted}`
  } catch {
    return `${sign}${Math.abs(value).toFixed(2)} ${currency}`
  }
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`)
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}
