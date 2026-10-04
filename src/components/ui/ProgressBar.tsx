type Props = {
  value: number
}

export function ProgressBar({ value }: Props) {
  const over = value > 100
  const warn = !over && value >= 85
  const width = Math.min(value, 100)
  return (
    <div className={`progress${over ? ' is-over' : warn ? ' is-warn' : ''}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${width}%` }} />
    </div>
  )
}
