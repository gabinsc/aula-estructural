import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Point } from '../../geometry/coordinates'

export interface CadMenuItem {
  readonly label: string
  readonly run: () => void
}

export function CadContextMenu({ point, items, title, close, focusCanvas }: {
  point: Point
  items: readonly CadMenuItem[]
  title: string
  close: () => void
  focusCanvas: () => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  const outside = useRef(close)
  outside.current = close
  useLayoutEffect(() => {
    const element = menu.current!
    function position() {
      element.style.left = `${Math.max(8, Math.min(point.x, innerWidth - element.offsetWidth - 8))}px`
      element.style.top = `${Math.max(8, Math.min(point.y, innerHeight - element.offsetHeight - 8))}px`
    }
    function pointer(event: PointerEvent) {
      if (event.target instanceof Node && !element.contains(event.target)) outside.current()
    }
    position()
    element.querySelector('button')?.focus({ preventScroll: true })
    window.addEventListener('resize', position)
    document.addEventListener('pointerdown', pointer, true)
    return () => {
      window.removeEventListener('resize', position)
      document.removeEventListener('pointerdown', pointer, true)
    }
  }, [point])

  return createPortal(<div ref={menu} className="tool-menu-popup cad-context-menu" role="menu" aria-label={title}
    onContextMenu={event => event.preventDefault()}
    onKeyDown={event => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault()
        event.stopPropagation()
        close()
        focusCanvas()
        return
      }
      const opts = [...event.currentTarget.querySelectorAll('button')]
      const index = opts.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? opts.length - 1 :
        event.key === 'ArrowDown' ? (index + 1) % opts.length :
        event.key === 'ArrowUp' ? (index + opts.length - 1) % opts.length : -1
      if (next < 0) return
      event.preventDefault()
      opts[next]?.focus()
    }}>
    <div className="cad-context-title">{title}</div>
    {items.map(item => <button key={item.label} type="button" role="menuitem" onClick={() => {
      close()
      focusCanvas()
      item.run()
    }}>{item.label}</button>)}
  </div>, document.body)
}
