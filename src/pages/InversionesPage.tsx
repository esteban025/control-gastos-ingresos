import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Page } from '../components/ui/Page'
import { useDashboard } from '../context/dashboard-store'
import { fetchInversiones, removeInversion, saveInversion, type Inversion, type InversionesData } from '../lib/api'
import { formatDate, formatMoney } from '../lib/format'
import { Select } from '../components/ui/Select'

function parseAmount(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

export function InversionesPage() {
  const { revision, reload: reloadDashboard } = useDashboard()
  const [data, setData] = useState<InversionesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Inversion | null>(null)
  const [nombre, setNombre] = useState('')
  const [tipoId, setTipoId] = useState(0)
  const [valor, setValor] = useState('')
  const [variacion, setVariacion] = useState('0')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Inversion | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchInversiones()
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las inversiones')
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
  const total = data?.inversiones.reduce((sum, item) => sum + item.valor, 0) ?? 0

  function openCreate() {
    setEditing(null)
    setNombre('')
    setTipoId(data?.tipos[0]?.id ?? 0)
    setValor('')
    setVariacion('0')
    setFormError(null)
    setOpen(true)
  }

  function openEdit(item: Inversion) {
    setEditing(item)
    setNombre(item.nombre)
    setTipoId(item.tipoInversionId)
    setValor(String(item.valor))
    setVariacion(String(item.variacion))
    setFormError(null)
    setOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const valorNum = parseAmount(valor)
    const variacionNum = parseAmount(variacion)
    if (!nombre.trim() || !tipoId) {
      setFormError('Nombre y tipo son obligatorios')
      return
    }
    if (!Number.isFinite(valorNum) || valorNum < 0 || !Number.isFinite(variacionNum)) {
      setFormError('El valor o la variación no son válidos')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await saveInversion(
        { nombre: nombre.trim(), tipoInversionId: tipoId, valorActual: valorNum, variacionPct: variacionNum },
        editing?.id,
      )
      setOpen(false)
      reloadDashboard()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la inversión')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!pendingDelete) return
    try {
      await removeInversion(pendingDelete.id)
      setPendingDelete(null)
      reloadDashboard()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo eliminar la inversión')
    }
  }

  return (
    <Page
      title="Inversiones"
      subtitle="El valor lo cargas tú. No hay precio de mercado."
      actions={
        <Button onClick={openCreate} disabled={loading || !data}>
          Nueva inversión
        </Button>
      }
    >
      {loading && !data ? <p className="row__sub">Cargando inversiones…</p> : null}
      {error ? (
        <article className="card">
          <p className="form-error">{error}</p>
          <Button onClick={() => reloadDashboard()}>Reintentar</Button>
        </article>
      ) : null}
      {data ? (
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <article className="card stat">
            <p className="stat__label">Valor del portafolio</p>
            <p className="stat__value">{money(total)}</p>
          </article>
        </div>
      ) : null}
      {data && data.inversiones.length === 0 ? <p className="row__sub">Todavía no hay inversiones.</p> : null}
      {data && data.inversiones.length > 0 ? (
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          {data.inversiones.map((item) => (
            <Card key={item.id} title={item.nombre} hint={item.tipo}>
              <p className="stat__value">{money(item.valor)}</p>
              <p className={`stat__meta ${item.variacion >= 0 ? 'is-up' : ''}`}>
                {item.variacion >= 0 ? '+' : ''}
                {item.variacion}% cargado
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
          ))}
        </div>
      ) : null}
      {data ? (
        <Card title="Historial de valores">
          {data.historico.length === 0 ? (
            <p className="row__sub">Cada vez que guardas un valor queda una foto del día.</p>
          ) : (
            <div className="row-list">
              {data.historico.map((item) => (
                <div className="row" key={item.id}>
                  <div className="row__main">
                    <div className="row__title">{item.nombre}</div>
                    <div className="row__sub">{formatDate(item.fecha)}</div>
                  </div>
                  <div className="row__amount">{money(item.valor)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <Modal open={open} title={editing ? 'Editar inversión' : 'Nueva inversión'} onClose={() => setOpen(false)}>
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="field">
            <label htmlFor="inv-nombre">Nombre</label>
            <input id="inv-nombre" value={nombre} onChange={(event) => setNombre(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="inv-tipo">Tipo</label>
            <Select
              id="inv-tipo"
              value={tipoId || ''}
              onChange={(value) => setTipoId(Number(value))}
              options={(data?.tipos ?? []).map((tipo) => ({ value: tipo.id, label: tipo.nombre }))}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="inv-valor">Valor actual</label>
              <input id="inv-valor" inputMode="decimal" value={valor} onChange={(event) => setValor(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="inv-variacion">Variación %</label>
              <input id="inv-variacion" inputMode="decimal" value={variacion} onChange={(event) => setVariacion(event.target.value)} />
            </div>
          </div>
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

      <Modal open={pendingDelete !== null} title="Eliminar inversión" onClose={() => setPendingDelete(null)}>
        <p className="row__sub" style={{ marginBottom: 14 }}>
          Se borra {pendingDelete?.nombre} y su historial de valores.
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
