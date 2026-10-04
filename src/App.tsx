import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { NewMovementModal } from './components/movement/NewMovementModal'
import { DashboardProvider } from './context/DashboardContext'
import { UiProvider } from './context/UiContext'
import { AjustesPage } from './pages/AjustesPage'
import { CategoriasPage } from './pages/CategoriasPage'
import { CuentasPage } from './pages/CuentasPage'
import { DashboardPage } from './pages/DashboardPage'
import { DeudasPage } from './pages/DeudasPage'
import { InversionesPage } from './pages/InversionesPage'
import { MetasPage } from './pages/MetasPage'
import { PresupuestosPage } from './pages/PresupuestosPage'
import { ReportesPage } from './pages/ReportesPage'
import { TransaccionesPage } from './pages/TransaccionesPage'

export default function App() {
  return (
    <BrowserRouter>
      <UiProvider>
        <DashboardProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/transacciones" element={<TransaccionesPage />} />
              <Route path="/cuentas" element={<CuentasPage />} />
              <Route path="/presupuestos" element={<PresupuestosPage />} />
              <Route path="/metas" element={<MetasPage />} />
              <Route path="/deudas" element={<DeudasPage />} />
              <Route path="/inversiones" element={<InversionesPage />} />
              <Route path="/reportes" element={<ReportesPage />} />
              <Route path="/categorias" element={<CategoriasPage />} />
              <Route path="/ajustes" element={<AjustesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
          <NewMovementModal />
        </DashboardProvider>
      </UiProvider>
    </BrowserRouter>
  )
}
