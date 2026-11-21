import { useId, useLayoutEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { Action, Editor } from '../modeler/tools/editor'
import { Icon } from './Icon'
import { SnapControls } from './SnapControls'
import { UcsForm } from './UcsForm'

export type PanelKind = 'snap' | 'ucs' | 'shortcuts'
export type OpenPanel = (kind: PanelKind, anchor: HTMLButtonElement) => void

export interface WorkspacePanel {
  kind: PanelKind
  anchor: HTMLButtonElement
}

const panels = {
  snap: { title: 'Snap', icon: 'snap' },
  ucs: { title: 'Configurar UCS', icon: 'axes' },
  shortcuts: { title: 'Atajos de teclado', icon: 'keyboard' },
} as const

const shortcuts = [
  { title: 'Selección', items: [['Clic', 'Seleccionar un objeto'], ['Mayús + clic', 'Añadir a la selección'],
    ['Ctrl / Cmd + clic', 'Alternar selección'], ['Arrastrar ← / →', 'Seleccionar por cruce / contención'], ['Supr', 'Eliminar selección']] },
  { title: 'Dibujo', items: [['N', 'Crear nudo'], ['B', 'Dibujar barra'], ['M', 'Mover nudos'], ['A', 'Asignar apoyo'], ['C', 'Asignar carga'], ['V', 'Volver a selección'],
    ['Esc', 'Cancelar operación o limpiar selección']] },
  { title: 'Historial', items: [['Ctrl / Cmd + Z', 'Deshacer edición'], ['Ctrl + Y', 'Rehacer edición'],
    ['Ctrl / Cmd + Mayús + Z', 'Rehacer edición']] },
  { title: 'Edición CAD', items: [['Clic derecho', 'Acciones del comando o del elemento'], ['Alt + clic', 'Recorrer cargas coincidentes'],
    ['Ctrl / Cmd + C', 'Copiar selección'], ['Ctrl / Cmd + V', 'Indicar destino del pegado']] },
  { title: 'Navegación', items: [['Rueda', 'Zoom en el cursor'], ['H', 'Activar desplazamiento'],
    ['Botón central', 'Arrastrar para desplazar'], ['Espacio + arrastrar', 'Desplazar con el lienzo enfocado'], ['F', 'Ajustar vista']] },
  { title: 'Snap', items: [['F9', 'Activar o desactivar Grid Snap'], ['F3', 'Activar o desactivar Object Snap']] },
  { title: 'UCS', items: [['Clic en UCS', 'Consultar o configurar el sistema'],
    ['Elegir origen + clic', 'Fijar el origen en el lienzo']] },
]

function positionMenu(dialog: HTMLDialogElement, anchor: HTMLButtonElement) {
  const margin = 12
  const gap = 8
  const bounds = anchor.getBoundingClientRect()
  const width = dialog.getBoundingClientRect().width
  const limit = window.innerHeight - margin
  const anchorTop = Math.min(limit, Math.max(margin, bounds.top))
  const anchorBottom = Math.min(limit, Math.max(margin, bounds.bottom))
  const above = anchorTop - gap - margin
  const below = limit - anchorBottom - gap
  const upwards = above >= 200 || above >= below
  dialog.style.left = `${Math.max(margin, Math.min(bounds.left, window.innerWidth - width - margin))}px`
  dialog.style.top = upwards ? 'auto' : `${anchorBottom + gap}px`
  dialog.style.bottom = upwards ? `${window.innerHeight - anchorTop + gap}px` : 'auto'
  dialog.style.maxHeight = `${Math.max(0, upwards ? above : below)}px`
}

export function WorkspaceDialog({ panel, editor, dispatch, onClose }: {
  panel: WorkspacePanel
  editor: Editor
  dispatch: Dispatch<Action>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const { kind, anchor } = panel
  const descriptor = panels[kind]
  const anchored = kind !== 'shortcuts'

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    const update = () => { if (anchored) positionMenu(dialog, anchor) }
    update()
    headingRef.current?.focus()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      dialog.close()
      anchor.focus({ preventScroll: true })
    }
  }, [anchor, anchored])

  return <dialog ref={dialogRef} id={`workspace-${kind}`} aria-labelledby={titleId}
    className={`workspace-dialog ${anchored ? 'anchored-dialog' : 'shortcut-dialog'}`}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-surface">
      <header className="dialog-heading">
        <span className="tile-icon"><Icon name={descriptor.icon} size={18} /></span>
        <h2 id={titleId} tabIndex={-1} ref={headingRef}>{descriptor.title}</h2>
        <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}><Icon name="close" size={18} /></button>
      </header>
      <div className="dialog-content">
        {kind === 'snap' && <SnapControls settings={editor.snap} dispatch={dispatch} />}
        {kind === 'ucs' && <UcsForm frame={editor.ucs} picking={editor.interaction.tool === 'reference'}
          dispatch={dispatch} onClose={onClose} />}
        {kind === 'shortcuts' && <div className="shortcut-groups">
          {shortcuts.map(group => <section key={group.title}>
            <h3>{group.title}</h3>
            <ul>{group.items.map(([key, description]) => <li key={key}><kbd>{key}</kbd><span>{description}</span></li>)}</ul>
          </section>)}
        </div>}
      </div>
    </div>
  </dialog>
}
