import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useDashboard } from '../../context/dashboard-store'
import { fetchPerfil } from '../../lib/api'
import { useUi } from '../../context/UiContext'
import {
  IconBudget,
  IconChart,
  IconDebt,
  IconFlag,
  IconHome,
  IconList,
  IconMark,
  IconSettings,
  IconTag,
  IconTrend,
  IconWallet,
} from '../../lib/icons'

const links = [
  { to: '/', label: 'Dashboard', icon: <IconHome /> },
  { to: '/transacciones', label: 'Transacciones', icon: <IconList /> },
  { to: '/cuentas', label: 'Cuentas', icon: <IconWallet /> },
  { to: '/presupuestos', label: 'Presupuestos', icon: <IconBudget /> },
  { to: '/metas', label: 'Metas', icon: <IconFlag /> },
  { to: '/deudas', label: 'Deudas', icon: <IconDebt /> },
  { to: '/inversiones', label: 'Inversiones', icon: <IconTrend /> },
  { to: '/reportes', label: 'Reportes', icon: <IconChart /> },
  { to: '/categorias', label: 'Categorías', icon: <IconTag /> },
  { to: '/ajustes', label: 'Ajustes', icon: <IconSettings /> },
]

export function Sidebar() {
  const { sidebarOpen, closeSidebar } = useUi()
  const { revision } = useDashboard()
  const [name, setName] = useState('…')

  useEffect(() => {
    let cancelled = false
    fetchPerfil()
      .then((perfil) => {
        if (!cancelled) setName(perfil.nombre)
      })
      .catch(() => {
        if (!cancelled) setName('Perfil')
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <>
      {sidebarOpen ? <div className="sidebar-backdrop" onClick={closeSidebar} /> : null}
      <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__mark">
            <IconMark />
          </div>
          <div>
            <span className="sidebar__name">Control</span>
            <span className="sidebar__tag">Gastos e ingresos</span>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label="Secciones">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
              onClick={closeSidebar}
            >
              {link.icon}
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__user">
          <div className="avatar">{initials || '·'}</div>
          <div>
            <div className="sidebar__user-name">{name}</div>
            <div className="sidebar__user-role">Uso personal</div>
          </div>
        </div>
      </aside>
    </>
  )
}
