import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Page } from '../components/ui/Page'
import { useDashboard } from '../context/dashboard-store'
import { useUi } from '../context/UiContext'
import {
  fetchCatalogos,
  fetchTransacciones,
  removeMovimiento,
  saveMovimiento,
  type Catalogos,
  type TransaccionesData,
} from '../lib/api'
import { formatDate, formatMoney } from '../lib/format'
import { IconPlus } from '../lib/icons'
import { Select } from '../components/ui/Select'

const filters = ['todos', 'ingreso', 'gasto'] as const

function parseAmount(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

export function TransaccionesPage() {
  const { openModal } = useUi()
  const { periodo, revision, reload: reloadDashboard } = useDashboard()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [filter, setFilter] = useState<(typeof filters)[number]>('todos')
  const [cuentaId, setCuentaId] = useState(0)
  const [categoriaId, setCategoriaId] = useState(0)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<TransaccionesData | null>(null)
  const [catalog, setCatalog] = useState<Catalogos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    tipoId: 0,
    categoriaId: 0,
    cuentaId: 0,
    modoId: '',
    metaId: '',
    deudaId: '',
    fecha: '',
    monto: '',
    descripcion: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const pageSize = 8

  useEffect(() => {
    let cancelled = false
    fetchTransacciones(periodo, query)
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las transacciones')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [periodo, revision, query])

  useEffect(() => {
    let cancelled = false
    fetchCatalogos()
      .then((payload) => {
        if (!cancelled) setCatalog(payload)
      })
      .catch(() => {
        if (!cancelled) setCatalog(null)
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  const rows = useMemo(() => {
    const list = data?.movimientos ?? []
    return list.filter((row) => {
      if (filter === 'ingreso' && row.efecto !== 'suma') return false
      if (filter === 'gasto' && row.efecto !== 'resta') return false
      if (cuentaId && row.cuentaId !== cuentaId) return false
      if (categoriaId && row.categoriaId !== categoriaId) return false
      return true
    })
  }, [data, filter, cuentaId, categoriaId])

  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize)
  const money = (value: number) => formatMoney(value, data?.moneda ?? 'USD')
  const editingTipo = catalog?.tipos.find((tipo) => tipo.id === form.tipoId)
  const categoriasTipo = catalog?.categorias.filter((item) => item.tipoId === form.tipoId) ?? []
  const esGasto = editingTipo?.codigo === 'gasto'

  function openEdit(id: number) {
    const row = data?.movimientos.find((item) => item.id === id)
    if (!row) return
    setEditingId(id)
    setForm({
      tipoId: row.tipoId,
      categoriaId: row.categoriaId ?? 0,
      cuentaId: row.cuentaId,
      modoId: row.modoId ? String(row.modoId) : '',
      metaId: row.metaId ? String(row.metaId) : '',
      deudaId: row.deudaId ? String(row.deudaId) : '',
      fecha: row.fecha,
      monto: String(row.monto),
      descripcion: row.descripcion,
    })
    setFormError(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    const monto = parseAmount(form.monto)
    if (!Number.isFinite(monto) || monto <= 0) {
      setFormError('El monto debe ser mayor que cero')
      return
    }
    if (!form.tipoId || !form.categoriaId || !form.cuentaId) {
      setFormError('Elige tipo, categoría y cuenta')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await saveMovimiento(
        {
          tipoId: form.tipoId,
          categoriaId: form.categoriaId,
          cuentaId: form.cuentaId,
          modoId: form.modoId ? Number(form.modoId) : null,
          metaId: esGasto && form.metaId ? Number(form.metaId) : null,
          deudaId: esGasto && form.deudaId ? Number(form.deudaId) : null,
          fecha: form.fecha,
          monto,
          descripcion: form.descripcion.trim(),
        },
        editingId,
      )
      setEditingId(null)
      reloadDashboard()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el movimiento')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      await removeMovimiento(pendingDelete)
      setPendingDelete(null)
      reloadDashboard()
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar el movimiento')
    }
  }

  return (
    <Page
      title="Transacciones"
      subtitle={data ? data.etiqueta : 'Historial de ingresos y gastos'}
      actions={
        <Button onClick={openModal}>
          <IconPlus />
          Nuevo movimiento
        </Button>
      }
    >
      {loading && !data ? <p className="row__sub">Cargando transacciones…</p> : null}
      {error ? (
        <article className="card">
          <p className="form-error">{error}</p>
          <Button onClick={() => reloadDashboard()}>Reintentar</Button>
        </article>
      ) : null}
      {data ? (
        <Card>
          <div className="chips" style={{ marginBottom: 16 }}>
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className={`chip${filter === item ? ' is-on' : ''}`}
                onClick={() => {
                  setFilter(item)
                  setPage(0)
                }}
              >
                {item === 'todos' ? 'Todos' : item === 'ingreso' ? 'Ingresos' : 'Gastos'}
              </button>
            ))}
          </div>
          <div className="field-row" style={{ marginBottom: 16 }}>
            <div className="field">
              <label htmlFor="filtro-cuenta">Cuenta</label>
              <Select
                id="filtro-cuenta"
                value={cuentaId || ''}
                onChange={(value) => {
                  setCuentaId(Number(value))
                  setPage(0)
                }}
                options={[{ value: '', label: 'Todas' }, ...(catalog?.cuentas ?? []).map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre }))]}
              />
            </div>
            <div className="field">
              <label htmlFor="filtro-categoria">Categoría</label>
              <Select
                id="filtro-categoria"
                value={categoriaId || ''}
                onChange={(value) => {
                  setCategoriaId(Number(value))
                  setPage(0)
                }}
                options={[{ value: '', label: 'Todas' }, ...(catalog?.categorias ?? []).map((categoria) => ({ value: categoria.id, label: categoria.nombre }))]}
              />
            </div>
          </div>
          {query ? (
            <p className="row__sub" style={{ marginBottom: 12 }}>
              Búsqueda en todo el historial.{' '}
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setParams({})
                  setPage(0)
                }}
              >
                Quitar filtro
              </button>
            </p>
          ) : null}
          {slice.length === 0 ? (
            <p className="row__sub">No hay movimientos en este recorte.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Cuenta</th>
                    <th>Monto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {slice.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.fecha)}</td>
                      <td>{row.descripcion || 'Sin descripción'}</td>
                      <td>{row.categoria ?? row.tipo}</td>
                      <td>{row.cuenta}</td>
                      <td className={`row__amount ${row.efecto === 'suma' ? 'is-in' : 'is-out'}`}>
                        {row.efecto === 'traslado' ? '' : row.efecto === 'suma' ? '+' : '−'}
                        {money(row.monto)}
                      </td>
                      <td>
                        <Button variant="ghost" onClick={() => openEdit(row.id)}>
                          Editar
                        </Button>
                        <Button
                          variant="soft"
                          onClick={() => {
                            setDeleteError(null)
                            setPendingDelete(row.id)
                          }}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pager">
            <Button variant="ghost" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
              Anterior
            </Button>
            <Button variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((current) => current + 1)}>
              Siguiente
            </Button>
          </div>
        </Card>
      ) : null}

      <Modal open={editingId !== null} title="Editar movimiento" onClose={() => setEditingId(null)}>
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="edit-tipo">Tipo</label>
              <Select
                id="edit-tipo"
                value={form.tipoId || ''}
                onChange={(value) => {
                  const tipoId = Number(value)
                  const next = catalog?.categorias.filter((item) => item.tipoId === tipoId) ?? []
                  setForm((current) => ({ ...current, tipoId, categoriaId: next[0]?.id ?? 0, metaId: '', deudaId: '' }))
                }}
                options={(catalog?.tipos ?? []).map((tipo) => ({ value: tipo.id, label: tipo.nombre }))}
              />
            </div>
            <div className="field">
              <label htmlFor="edit-monto">Monto</label>
              <input id="edit-monto" value={form.monto} onChange={(event) => setForm((current) => ({ ...current, monto: event.target.value }))} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="edit-categoria">Categoría</label>
              <Select
                id="edit-categoria"
                value={form.categoriaId || ''}
                onChange={(value) => setForm((current) => ({ ...current, categoriaId: Number(value) }))}
                options={categoriasTipo.map((categoria) => ({ value: categoria.id, label: categoria.nombre }))}
              />
            </div>
            <div className="field">
              <label htmlFor="edit-cuenta">Cuenta</label>
              <Select
                id="edit-cuenta"
                value={form.cuentaId || ''}
                onChange={(value) => setForm((current) => ({ ...current, cuentaId: Number(value) }))}
                options={(catalog?.cuentas ?? []).map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre }))}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="edit-modo">Modo</label>
              <Select
                id="edit-modo"
                value={form.modoId}
                onChange={(value) => setForm((current) => ({ ...current, modoId: value }))}
                options={[{ value: '', label: 'Sin especificar' }, ...(catalog?.modos ?? []).map((modo) => ({ value: modo.id, label: modo.nombre }))]}
              />
            </div>
            <div className="field">
              <label htmlFor="edit-fecha">Fecha</label>
              <input id="edit-fecha" type="date" value={form.fecha} onChange={(event) => setForm((current) => ({ ...current, fecha: event.target.value }))} />
            </div>
          </div>
          {esGasto ? (
            <div className="field-row">
              <div className="field">
                <label htmlFor="edit-meta">Meta</label>
                <Select
                  id="edit-meta"
                  value={form.metaId}
                  onChange={(value) => setForm((current) => ({ ...current, metaId: value }))}
                  options={[{ value: '', label: 'Sin meta' }, ...(catalog?.metas ?? []).map((meta) => ({ value: meta.id, label: meta.nombre }))]}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-deuda">Deuda</label>
                <Select
                  id="edit-deuda"
                  value={form.deudaId}
                  onChange={(value) => setForm((current) => ({ ...current, deudaId: value }))}
                  options={[{ value: '', label: 'Sin deuda' }, ...(catalog?.deudas ?? []).map((deuda) => ({ value: deuda.id, label: deuda.nombre }))]}
                />
              </div>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="edit-nota">Nota</label>
            <textarea id="edit-nota" value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} />
          </div>
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="modal__actions">
            <Button variant="ghost" type="button" onClick={() => setEditingId(null)}>
              Cerrar
            </Button>
            <Button type="submit" disabled={saving || !catalog}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={pendingDelete !== null} title="Eliminar movimiento" onClose={() => setPendingDelete(null)}>
        <p className="row__sub" style={{ marginBottom: 14 }}>
          Se quita del historial y las cuentas, presupuestos, metas y deudas vuelven a calcularse sin este monto.
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
