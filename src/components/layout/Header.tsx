import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchBusqueda, type Busqueda, type Periodo } from '../../lib/api'
import { useDashboard } from '../../context/dashboard-store'
import { useUi } from '../../context/UiContext'
import { IconBell, IconMenu, IconPlus, IconSearch } from '../../lib/icons'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'

export function Header() {
  const { openModal, toggleSidebar } = useUi()
  const { periodo, setPeriodo, data } = useDashboard()
  const [openNotes, setOpenNotes] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Busqueda | null>(null)
  const navigate = useNavigate()
  const avisos = data?.avisos ?? []

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) return
    const timer = window.setTimeout(() => {
      fetchBusqueda(term)
        .then((payload) => setResults(payload))
        .catch(() => setResults(null))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  function goSearch() {
    const term = query.trim()
    if (!term) return
    setResults(null)
    navigate(`/transacciones?q=${encodeURIComponent(term)}`)
  }

  const visible =
    query.trim().length >= 2 &&
    results &&
    (results.movimientos.length > 0 || results.categorias.length > 0 || results.cuentas.length > 0)
      ? results
      : null

  return (
    <header className="header">
      <button className="header__menu" type="button" onClick={toggleSidebar} aria-label="Abrir menú">
        <IconMenu />
      </button>
      <label className="header__search">
        <IconSearch />
        <input
          type="search"
          placeholder="Buscar movimientos, categorías..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') goSearch()
          }}
        />
        {visible ? (
          <div className="search-panel">
            {visible.movimientos.map((item) => (
              <button key={`m-${item.id}`} type="button" onClick={goSearch}>
                <strong className="row__title">{item.descripcion}</strong>
                <div className="row__sub">
                  {item.categoria ?? 'Movimiento'} · {item.cuenta}
                </div>
              </button>
            ))}
            {visible.categorias.map((item) => (
              <button
                key={`c-${item.id}`}
                type="button"
                onClick={() => {
                  setResults(null)
                  navigate('/categorias')
                }}
              >
                <strong className="row__title">{item.nombre}</strong>
                <div className="row__sub">Categoría · {item.tipo}</div>
              </button>
            ))}
            {visible.cuentas.map((item) => (
              <button
                key={`a-${item.id}`}
                type="button"
                onClick={() => {
                  setResults(null)
                  navigate('/cuentas')
                }}
              >
                <strong className="row__title">{item.nombre}</strong>
                <div className="row__sub">Cuenta</div>
              </button>
            ))}
          </div>
        ) : null}
      </label>
      <div className="header__actions">
        <Select
          className="select--compact"
          value={periodo}
          onChange={(value) => setPeriodo(value as Periodo)}
          aria-label="Periodo"
          options={[{ value: 'mes', label: 'Este mes' }, { value: 'anterior', label: 'Mes anterior' }, { value: 'anio', label: 'Este año' }]}
        />
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" type="button" aria-label="Avisos" onClick={() => setOpenNotes((open) => !open)}>
            <IconBell />
            {avisos.length > 0 ? <span className="dot" /> : null}
          </button>
          {openNotes ? (
            <div className="notify">
              {avisos.length === 0 ? (
                <div className="item">
                  <div className="row__sub">No hay avisos</div>
                </div>
              ) : (
                avisos.map((aviso) => (
                  <button key={aviso.id} className="item" type="button" onClick={() => setOpenNotes(false)}>
                    <strong className="row__title">{aviso.title}</strong>
                    <div className="row__sub">{aviso.text}</div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <Button onClick={openModal}>
          <IconPlus />
          Nuevo
        </Button>
      </div>
    </header>
  )
}
