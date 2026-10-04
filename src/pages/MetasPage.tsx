import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Page } from '../components/ui/Page'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useDashboard } from '../context/dashboard-store'
import { fetchMetas, removeMeta, saveMeta, type Meta, type MetasData } from '../lib/api'
import { formatDate, formatMoney, percent } from '../lib/format'
import { Select } from '../components/ui/Select'

function parseAmount(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

export function MetasPage() {
  const { revision, reload: reloadDashboard } = useDashboard()
  const [data, setData] = useState<MetasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Meta | null>(null)
  const [nombre, setNombre] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [ahorrado, setAhorrado] = useState('0')
  const [fecha, setFecha] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Meta | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchMetas()
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las metas')
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

  function openCreate() {
    setEditing(null)
    setNombre('')
    setObjetivo('')
    setAhorrado('0')
    setFecha('')
    setCuentaId('')
    setFormError(null)
    setOpen(true)
  }

  function openEdit(meta: Meta) {
    setEditing(meta)
    setNombre(meta.nombre)
    setObjetivo(String(meta.objetivo))
    setAhorrado(String(meta.ahorradoInicial))
    setFecha(meta.fechaObjetivo ?? '')
    setCuentaId(meta.cuentaId ? String(meta.cuentaId) : '')
    setFormError(null)
    setOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const objetivoNum = parseAmount(objetivo)
    const ahorradoNum = parseAmount(ahorrado)
    if (!nombre.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }
    if (!Number.isFinite(objetivoNum) || objetivoNum <= 0) {
      setFormError('El objetivo debe ser mayor que cero')
      return
    }
    if (!Number.isFinite(ahorradoNum) || ahorradoNum < 0) {
      setFormError('El ahorrado inicial no es válido')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await saveMeta(
        {
          nombre: nombre.trim(),
          objetivo: objetivoNum,
          fechaObjetivo: fecha || null,
          cuentaId: cuentaId ? Number(cuentaId) : null,
          ahorradoInicial: ahorradoNum,
        },
        editing?.id,
      )
      setOpen(false)
      reloadDashboard()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la meta')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      await removeMeta(pendingDelete.id)
      setPendingDelete(null)
      reloadDashboard()
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar la meta')
    }
  }

  return (
    <Page
      title="Metas"
      subtitle="El ahorrado es el inicial más los gastos ligados a la meta"
      actions={
        <Button onClick={openCreate} disabled={loading || !data}>
          Nueva meta
        </Button>
      }
    >
      {loading && !data ? <p className="row__sub">Cargando metas…</p> : null}
      {error ? (
        <article className="card">
          <p className="form-error">{error}</p>
          <Button onClick={() => reloadDashboard()}>Reintentar</Button>
        </article>
      ) : null}
      {data && data.metas.length === 0 ? <p className="row__sub">Todavía no hay metas.</p> : null}
      {data && data.metas.length > 0 ? (
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          {data.metas.map((meta) => {
            const ratio = percent(meta.ahorrado, meta.objetivo)
            return (
              <Card key={meta.id} title={meta.nombre} hint={meta.fechaObjetivo ? `Meta · ${formatDate(meta.fechaObjetivo)}` : 'Sin fecha'}>
                <p className="stat__value" style={{ marginBottom: 12 }}>
                  {money(meta.ahorrado)}
                </p>
                <div className="goal-top">
                  <span className="row__sub">Progreso</span>
                  <span>{ratio}%</span>
                </div>
                <ProgressBar value={ratio} />
                <p className="card__hint" style={{ marginTop: 10 }}>
                  Objetivo {money(meta.objetivo)}
                  {meta.cuenta ? ` · ${meta.cuenta}` : ''}
                </p>
                <div className="account-card__actions">
                  <Button variant="ghost" onClick={() => openEdit(meta)}>
                    Editar
                  </Button>
                  <Button
                    variant="soft"
                    onClick={() => {
                      setDeleteError(null)
                      setPendingDelete(meta)
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : null}
      {data ? (
        <Card title="Aportes recientes">
          {data.aportes.length === 0 ? (
            <p className="row__sub">Un gasto puede sumar a una meta si lo eliges al guardarlo.</p>
          ) : (
            <div className="row-list">
              {data.aportes.map((aporte) => (
                <div className="row" key={aporte.id}>
                  <div className="row__main">
                    <div className="row__title">{aporte.descripcion || 'Sin descripción'}</div>
                    <div className="row__sub">
                      {aporte.meta} · {formatDate(aporte.fecha)}
                    </div>
                  </div>
                  <div className="row__amount is-out">−{money(aporte.monto)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <Modal open={open} title={editing ? 'Editar meta' : 'Nueva meta'} onClose={() => setOpen(false)}>
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="field">
            <label htmlFor="meta-nombre">Nombre</label>
            <input id="meta-nombre" value={nombre} onChange={(event) => setNombre(event.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="meta-objetivo">Objetivo</label>
              <input id="meta-objetivo" inputMode="decimal" value={objetivo} onChange={(event) => setObjetivo(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="meta-ahorrado">Ahorrado inicial</label>
              <input id="meta-ahorrado" inputMode="decimal" value={ahorrado} onChange={(event) => setAhorrado(event.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="meta-fecha">Fecha objetivo</label>
              <input id="meta-fecha" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="meta-cuenta">Cuenta</label>
              <Select
                id="meta-cuenta"
                value={cuentaId}
                onChange={(value) => setCuentaId(value)}
                options={[{ value: '', label: 'Sin cuenta' }, ...(data?.cuentas ?? []).map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre }))]}
              />
            </div>
          </div>
          {editing ? (
            <p className="row__sub" style={{ marginTop: -6, marginBottom: 12 }}>
              La tarjeta muestra el inicial más los movimientos ligados. Aquí editas el punto de partida.
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

      <Modal open={pendingDelete !== null} title="Eliminar meta" onClose={() => setPendingDelete(null)}>
        <p className="row__sub" style={{ marginBottom: 14 }}>
          Si ya tiene aportes, no se puede borrar.
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
