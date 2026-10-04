import { useState } from 'react'

type Segment = { label: string; value: number }

type Props = {
  segments: Segment[]
  format?: (value: number) => string
}

const tones = ['#c9a35a', '#e6907f', '#7cc49a', '#8fa7d6', '#b597d1', '#d9c48a', '#6fb7b5', '#8a8a8a']

export function Donut({ segments, format = (v) => String(Math.round(v)) }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  const r = 46
  const stroke = 14
  const c = 2 * Math.PI * r
  const gap = segments.length > 1 ? 2 : 0
  const offsets = segments.map((_, i) => segments.slice(0, i).reduce((sum, s) => sum + (s.value / total) * c, 0))
  const active = hover !== null ? segments[hover] : null

  return (
    <div className="donut-wrap">
      <svg width="160" height="160" viewBox="0 0 120 120" role="img" aria-label="Gastos por categoría">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * c
          const visible = Math.max(len - gap, 0.001)
          return (
            <circle
              key={seg.label}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={tones[i % tones.length]}
              strokeWidth={hover === i ? stroke + 3 : stroke}
              strokeDasharray={`${visible} ${c - visible}`}
              strokeDashoffset={-offsets[i]}
              transform="rotate(-90 60 60)"
              opacity={hover !== null && hover !== i ? 0.4 : 1}
              style={{ transition: 'opacity 0.15s, stroke-width 0.15s', cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}
        <text x="60" y="55" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
          {active ? active.label : 'Total'}
        </text>
        <text x="60" y="71" textAnchor="middle" fill="var(--text)" fontSize="12.5" fontWeight="700">
          {format(active ? active.value : total)}
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <span
            key={seg.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ opacity: hover !== null && hover !== i ? 0.5 : 1, transition: 'opacity 0.15s' }}
          >
            <i className="legend-swatch" style={{ background: tones[i % tones.length] }} />
            {seg.label}
            <b>{Math.round((seg.value / total) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  )
}
