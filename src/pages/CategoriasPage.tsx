import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Page } from '../components/ui/Page'
import { useDashboard } from '../context/dashboard-store'
import { fetchCategorias, removeCategoria, saveCategoria, type Categoria, type CategoriasData } from '../lib/api'
import { formatMoney } from '../lib/format'
import { Select } from '../components/ui/Select'

export function CategoriasPage() {
  const { periodo, revision, reload: reloadDashboard } = useDashboard()
  const [data, setData] = useState<CategoriasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Categoria | null>(null)
  const [nombre, setNombre] = useState('')
  const [tipoId, setTipoId] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Categoria | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCategorias(periodo)
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las categorías')
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
  const list = tab === 0 ? (data?.categorias ?? []) : (data?.categorias ?? []).filter((item) => item.tipoId === tab)

  function openCreate() {
    setEditing(null)
    setNombre('')
    setTipoId(data?.tipos[0]?.id ?? 0)
    setFormError(null)
    setOpen(true)
  }

  function openEdit(item: Categoria) {
    setEditing(item)
    setNombre(item.nombre)
    setTipoId(item.tipoId)
    setFormError(null)
    setOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!nombre.trim() || !tipoId) {
      setFormError('Nombre y tipo son obligatorios')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await saveCategoria({ nombre: nombre.trim(), tipoId }, editing?.id)
      setOpen(false)
      reloadDashboard()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la categoría')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      await removeCategoria(pendingDelete.id)
      setPendingDelete(null)
      reloadDashboard()
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar la categoría')
    }
  }

  return (
    <Page
      title="Categorías"
      subtitle={data ? `Totales de ${data.etiqueta}` : 'Clasificación de ingresos y gastos'}
      actions={
        <Button onClick={openCreate} disabled={loading || !data}>
          Nueva categoría
        </Button>
      }
    >
      {loading && !data ? <p className="row__sub">Cargando categorías…</p> : null}
      {error ? (
        <article className="card">
          <p className="form-error">{error}</p>
          <Button onClick={() => reloadDashboard()}>Reintentar</Button>
        </article>
      ) : null}
      {data ? (
        <>
          <div className="chips" style={{ marginBottom: 16 }}>
            <button type="button" className={`chip${tab === 0 ? ' is-on' : ''}`} onClick={() => setTab(0)}>
              Todas
            </button>
            {data.tipos.map((tipo) => (
              <button key={tipo.id} type="button" className={`chip${tab === tipo.id ? ' is-on' : ''}`} onClick={() => setTab(tipo.id)}>
                {tipo.nombre}
              </button>
            ))}
          </div>
          {list.length === 0 ? <p className="row__sub">No hay categorías en este grupo.</p> : null}
          <div className="cat-grid">
            {list.map((item) => (
              <div className="cat-item" key={item.id}>
                <Badge tone={item.tipoCodigo === 'ingreso' ? 'accent' : 'muted'}>{item.tipo}</Badge>
                <strong>{item.nombre}</strong>
                <p className="row__sub">{money(item.total)} en el periodo</p>
                <div className="account-card__actions">
                  <Button variant="ghost" onClick={() => openEdit(item)}>
                    Editar
                  </Button>
                  <Button
                    variant="soft"
                    onClick={() => {
                      setDeleteError(null)
                      setPendingDelete(item)
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <Modal open={open} title={editing ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setOpen(false)}>
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="field">
            <label htmlFor="cat-nombre">Nombre</label>
            <input id="cat-nombre" value={nombre} onChange={(event) => setNombre(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cat-tipo">Tipo</label>
            <Select
              id="cat-tipo"
              value={tipoId || ''}
              onChange={(value) => setTipoId(Number(value))}
              options={(data?.tipos ?? []).map((tipo) => ({ value: tipo.id, label: tipo.nombre }))}
            />
          </div>
          <p className="row__sub" style={{ marginTop: -6, marginBottom: 12 }}>
            El total del periodo se calcula con los movimientos. No se edita aquí.
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

      <Modal open={pendingDelete !== null} title="Eliminar categoría" onClose={() => setPendingDelete(null)}>
        <p className="row__sub" style={{ marginBottom: 14 }}>
          Si ya tiene movimientos o presupuestos, no se puede borrar.
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
