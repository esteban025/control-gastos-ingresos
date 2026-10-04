import type { ReactNode } from 'react'
import { IconClose } from '../../lib/icons'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal__head">
          <h2 id="modal-title" className="card__title">
            {title}
          </h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
