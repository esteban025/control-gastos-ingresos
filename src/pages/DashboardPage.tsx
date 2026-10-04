import { Link } from 'react-router-dom'
import { BarCompare } from '../components/charts/BarCompare'
import { Donut } from '../components/charts/Donut'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Page } from '../components/ui/Page'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard } from '../components/ui/StatCard'
import { useDashboard } from '../context/dashboard-store'
import { formatDate, formatMoney, percent } from '../lib/format'
import { IconFlag, IconTrend, IconWallet } from '../lib/icons'

const debtStatus = {
  'al dia': 'Al día',
  proxima: 'Próxima',
  vencida: 'Vencida',
} as const

function deltaMeta(delta: number | null, comparacion: string): string | undefined {
  if (delta === null) return undefined
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  return `${arrow} ${Math.abs(delta)}% ${comparacion}`
}

/** Para ingresos/ahorro subir es bueno; para gastos es malo. */
function deltaTone(delta: number | null, higherIsGood: boolean): 'good' | 'bad' | undefined {
  if (delta === null || delta === 0) return undefined
  return delta > 0 === higherIsGood ? 'good' : 'bad'
}

function DashboardSkeleton() {
  return (
    <>
      <section className="dash-overview">
        <article className="card dash-balance skeleton-card">
          <div className="skeleton" style={{ width: 110, height: 12 }} />
          <div className="skeleton" style={{ width: '70%', height: 40 }} />
        </article>
        <div className="dash-kpis">
          {[0, 1, 2].map((i) => (
            <article className="card skeleton-card" key={i}>
              <div className="skeleton" style={{ width: '60%', height: 12 }} />
              <div className="skeleton" style={{ width: '80%', height: 26 }} />
            </article>
          ))}
        </div>
      </section>
      <div className="grid grid-2">
        {[0, 1].map((i) => (
          <article className="card" key={i}>
            <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 20 }} />
            <div className="skeleton" style={{ height: 200 }} />
          </article>
        ))}
      </div>
    </>
  )
}

