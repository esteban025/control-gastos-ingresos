import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchDashboard, type DashboardData, type Periodo } from '../lib/api'
import { DashboardContext } from './dashboard-store'

type Snapshot = {
  key: string
  data: DashboardData | null
  loading: boolean
  error: string | null
}

function loadError(error: unknown): string {
  if (error instanceof TypeError) {
    return 'No hay conexión con el servidor. Revisa que la API y MySQL estén encendidos.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'No se pudo cargar el dashboard'
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [reloadToken, setReloadToken] = useState(0)
  const key = `${periodo}:${reloadToken}`
  const [snapshot, setSnapshot] = useState<Snapshot>({
    key,
    data: null,
    loading: true,
    error: null,
  })

  if (snapshot.key !== key) {
    setSnapshot({ key, data: null, loading: true, error: null })
  }

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchDashboard(periodo)
      .then((payload) => {
        if (cancelled) return
        setSnapshot((current) =>
          current.key === key ? { key, data: payload, loading: false, error: null } : current,
        )
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setSnapshot((current) =>
          current.key === key ? { key, data: null, loading: false, error: loadError(reason) } : current,
        )
      })

    return () => {
      cancelled = true
    }
  }, [periodo, reloadToken, key])

  const value = useMemo(
    () => ({
      periodo,
      setPeriodo,
      data: snapshot.data,
      loading: snapshot.loading,
      error: snapshot.error,
      revision: reloadToken,
      reload,
    }),
    [periodo, snapshot, reloadToken, reload],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
