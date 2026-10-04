import type { ReactNode } from 'react'

type Props = {
  title?: string
  hint?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function Card({ title, hint, action, className = '', children }: Props) {
  return (
    <section className={`card ${className}`}>
      {(title || action || hint) && (
        <div className="card__head">
          <div>
            {title ? <h2 className="card__title">{title}</h2> : null}
            {hint ? <p className="card__hint">{hint}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
