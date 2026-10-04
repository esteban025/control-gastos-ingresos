import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Page } from '../components/ui/Page'
import { useDashboard } from '../context/dashboard-store'
import { fetchDeudas, removeDeuda, saveDeuda, type Deuda, type DeudasData } from '../lib/api'
import { formatDate, formatMoney } from '../lib/format'

const statusLabel = {
  'al dia': 'Al día',
  proxima: 'Próxima',
  vencida: 'Vencida',
} as const

function parseAmount(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

function statusTone(estado: string): 'warn' | 'accent' | 'muted' {
  if (estado === 'vencida') return 'warn'
  if (estado === 'proxima') return 'accent'
  return 'muted'
}

export function DeudasPage() {
  const { revision, reload: reloadDashboard } = useDashboard()
  const [data, setData] = useState<DeudasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Deuda | null>(null)
  const [nombre, setNombre] = useState('')
  const [acreedor, setAcreedor] = useState('')
  const [saldo, setSaldo] = useState('')
  const [cuota, setCuota] = useState('')
  const [fecha, setFecha] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Deuda | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchDeudas()
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las deudas')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  const money = (value: number) => formatMoney(value, data?.moneda ?? 'USD')
  const total = data?.deudas.reduce((sum, deuda) => sum + deuda.saldo, 0) ?? 0
  const cuotas = data?.deudas.reduce((sum, deuda) => sum + deuda.cuota, 0) ?? 0

  function openCreate() {
    setEditing(null)
    setNombre('')
    setAcreedor('')
    setSaldo('')
    setCuota('')
    setFecha('')
    setFormError(null)
    setOpen(true)
  }

  function openEdit(deuda: Deuda) {
    setEditing(deuda)
    setNombre(deuda.nombre)
    setAcreedor(deuda.acreedor ?? '')
    setSaldo(String(deuda.saldoInicial))
    setCuota(String(deuda.cuota))
    setFecha(deuda.proximaFecha ?? '')
    setFormError(null)
    setOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const saldoNum = parseAmount(saldo)
    const cuotaNum = parseAmount(cuota)
    if (!nombre.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }
    if (!Number.isFinite(saldoNum) || saldoNum < 0 || !Number.isFinite(cuotaNum) || cuotaNum < 0) {
      setFormError('El saldo y la cuota no pueden ser negativos')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await saveDeuda(
        {
          nombre: nombre.trim(),
          acreedor: acreedor.trim(),
          saldoInicial: saldoNum,
          cuota: cuotaNum,
          proximaFecha: fecha,
        },
        editing?.id,
      )
      setOpen(false)
      reloadDashboard()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la deuda')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      await removeDeuda(pendingDelete.id)
      setPendingDelete(null)
      reloadDashboard()
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar la deuda')
    }
  }

  return (
    <Page
      title="Deudas"
      subtitle="El saldo es el inicial menos los gastos ligados a la deuda"
      actions={
        <Button onClick={openCreate} disabled={loading || !data}>
          Nueva deuda
        </Button>
      }
    >
      {loading && !data ? <p className="row__sub">Cargando deudas…</p> : null}
      {error ? (
        <article className="card">
          <p className="form-error">{error}</p>
          <Button onClick={() => reloadDashboard()}>Reintentar</Button>
        </article>
      ) : null}
      {data ? (
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <article className="card stat">
            <p className="stat__label">Saldo total</p>
            <p className="stat__value">{money(total)}</p>
          </article>
          <article className="card stat">
            <p className="stat__label">Cuotas</p>
            <p className="stat__value">{money(cuotas)}</p>
          </article>
        </div>
      ) : null}
      {data && data.deudas.length === 0 ? <p className="row__sub">Todavía no hay deudas.</p> : null}
      {data && data.deudas.length > 0 ? (
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          {data.deudas.map((deuda) => (
            <Card
              key={deuda.id}
              title={deuda.nombre}
              action={
                <Badge tone={statusTone(deuda.estado)}>
                  {statusLabel[deuda.estado as keyof typeof statusLabel] ?? deuda.estado}
                </Badge>
              }
            >
              <p className="stat__value" style={{ marginBottom: 10 }}>
                {money(deuda.saldo)}
              </p>
              <p className="row__sub">Cuota {money(deuda.cuota)}</p>
              <p className="row__sub">
                {deuda.proximaFecha ? `Próximo pago · ${formatDate(deuda.proximaFecha)}` : 'Sin fecha'}
                {deuda.acreedor ? ` · ${deuda.acreedor}` : ''}
              </p>
              <div className="account-card__actions">
                <Button variant="ghost" onClick={() => openEdit(deuda)}>
                  Editar
                </Button>
                <Button
                  variant="soft"
                  onClick={() => {
                    setDeleteError(null)
                    setPendingDelete(deuda)
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {data ? (
        <Card title="Pagos registrados">
          {data.pagos.length === 0 ? (
            <p className="row__sub">Un gasto baja el saldo si eliges la deuda al guardarlo.</p>
          ) : (
            <div className="row-list">
              {data.pagos.map((pago) => (
                <div className="row" key={pago.id}>
                  <div className="row__main">
                    <div className="row__title">{pago.descripcion || 'Sin descripción'}</div>
                    <div className="row__sub">
                      {pago.deuda} · {formatDate(pago.fecha)}
                    </div>
                  </div>
                  <div className="row__amount is-out">−{money(pago.monto)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <Modal open={open} title={editing ? 'Editar deuda' : 'Nueva deuda'} onClose={() => setOpen(false)}>
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="field">
            <label htmlFor="deuda-nombre">Nombre</label>
            <input id="deuda-nombre" value={nombre} onChange={(event) => setNombre(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="deuda-acreedor">Acreedor</label>
            <input id="deuda-acreedor" value={acreedor} onChange={(event) => setAcreedor(event.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="deuda-saldo">Saldo inicial</label>
              <input id="deuda-saldo" inputMode="decimal" value={saldo} onChange={(event) => setSaldo(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="deuda-cuota">Cuota</label>
              <input id="deuda-cuota" inputMode="decimal" value={cuota} onChange={(event) => setCuota(event.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="deuda-fecha">Próxima fecha</label>
            <input id="deuda-fecha" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
          </div>
          {editing ? (
            <p className="row__sub" style={{ marginTop: -6, marginBottom: 12 }}>
              La tarjeta muestra el saldo inicial menos los pagos. Aquí editas el punto de partida.
            </p>
          ) : null}
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="modal__actions">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={pendingDelete !== null} title="Eliminar deuda" onClose={() => setPendingDelete(null)}>
        <p className="row__sub" style={{ marginBottom: 14 }}>
          Si ya tiene pagos, no se puede borrar.
        </p>
        {deleteError ? <p className="form-error">{deleteError}</p> : null}
        <div className="modal__actions">
          <Button variant="ghost" type="button" onClick={() => setPendingDelete(null)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void onDelete()}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </Page>
  )
}
