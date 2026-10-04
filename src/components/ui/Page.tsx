import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

export function Page({ title, subtitle, actions, children }: Props) {
  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="page__sub">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}
