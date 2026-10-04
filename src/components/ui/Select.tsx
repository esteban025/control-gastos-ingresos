import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

export type SelectOption = {
  value: string | number
  label: string
}

type Props = {
  value: string | number
  options: SelectOption[]
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

type Position = { top: number; left: number; width: number; maxHeight: number; up: boolean }

const MENU_MAX = 280
const GAP = 6

/** Reemplazo del <select> nativo con lista desplegable personalizable. */
export function Select({ value, options, onChange, id, placeholder = 'Seleccionar…', disabled, className = '', ...rest }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const listId = useId()

  const selectedIndex = options.findIndex((option) => String(option.value) === String(value))
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  function place() {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - GAP - 8
    const above = rect.top - GAP - 8
    const up = below < Math.min(MENU_MAX, 160) && above > below
    setPos({
      top: up ? rect.top - GAP : rect.bottom + GAP,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(MENU_MAX, up ? above : below),
      up,
    })
  }

  function openMenu() {
    if (disabled || options.length === 0) return
    place()
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  function close(focusTrigger = true) {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    if (String(option.value) !== String(value)) onChange(String(option.value))
    close()
  }

  // Cerrar al hacer clic fuera y reubicar al hacer scroll o cambiar el tamaño.
  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    function onScroll(event: Event) {
      if (listRef.current?.contains(event.target as Node)) return
      place()
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  // Mantener visible la opción activa.
  useLayoutEffect(() => {
    if (!open || active < 0) return
    const item = listRef.current?.children[active] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function typeahead(key: string) {
    const now = Date.now()
    typed.current.text = now - typed.current.at > 600 ? key : typed.current.text + key
    typed.current.at = now
    const term = typed.current.text.toLowerCase()
    const start = open ? active : selectedIndex
    const ordered = options.map((_, i) => (start + 1 + i) % options.length)
    const match = ordered.find((i) => options[i].label.toLowerCase().startsWith(term))
    if (match === undefined) return
    if (open) setActive(match)
    else onChange(String(options[match].value))
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        if (!open) {
          openMenu()
          return
        }
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive((current) => Math.min(last, Math.max(0, current + step)))
        return
      }
      case 'Home':
      case 'End':
        if (!open) return
        event.preventDefault()
        setActive(event.key === 'Home' ? 0 : last)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open) choose(active)
        else openMenu()
        return
      case 'Escape':
        if (!open) return
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      case 'Tab':
        if (open) setOpen(false)
        return
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typeahead(event.key)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        className={`select${open ? ' is-open' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={rest['aria-label']}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={`select__value${selected ? '' : ' is-placeholder'}`}>{selected ? selected.label : placeholder}</span>
        <svg className="select__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && pos
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className={`select-menu${pos.up ? ' is-up' : ''}`}
              style={{
                top: pos.top,
                left: pos.left,
                minWidth: pos.width,
                maxHeight: pos.maxHeight,
                transform: pos.up ? 'translateY(-100%)' : undefined,
              }}
            >
              {options.map((option, index) => {
                const isSelected = index === selectedIndex
                return (
                  <li
                    key={String(option.value)}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`select-menu__option${index === active ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                    onPointerMove={() => setActive(index)}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => choose(index)}
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5 10 17 19 7.5" />
                      </svg>
                    ) : null}
                  </li>
                )
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  )
}
