import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft'
  children: ReactNode
}

export function Button({ variant = 'primary', className = '', children, ...props }: Props) {
  return (
    <button className={`btn btn-${variant} ${className}`} type={props.type ?? 'button'} {...props}>
      {children}
    </button>
  )
}
