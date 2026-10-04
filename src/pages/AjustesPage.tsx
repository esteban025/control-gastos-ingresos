import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Page } from '../components/ui/Page'
import { useDashboard } from '../context/dashboard-store'
import { fetchPerfil, savePerfil, type Perfil } from '../lib/api'
import { Select } from '../components/ui/Select'

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`switch${on ? ' is-on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span />
    </button>
  )
}

export function AjustesPage() {
  const { revision, reload } = useDashboard()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchPerfil()
      .then((payload) => {
        if (!cancelled) {
          setPerfil(payload)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el perfil')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!perfil) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      setPerfil(await savePerfil(perfil))
      setSaved(true)
      reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page title="Ajustes" subtitle="Perfil, moneda y avisos. El periodo del encabezado usa el día de inicio.">
      {loading && !perfil ? <p className="row__sub">Cargando perfil…</p> : null}
      {perfil ? (
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="grid grid-2">
            <Card title="Perfil">
              <div className="field">
                <label htmlFor="name">Nombre</label>
                <input
                  id="name"
                  value={perfil.nombre}
                  onChange={(event) => setPerfil({ ...perfil, nombre: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="email">Correo</label>
                <input
                  id="email"
                  value={perfil.correo}
                  onChange={(event) => setPerfil({ ...perfil, correo: event.target.value })}
                />
              </div>
            </Card>
            <Card title="Preferencias">
              <div className="field">
                <label htmlFor="currency">Moneda</label>
                <Select
                  id="currency"
                  value={perfil.moneda}
                  onChange={(value) => setPerfil({ ...perfil, moneda: value })}
                  options={[
                    ...(['USD', 'COP', 'EUR'].includes(perfil.moneda) ? [] : [perfil.moneda]),
                    'USD',
                    'COP',
                    'EUR',
                  ].map((code) => ({ value: code, label: code }))}
                />
              </div>
              <div className="field">
                <label htmlFor="start">Inicio de mes</label>
                <input
                  id="start"
                  type="number"
                  min={1}
                  max={28}
                  value={perfil.diaInicioMes}
                  onChange={(event) => setPerfil({ ...perfil, diaInicioMes: Number(event.target.value) })}
                />
              </div>
            </Card>
            <Card title="Notificaciones">
              <div className="toggle-row">
                <div>
                  <div className="row__title">Avisos de cuotas</div>
                  <div className="row__sub">Recordatorios de pagos próximos o vencidos</div>
                </div>
                <Toggle on={perfil.avisoCuotas} onClick={() => setPerfil({ ...perfil, avisoCuotas: !perfil.avisoCuotas })} />
              </div>
              <div className="toggle-row">
                <div>
                  <div className="row__title">Presupuesto excedido</div>
                  <div className="row__sub">Cuando un rubro pasa el límite</div>
                </div>
                <Toggle
                  on={perfil.avisoPresupuesto}
                  onClick={() => setPerfil({ ...perfil, avisoPresupuesto: !perfil.avisoPresupuesto })}
                />
              </div>
              <div className="toggle-row">
                <div>
                  <div className="row__title">Resumen semanal</div>
                  <div className="row__sub">Preferencia guardada. El correo no se envía.</div>
                </div>
                <Toggle
                  on={perfil.resumenSemanal}
                  onClick={() => setPerfil({ ...perfil, resumenSemanal: !perfil.resumenSemanal })}
                />
              </div>
            </Card>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {saved ? <p className="row__sub">Cambios guardados.</p> : null}
          <div className="modal__actions">
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      ) : null}
    </Page>
  )
}
