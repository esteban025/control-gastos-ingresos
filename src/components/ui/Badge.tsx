type Props = {
  children: string
  tone?: 'accent' | 'muted' | 'warn'
}

export function Badge({ children, tone = 'accent' }: Props) {
  const cls = tone === 'muted' ? 'badge badge-muted' : tone === 'warn' ? 'badge badge-warn' : 'badge'
  return <span className={cls}>{children}</span>
}
