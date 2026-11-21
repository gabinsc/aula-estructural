import { useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export interface ToolOption<T extends string> {
  readonly id: T
  readonly label: string
  readonly shortLabel: string
}

export function ToolMenu<T extends string>({ name, shortcut, icon, options, active, preset, open, setOpen, choose }: {
  name: string
  shortcut: string
  icon: 'support' | 'load'
  options: readonly ToolOption<T>[]
  active: boolean
  preset?: T
  open: boolean
  setOpen: (open: boolean) => void
  choose: (preset: T) => void
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const selected = active ? options.find(option => option.id === preset) : undefined
  const id = `tool-menu-${icon}`

  useLayoutEffect(() => {
    const button = trigger.current
    const menu = popup.current
    if (!open || !button || !menu) return

    function position() {
      if (!button || !menu) return
      const anchor = button.getBoundingClientRect()
      const gap = 6
      const edge = 8
      const right = anchor.right + gap
      const left = anchor.left - gap - menu.offsetWidth
      menu.style.left = `${Math.max(edge, Math.min(right + menu.offsetWidth <= innerWidth - edge ? right : left,
        innerWidth - menu.offsetWidth - edge))}px`
      menu.style.top = `${Math.max(edge, Math.min(anchor.top, innerHeight - menu.offsetHeight - edge))}px`
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !button?.contains(event.target) && !menu?.contains(event.target)) setOpen(false)
    }
    position()
    const option = menu.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? menu.querySelector('button')
    option?.focus({ preventScroll: true })
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open, setOpen])

  function close() {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
      }
      close()
      return
    }
    const buttons = Array.from(event.currentTarget.querySelectorAll('button'))
    const index = buttons.findIndex(button => button === document.activeElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length
      : event.key === 'ArrowUp' ? (index + buttons.length - 1) % buttons.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    buttons[next]?.focus()
  }

  return <>
    <button className="tool-menu-trigger" type="button" ref={trigger} aria-label={name} aria-pressed={active}
      title={selected ? `${name} · ${selected.label}` : `${name} (${shortcut})`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(!open)}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown') return
        event.preventDefault()
        setOpen(true)
      }}>
      <Icon name={icon} size={21} /><span>{selected?.shortLabel ?? name}</span>
      <span className="tool-menu-chevron"><Icon name="chevron" size={11} /></span>
    </button>
    {open && createPortal(<div id={id} role="menu" aria-label={name === 'Apoyo' ? 'Tipos de apoyo' : 'Tipos de carga'}
      ref={popup} className="tool-menu-popup" onKeyDown={navigate}>
      {options.map(option => <button key={option.id} type="button" role="menuitemradio"
        aria-checked={option.id === selected?.id} onClick={() => { choose(option.id); close() }}>{option.label}</button>)}
    </div>, document.body)}
  </>
}
