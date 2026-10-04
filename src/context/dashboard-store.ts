import { createContext, useContext } from 'react'
import type { DashboardData, Periodo } from '../lib/api'

export type DashboardContextValue = {
  periodo: Periodo
  setPeriodo: (periodo: Periodo) => void
  data: DashboardData | null
  loading: boolean
  error: string | null
  revision: number
  reload: () => void
}

export const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider')
  }
  return context
}
