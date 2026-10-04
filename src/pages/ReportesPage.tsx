import { useEffect, useState } from 'react'
import { BarCompare } from '../components/charts/BarCompare'
import { Donut } from '../components/charts/Donut'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Page } from '../components/ui/Page'
import { useDashboard } from '../context/dashboard-store'
import { fetchReportes, type ReportesData } from '../lib/api'
import { formatMoney } from '../lib/format'

export function ReportesPage() {
  const { periodo, revision, reload } = useDashboard()
  const [data, setData] = useState<ReportesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchReportes(periodo)
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los reportes')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [periodo, revision])

  if (loading && !data) {
    return (
      <Page title="Reportes" subtitle="Cargando…">
        {null}
      </Page>
    )
  }

  if (error || !data) {
    return (
      <Page title="Reportes" subtitle="No se pudo cargar">
        <article className="card">
          <p className="form-error">{error}</p>
          <Button onClick={() => reload()}>Reintentar</Button>
        </article>
      </Page>
    )
  }

  const money = (value: number) => formatMoney(value, data.moneda)

  return (
    <Page title="Reportes" subtitle={`Año ${data.anio}. El recorte del encabezado es ${data.etiqueta}.`}>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <article className="card stat">
          <p className="stat__label">Ingresos del año</p>
          <p className="stat__value">{money(data.ingresosAnio)}</p>
        </article>
        <article className="card stat">
          <p className="stat__label">Gastos del año</p>
          <p className="stat__value">{money(data.gastosAnio)}</p>
        </article>
        <article className="card stat">
          <p className="stat__label">Ahorro del año</p>
          <p className="stat__value">{money(data.ahorroAnio)}</p>
        </article>
        <article className="card stat">
          <p className="stat__label">Ahorro del periodo</p>
          <p className="stat__value">{money(data.ahorroPeriodo)}</p>
        </article>
      </div>
      <div className="grid grid-2">
        <Card title="Año en curso" hint="Ingresos y gastos por mes">
          <BarCompare data={data.serie} height={240} format={money} />
        </Card>
        <Card title="Top categorías de gasto">
          {data.categorias.length > 0 ? (
            <Donut segments={data.categorias} format={money} />
          ) : (
            <p className="row__sub">Sin gastos en el año.</p>
          )}
        </Card>
      </div>
    </Page>
  )
}