export function DashboardPage() {
  const { data, loading, error, reload } = useDashboard()

  if (loading || !data) {
    return (
      <Page title="Dashboard" subtitle={error ? 'No se pudo cargar el resumen' : 'Cargando resumen…'}>
        {error ? (
          <article className="card">
            <p className="form-error">{error}</p>
            <Button onClick={reload}>Reintentar</Button>
          </article>
        ) : (
          <DashboardSkeleton />
        )}
      </Page>
    )
  }

  const money = (value: number) => formatMoney(value, data.moneda)

  return (
    <Page title="Dashboard" subtitle={`Resumen de ${data.etiqueta}`}>
      <section className="dash-overview">
        <article className="card dash-balance">
          <div>
            <p className="dash-kicker">Balance total</p>
            <p className="dash-balance__value">{money(data.balance)}</p>
          </div>
          <p className="dash-balance__note">
            Todas las cuentas · ahorro del periodo{' '}
            <strong style={{ color: data.ahorro >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{money(data.ahorro)}</strong>
          </p>
        </article>
        <div className="dash-kpis">
          <StatCard
            label="Ingresos del periodo"
            value={money(data.ingresos)}
            meta={deltaMeta(data.ingresosDelta, data.comparacion)}
            tone={deltaTone(data.ingresosDelta, true)}
            icon={<IconTrend />}
            iconTone="pos"
          />
          <StatCard
            label="Gastos del periodo"
            value={money(data.gastos)}
            meta={deltaMeta(data.gastosDelta, data.comparacion)}
            tone={deltaTone(data.gastosDelta, false)}
            icon={<IconWallet />}
            iconTone="neg"
          />
          <StatCard
            label="Ahorro del periodo"
            value={money(data.ahorro)}
            meta={deltaMeta(data.ahorroDelta, data.comparacion)}
            tone={deltaTone(data.ahorroDelta, true)}
            icon={<IconFlag />}
            iconTone="accent"
          />
        </div>
      </section>

      <div className="grid grid-2 mb-16">
        <Card title="Ingresos vs gastos" hint="Últimos 6 meses">
          <BarCompare data={data.serie} format={money} />
        </Card>
        <Card title="Gastos por categoría" hint="Este periodo">
          {data.gastosPorCategoria.length > 0 ? (
            <Donut segments={data.gastosPorCategoria} format={money} />
          ) : (
            <p className="empty">Sin gastos en este periodo.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-2 mb-16">
        <Card
          title="Presupuestos"
          hint="Límite frente a gastado"
          action={
            <Link className="btn btn-soft" to="/presupuestos">
              Ver todos
            </Link>
          }
        >
          {data.presupuestos.length === 0 ? (
            <p className="empty">No hay presupuestos para este mes.</p>
          ) : (
            <div className="row-list">
              {data.presupuestos.map((budget) => {
                const value = percent(budget.gastado, budget.tope)
                return (
                  <div key={budget.id}>
                    <div className="goal-top">
                      <span className="row__title">{budget.categoria}</span>
                      <span className="row__sub">
                        {money(budget.gastado)} / {money(budget.tope)}
                      </span>
                    </div>
                    <ProgressBar value={value} />
                  </div>
                )
              })}
            </div>
          )}
        </Card>
        <Card
          title="Movimientos recientes"
          action={
            <Link className="btn btn-soft" to="/transacciones">
              Ver lista
            </Link>
          }
        >
          {data.movimientos.length === 0 ? (
            <p className="empty">Sin movimientos en este periodo.</p>
          ) : (
            <div className="row-list">
              {data.movimientos.map((movement) => {
                const inbound = movement.efecto === 'suma'
                return (
                  <div className="row" key={movement.id}>
                    <div className={`row__icon ${inbound ? 'is-in' : 'is-out'}`}>{inbound ? '↓' : '↑'}</div>
                    <div className="row__main">
                      <div className="row__title">{movement.descripcion || 'Sin descripción'}</div>
                      <div className="row__sub">
                        {movement.categoria} · {formatDate(movement.fecha)}
                      </div>
                    </div>
                    <div className={`row__amount ${inbound ? 'is-in' : 'is-out'}`}>
                      {inbound ? '+' : '−'}
                      {money(movement.monto)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Card title="Próximas cuotas" hint="Pagos de deudas" className="account-card">
        {data.cuotas.length === 0 ? (
          <p className="empty">No hay cuotas con fecha.</p>
        ) : (
          <div className="grid grid-3">
            {data.cuotas.map((cuota) => (
              <div className="row" key={cuota.id}>
                <div className="row__main">
                  <div className="row__title">{cuota.nombre}</div>
                  <div className="row__sub">{formatDate(cuota.fecha)}</div>
                </div>
                <strong>{money(cuota.monto)}</strong>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-3 mt-16">
        <Card
          title="Metas"
          action={
            <Link className="btn btn-soft" to="/metas">
              Abrir
            </Link>
          }
        >
          <div className="row-list">
            {data.metas.map((goal) => (
              <div key={goal.id}>
                <div className="goal-top">
                  <span className="row__title">{goal.nombre}</span>
                  <span className="row__sub">{percent(goal.ahorrado, goal.objetivo)}%</span>
                </div>
                <ProgressBar value={percent(goal.ahorrado, goal.objetivo)} />
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Deudas"
          action={
            <Link className="btn btn-soft" to="/deudas">
              Abrir
            </Link>
          }
        >
          <div className="row-list">
            {data.deudas.map((debt) => (
              <div className="row" key={debt.id}>
                <div className="row__main">
                  <div className="row__title">{debt.nombre}</div>
                  <div className="row__sub">{debt.proximaFecha ? formatDate(debt.proximaFecha) : 'Sin fecha'}</div>
                </div>
                <Badge tone={debt.estado === 'vencida' ? 'warn' : 'muted'}>
                  {debtStatus[debt.estado as keyof typeof debtStatus] ?? debt.estado}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Inversiones"
          action={
            <Link className="btn btn-soft" to="/inversiones">
              Abrir
            </Link>
          }
        >
          <div className="row-list">
            {data.inversiones.map((investment) => (
              <div className="row" key={investment.id}>
                <div className="row__main">
                  <div className="row__title">{investment.nombre}</div>
                  <div className="row__sub">{investment.tipo}</div>
                </div>
                <div className={`row__amount ${investment.variacion >= 0 ? 'is-in' : 'is-out'}`}>
                  {investment.variacion >= 0 ? '+' : ''}
                  {investment.variacion}%
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  )
}
