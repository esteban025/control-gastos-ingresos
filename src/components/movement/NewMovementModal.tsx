import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/dashboard-store'
import { useUi } from '../../context/UiContext'
import { createMovimiento, fetchCatalogos, type Catalogos } from '../../lib/api'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function parseAmount(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

function defaultSelection(data: Catalogos) {
  const tipo = data.tipos.find((item) => item.codigo === 'gasto') ?? data.tipos[0]
  const nextTipoId = tipo?.id ?? 0
  const categorias = data.categorias.filter((item) => item.tipoId === nextTipoId)
  return {
    tipoId: nextTipoId,
    categoriaId: categorias[0]?.id ?? 0,
    cuentaId: data.cuentas[0]?.id ?? 0,
  }
}

export function NewMovementModal() {
  const { modalOpen, closeModal } = useUi()
  const { reload } = useDashboard()
  const [catalog, setCatalog] = useState<Catalogos | null>(null)
  const [tipoId, setTipoId] = useState(0)
  const [categoriaId, setCategoriaId] = useState(0)
  const [cuentaId, setCuentaId] = useState(0)
  const [modoId, setModoId] = useState('')
  const [metaId, setMetaId] = useState('')
  const [deudaId, setDeudaId] = useState('')
  const [fecha, setFecha] = useState(todayIso)
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)

  if (modalOpen !== wasOpen) {
    setWasOpen(modalOpen)
    if (modalOpen) {
      setError(null)
      setMonto('')
      setDescripcion('')
      setFecha(todayIso())
      setModoId('')
      setMetaId('')
      setDeudaId('')
      if (catalog) {
        const defaults = defaultSelection(catalog)
        setTipoId(defaults.tipoId)
        setCategoriaId(defaults.categoriaId)
        setCuentaId(defaults.cuentaId)
      }
    }
  }

  useEffect(() => {
    if (!modalOpen || catalog) return
    let cancelled = false

    async function prepare() {
      try {
        const data = await fetchCatalogos()
        if (cancelled) return
        setCatalog(data)
        const defaults = defaultSelection(data)
        setTipoId(defaults.tipoId)
        setCategoriaId(defaults.categoriaId)
        setCuentaId(defaults.cuentaId)
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los catálogos')
        }
      }
    }

    void prepare()
    return () => {
      cancelled = true
    }
  }, [modalOpen, catalog])

  const categorias = catalog?.categorias.filter((item) => item.tipoId === tipoId) ?? []
  const esGasto = catalog?.tipos.find((item) => item.id === tipoId)?.codigo === 'gasto'

  function onTipoChange(nextTipoId: number) {
    setTipoId(nextTipoId)
    const next = catalog?.categorias.filter((item) => item.tipoId === nextTipoId) ?? []
    setCategoriaId(next[0]?.id ?? 0)
    setMetaId('')
    setDeudaId('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = parseAmount(monto)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('El monto debe ser mayor que cero')
      return
    }
    if (!tipoId || !categoriaId || !cuentaId) {
      setError('Elige tipo, categoría y cuenta')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createMovimiento({
        tipoId,
        categoriaId,
        cuentaId,
        modoId: modoId ? Number(modoId) : null,
        metaId: esGasto && metaId ? Number(metaId) : null,
        deudaId: esGasto && deudaId ? Number(deudaId) : null,
        fecha,
        monto: amount,
        descripcion,
      })
      reload()
      closeModal()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el movimiento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={modalOpen} title="Nuevo movimiento" onClose={closeModal}>
      <form onSubmit={(event) => void onSubmit(event)}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="type">Tipo</label>
            <Select
              id="type"
              value={tipoId || ''}
              onChange={(value) => onTipoChange(Number(value))}
              options={(catalog?.tipos ?? []).map((tipo) => ({ value: tipo.id, label: tipo.nombre }))}
            />
          </div>
          <div className="field">
            <label htmlFor="amount">Monto</label>
            <input id="amount" type="text" inputMode="decimal" placeholder="0.00" value={monto} onChange={(event) => setMonto(event.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="category">Categoría</label>
            <Select
              id="category"
              value={categoriaId || ''}
              onChange={(value) => setCategoriaId(Number(value))}
              options={categorias.map((categoria) => ({ value: categoria.id, label: categoria.nombre }))}
            />
          </div>
          <div className="field">
            <label htmlFor="account">Cuenta</label>
            <Select
              id="account"
              value={cuentaId || ''}
              onChange={(value) => setCuentaId(Number(value))}
              options={(catalog?.cuentas ?? []).map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre }))}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="mode">Modo</label>
            <Select
              id="mode"
              value={modoId}
              onChange={(value) => setModoId(value)}
              options={[{ value: '', label: 'Sin especificar' }, ...(catalog?.modos ?? []).map((modo) => ({ value: modo.id, label: modo.nombre }))]}
            />
          </div>
          <div className="field">
            <label htmlFor="date">Fecha</label>
            <input id="date" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
          </div>
        </div>
        {esGasto ? (
          <div className="field-row">
            <div className="field">
              <label htmlFor="goal">Meta</label>
              <Select
                id="goal"
                value={metaId}
                onChange={(value) => setMetaId(value)}
                options={[{ value: '', label: 'Sin meta' }, ...(catalog?.metas ?? []).map((meta) => ({ value: meta.id, label: meta.nombre }))]}
              />
            </div>
            <div className="field">
              <label htmlFor="debt">Deuda</label>
              <Select
                id="debt"
                value={deudaId}
                onChange={(value) => setDeudaId(value)}
                options={[{ value: '', label: 'Sin deuda' }, ...(catalog?.deudas ?? []).map((deuda) => ({ value: deuda.id, label: deuda.nombre }))]}
              />
            </div>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="note">Nota</label>
          <textarea id="note" placeholder="Descripción opcional" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal__actions">
          <Button variant="ghost" type="button" onClick={closeModal}>
            Cerrar
          </Button>
          <Button type="submit" disabled={saving || !catalog}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
