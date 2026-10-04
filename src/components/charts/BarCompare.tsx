import { useEffect, useRef, useState } from 'react'

export type MonthPoint = {
  month: string
  income: number
  expense: number
}

type Props = {
  data: MonthPoint[]
  height?: number
  format?: (value: number) => string
}

function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(Math.round(value))
}

function niceMax(value: number): number {
  if (value <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((m) => m * exp >= value) ?? 10
  return step * exp
}

export function BarCompare({ data, height = 220, format = (v) => String(Math.round(v)) }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const [width, setWidth] = useState(560)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const max = niceMax(Math.max(...data.flatMap((d) => [d.income, d.expense]), 0))
  const left = 40
  const right = 8
  const top = 10
  const bottom = 26
  const innerW = width - left - right
  const innerH = height - top - bottom
  const group = innerW / Math.max(data.length, 1)
  const barW = Math.min(18, group * 0.26)
  const gap = 4
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const y = (value: number) => top + innerH - (value / max) * innerH
  const active = hover !== null ? data[hover] : null

  return (
    <div>
      <div className="chart-box" ref={boxRef} onMouseLeave={() => setHover(null)}>
        <svg
          className="chart"
          style={{ height }}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Ingresos frente a gastos"
        >
          <defs>
            <linearGradient id="bar-in" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--gold-bright)" />
              <stop offset="1" stopColor="var(--gold-deep)" />
            </linearGradient>
            <linearGradient id="bar-out" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--neg)" />
              <stop offset="1" stopColor="#9a5448" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={left}
                x2={width - right}
                y1={y(max * t)}
                y2={y(max * t)}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray={t === 0 ? undefined : '3 4'}
              />
              <text x={left - 8} y={y(max * t) + 3} textAnchor="end" fill="var(--text-faint)" fontSize="10">
                {compact(max * t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = left + group * i + group / 2
            const ih = (d.income / max) * innerH
            const eh = (d.expense / max) * innerH
            const dim = hover !== null && hover !== i
            return (
              <g key={d.month} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity 0.15s' }}>
                <rect
                  x={left + group * i}
                  y={top}
                  width={group}
                  height={innerH}
                  fill={hover === i ? 'rgba(255,255,255,0.03)' : 'transparent'}
                  onMouseEnter={() => setHover(i)}
                />
                <rect x={cx - barW - gap / 2} y={y(d.income)} width={barW} height={ih} rx="4" fill="url(#bar-in)" pointerEvents="none" />
                <rect x={cx + gap / 2} y={y(d.expense)} width={barW} height={eh} rx="4" fill="url(#bar-out)" pointerEvents="none" />
                <text x={cx} y={height - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="11">
                  {d.month}
                </text>
              </g>
            )
          })}
        </svg>
        {active && hover !== null ? (
          <div
            className="chart-tip"
            style={{
              left: left + group * hover + group / 2,
              top: y(Math.max(active.income, active.expense)),
            }}
          >
            <strong>{active.month}</strong>
            <span>
              <i className="legend-dot" /> Ingresos <b>{format(active.income)}</b>
            </span>
            <span>
              <i className="legend-dot is-soft" /> Gastos <b>{format(active.expense)}</b>
            </span>
          </div>
        ) : null}
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-dot" /> Ingresos
        </span>
        <span>
          <i className="legend-dot is-soft" /> Gastos
        </span>
      </div>
    </div>
  )
}
