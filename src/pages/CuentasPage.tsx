import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Page } from '../components/ui/Page'
import { useDashboard } from '../context/dashboard-store'
import { fetchCuentas, removeCuenta, saveCuenta, type Cuenta, type CuentasData } from '../lib/api'
import { formatDate, formatMoney } from '../lib/format'
import { Select } from '../components/ui/Select'

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function parseAmount(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

const emptyForm = {
  nombre: '',
  tipoCuentaId: 0,
  institucion: '',
  saldo: '0',
  fecha: todayIso(),
}

export function CuentasPage() {
  const { reload: reloadDashboard, revision } = useDashboard()
  const [data, setData] = useState<CuentasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cuenta | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Cuenta | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchCuentas())
    } catch (reason) {
      setData(null)
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las cuentas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchCuentas()
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las cuentas')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  function openCreate() {
    const tipoId = data?.tipos[0]?.id ?? 0
    setEditing(null)
    setForm({ ...emptyForm, tipoCuentaId: tipoId, fecha: todayIso() })
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(cuenta: Cuenta) {
    setEditing(cuenta)
    setForm({
      nombre: cuenta.nombre,
      tipoCuentaId: cuenta.tipoCuentaId,
      institucion: cuenta.institucion ?? '',
      saldo: String(cuenta.saldoInicial),
      fecha: cuenta.fechaSaldoInicial,
    })
    setFormError(null)
    setFormOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const saldoInicial = parseAmount(form.saldo)
    if (!form.nombre.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }
    if (!form.tipoCuentaId) {
      setFormError('Elige un tipo de cuenta')
      return
    }
    if (!Number.isFinite(saldoInicial)) {
      setFormError('El saldo inicial no es válido')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      await saveCuenta(
        {
          nombre: form.nombre.trim(),
          tipoCuentaId: form.tipoCuentaId,
          institucion: form.institucion.trim(),
          saldoInicial,
          fechaSaldoInicial: form.fecha,
        },
        editing?.id,
      )
      setFormOpen(false)
      await load()
      reloadDashboard()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la cuenta')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await removeCuenta(pendingDelete.id)
      setPendingDelete(null)
      await load()
      reloadDashboard()
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar la cuenta')
    } finally {
      setDeleting(false)
    }
  }

  const money = (value: number) => formatMoney(value, data?.moneda ?? 'USD')

  return (
    <Page
      title="Cuentas"
      subtitle="Efectivo, bancos y cooperativas"
      actions={
        <Button onClick={openCreate} disabled={loading || !data}>
          Nueva cuenta
        </Button>
      }
    >
      {loading && !data ? <p className="row__sub">Cargando cuentas…</p> : null}
      {error ? (
        <article className="card">
          <p className="form-error">{error}</p>
          <Button onClick={() => void load()}>Reintentar</Button>
        </article>
      ) : null}

      {data && data.cuentas.length === 0 ? <p className="row__sub">Todavía no hay cuentas.</p> : null}

      {data && data.cuentas.length > 0 ? (
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          {data.cuentas.map((cuenta) => (
            <article className="card account-card" key={cuenta.id}>
              <p className="stat__label">{cuenta.tipoCuenta}</p>
              <p className="row__title" style={{ marginBottom: 8 }}>
                {cuenta.nombre}
              </p>
              {cuenta.institucion ? <p className="row__sub">{cuenta.institucion}</p> : null}
              <p className="stat__value">{money(cuenta.saldoActual)}</p>
              <p className="stat__meta">
                {cuenta.ultimaFecha ? `Último movimiento · ${formatDate(cuenta.ultimaFecha)}` : 'Sin movimientos'}
              </p>
              <div className="account-card__actions">
                <Button variant="ghost" onClick={() => openEdit(cuenta)}>
                  Editar
                </Button>
                <Button
                  variant="soft"
                  onClick={() => {
                    setDeleteError(null)
                    setPendingDelete(cuenta)
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {data ? (
        <Card title="Actividad reciente por cuenta">
          {data.movimientos.length === 0 ? (
            <p className="row__sub">Sin movimientos todavía.</p>
          ) : (
            <div className="row-list">
              {data.movimientos.map((movement) => {
                const inbound = movement.efecto === 'suma'
                const accountLabel =
                  movement.efecto === 'traslado' && movement.cuentaDestino
                    ? `${movement.cuenta} → ${movement.cuentaDestino}`
                    : movement.cuenta
                return (
                  <div className="row" key={movement.id}>
                    <div className="row__main">
                      <div className="row__title">{movement.descripcion || 'Sin descripción'}</div>
                      <div className="row__sub">
                        {accountLabel} · {formatDate(movement.fecha)}
                      </div>
                    </div>
                    <div className={`row__amount ${inbound ? 'is-in' : 'is-out'}`}>
                      {movement.efecto === 'traslado' ? '' : inbound ? '+' : '−'}
                      {money(movement.monto)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      ) : null}

      <Modal open={formOpen} title={editing ? 'Editar cuenta' : 'Nueva cuenta'} onClose={() => setFormOpen(false)}>
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="field">
            <label htmlFor="cuenta-nombre">Nombre</label>
            <input
              id="cuenta-nombre"
              value={form.nombre}
              onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="cuenta-tipo">Tipo</label>
              <Select
                id="cuenta-tipo"
                value={form.tipoCuentaId || ''}
                onChange={(value) => setForm((current) => ({ ...current, tipoCuentaId: Number(value) }))}
                options={(data?.tipos ?? []).map((tipo) => ({ value: tipo.id, label: tipo.nombre }))}
              />
            </div>
            <div className="field">
              <label htmlFor="cuenta-institucion">Banco o cooperativa</label>
              <input
                id="cuenta-institucion"
                placeholder="Opcional"
                value={form.institucion}
                onChange={(event) => setForm((current) => ({ ...current, institucion: event.target.value }))}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="cuenta-saldo">Saldo inicial</label>
              <input
                id="cuenta-saldo"
                type="text"
                inputMode="decimal"
                value={form.saldo}
                onChange={(event) => setForm((current) => ({ ...current, saldo: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="cuenta-fecha">Fecha del saldo</label>
              <input
                id="cuenta-fecha"
                type="date"
                value={form.fecha}
                onChange={(event) => setForm((current) => ({ ...current, fecha: event.target.value }))}
              />
            </div>
          </div>
          {editing ? (
            <p className="row__sub" style={{ marginTop: -6, marginBottom: 12 }}>
              El saldo en la tarjeta es el inicial más los movimientos. Aquí editas el punto de partida.
            </p>
          ) : null}
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="modal__actions">
            <Button variant="ghost" type="button" onClick={() => setFormOpen(false)}>
              Cerrar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={pendingDelete !== null}
        title="Eliminar cuenta"
        onClose={() => {
          if (!deleting) setPendingDelete(null)
        }}
      >
        <p className="row__title" style={{ marginBottom: 8 }}>
          {pendingDelete?.nombre}
        </p>
        <p className="row__sub" style={{ marginBottom: 14 }}>
          Si ya tiene movimientos, no se puede borrar.
        </p>
        {deleteError ? <p className="form-error">{deleteError}</p> : null}
        <div className="modal__actions">
          <Button variant="ghost" type="button" onClick={() => setPendingDelete(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void onDelete()} disabled={deleting}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </Page>
  )
}
