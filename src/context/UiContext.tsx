import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type UiContextValue = {
  modalOpen: boolean
  openModal: () => void
  closeModal: () => void
  sidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
}

const UiContext = createContext<UiContextValue | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const value = useMemo<UiContextValue>(
    () => ({
      modalOpen,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      sidebarOpen,
      toggleSidebar: () => setSidebarOpen((open) => !open),
      closeSidebar: () => setSidebarOpen(false),
    }),
    [modalOpen, sidebarOpen],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) {
    throw new Error('useUi must be used within UiProvider')
  }
  return ctx
}
