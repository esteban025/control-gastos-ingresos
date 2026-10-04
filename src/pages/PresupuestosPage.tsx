import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Page } from '../components/ui/Page'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useDashboard } from '../context/dashboard-store'
import {
  fetchPresupuestos,
  removePresupuesto,
  savePresupuesto,
  type Presupuesto,
  type PresupuestosData,
} from '../lib/api'
import { formatMoney, percent } from '../lib/format'
import { Select } from '../components/ui/Select'

function parseAmount(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

export function PresupuestosPage() {
  const { periodo, revision, reload: reloadDashboard } = useDashboard()
  const [data, setData] = useState<PresupuestosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Presupuesto | null>(null)
  const [open, setOpen] = useState(false)
  const [categoriaId, setCategoriaId] = useState(0)
  const [tope, setTope] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Presupuesto | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPresupuestos(periodo)
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los presupuestos')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [periodo, revision])

  const money = (value: number) => formatMoney(value, data?.moneda ?? 'USD')

  function openCreate() {
    setEditing(null)
    setCategoriaId(data?.categorias[0]?.id ?? 0)
    setTope('')
    setFormError(null)
    setOpen(true)
  }

  function openEdit(item: Presupuesto) {
    setEditing(item)
    setCategoriaId(item.categoriaId)
    setTope(String(item.tope))
    setFormError(null)
    setOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = parseAmount(tope)
    if (!categoriaId) {
      setFormError('Elige una categoría')
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError('El tope no es válido')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await savePresupuesto({ categoriaId, tope: amount }, periodo, editing?.id)
      setOpen(false)
      reloadDashboard()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el presupuesto')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!pendingDelete) return
    try {
      await removePresupuesto(pendingDelete.id)
      setPendingDelete(null)
      reloadDashboard()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el presupuesto')
    }
  }

  return (
    <Page
      title="Presupuestos"
      subtitle={data ? `Límites de ${data.etiqueta}. Lo gastado sale de los movimientos.` : 'Límites mensuales por categoría'}
      actions={
        <Button onClick={openCreate} disabled={loading || !data}>
          Nuevo presupuesto
        </Button>
      }
    >
      {loading && !data ? <p className="row__sub">Cargando presupuestos…</p> : null}
      {error ? (
        <article className="card">
          <p className="form-error">{error}</p>
          <Button onClick={() => reloadDashboard()}>Reintentar</Button>
        </article>
      ) : null}
      {data && data.presupuestos.length === 0 ? <p className="row__sub">No hay presupuestos en este mes.</p> : null}
      {data && data.presupuestos.length > 0 ? (
        <div className="grid grid-2">
          {data.presupuestos.map((item) => {
            const ratio = percent(item.gastado, item.tope)
            return (
              <Card
                key={item.id}
                title={item.categoria}
                action={<Badge tone={item.excedido ? 'warn' : 'accent'}>{item.excedido ? 'Excedido' : 'En curso'}</Badge>}
              >
                <div className="goal-top">
                  <span className="row__sub">Gastado</span>
                  <span>
                    {money(item.gastado)} / {money(item.tope)}
                  </span>
                </div>
                <ProgressBar value={ratio} />
                <p className="card__hint" style={{ marginTop: 10 }}>
                  {item.excedido ? 'Este rubro ya pasó el tope del mes.' : `Quedan ${money(Math.max(item.tope - item.gastado, 0))}.`}
                </p>
                <div className="account-card__actions">
                  <Button variant="ghost" onClick={() => openEdit(item)}>
                    Editar
                  </Button>
                  <Button variant="soft" onClick={() => setPendingDelete(item)}>
                    Eliminar
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : null}

      <Modal open={open} title={editing ? 'Editar presupuesto' : 'Nuevo presupuesto'} onClose={() => setOpen(false)}>
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="field">
            <label htmlFor="presupuesto-categoria">Categoría de gasto</label>
            <Select
              id="presupuesto-categoria"
              value={categoriaId || ''}
              onChange={(value) => setCategoriaId(Number(value))}
              options={(data?.categorias ?? []).map((categoria) => ({ value: categoria.id, label: categoria.nombre }))}
            />
          </div>
          <div className="field">
            <label htmlFor="presupuesto-tope">Tope</label>
            <input id="presupuesto-tope" inputMode="decimal" value={tope} onChange={(event) => setTope(event.target.value)} />
          </div>
          <p className="row__sub" style={{ marginTop: -6, marginBottom: 12 }}>
            El tope queda en {data?.etiqueta}. El gastado no se edita: se suma de los gastos de esa categoría.
          </p>
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

      <Modal open={pendingDelete !== null} title="Eliminar presupuesto" onClose={() => setPendingDelete(null)}>
        <p className="row__sub" style={{ marginBottom: 14 }}>
          Se quita el tope de {pendingDelete?.categoria}. Los movimientos se quedan.
        </p>
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
