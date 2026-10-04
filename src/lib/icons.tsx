import type { ReactNode } from 'react'

type IconProps = { size?: number }

function Svg({ size = 18, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export function IconHome() {
  return <Svg><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></Svg>
}

export function IconList() {
  return <Svg><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>
}

export function IconWallet() {
  return <Svg><path d="M3 8h18v11H3z" /><path d="M3 8V6.5A1.5 1.5 0 0 1 4.5 5H16" /><path d="M16 13h3" /></Svg>
}

export function IconBudget() {
  return <Svg><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15v4" /><path d="M12 11v8" /><path d="M16 8v11" /></Svg>
}

export function IconFlag() {
  return <Svg><path d="M5 21V4" /><path d="M5 4h10l-1.5 3.5L15 11H5" /></Svg>
}

export function IconDebt() {
  return <Svg><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></Svg>
}

export function IconTrend() {
  return <Svg><path d="M3 17 9 11l4 4 8-8" /><path d="M14 7h7v7" /></Svg>
}

export function IconChart() {
  return <Svg><path d="M4 19V5" /><path d="M4 19h16" /><circle cx="9" cy="12" r="1.4" /><circle cx="13" cy="8" r="1.4" /><circle cx="17" cy="13" r="1.4" /></Svg>
}

export function IconTag() {
  return <Svg><path d="M20 13 11 4H4v7l9 9z" /><circle cx="7.5" cy="7.5" r="1" /></Svg>
}

export function IconSettings() {
  return <Svg><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.4H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1.6z" /></Svg>
}

export function IconSearch() {
  return <Svg><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
}

export function IconBell() {
  return <Svg><path d="M6 9a6 6 0 1 1 12 0c0 7 2 7 2 7H4s2 0 2-7" /><path d="M10 19a2 2 0 0 0 4 0" /></Svg>
}

export function IconPlus() {
  return <Svg><path d="M12 5v14M5 12h14" /></Svg>
}

export function IconMenu() {
  return <Svg><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
}

export function IconClose() {
  return <Svg><path d="M6 6l12 12M18 6 6 18" /></Svg>
}

export function IconMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 16c4-8 10-8 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="9" r="2.4" fill="currentColor" />
    </svg>
  )
}
