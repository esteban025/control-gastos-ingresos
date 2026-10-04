import type { ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="shell-main">
        <Header />
        {children}
      </div>
    </div>
  )
}
