import type { ReactNode } from 'react'

type Props = {
  label: string
  value: string
  meta?: string
  /** Color del indicador: good = verde, bad = rojo. */
  tone?: 'good' | 'bad'
  icon?: ReactNode
  iconTone?: 'pos' | 'neg' | 'accent'
}

export function StatCard({ label, value, meta, tone, icon, iconTone }: Props) {
  return (
    <article className="card stat">
      {icon ? (
        <div className="stat__top">
          <p className="stat__label">{label}</p>
          <span className={`stat__icon${iconTone ? ` is-${iconTone}` : ''}`}>{icon}</span>
        </div>
      ) : (
        <p className="stat__label">{label}</p>
      )}
      <p className="stat__value">{value}</p>
      {meta ? <p className={`stat__meta${tone ? ` is-${tone}` : ''}`}>{meta}</p> : null}
    </article>
  )
}
