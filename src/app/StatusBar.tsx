import type { Point } from '../geometry/coordinates'
import type { Ref } from 'react'
import type { DimensionMode } from '../modeler/canvas/Dimensions'
import { gridStep } from '../modeler/canvas/Grid'
import { formatNumber } from '../modeler/format'
import { OBJECT_REFERENCES } from '../modeler/tools/snap'
import type { SnapSettings } from '../modeler/tools/snap'
import { Icon } from './Icon'
import type { OpenPanel, PanelKind } from './WorkspaceDialog'

export function StatusBar({
  position, digits, scale, showGrid, toggleGrid, snap, ucsLabel, activePanel, openPanel, tool, snapLabel, snapButton, dimensions, setDimensions,
}: {
  position: Point | null
  digits: number
  scale: number
  showGrid: boolean
  toggleGrid: () => void
  snap: SnapSettings
  ucsLabel: string
  activePanel?: PanelKind
  openPanel: OpenPanel
  tool: string
  snapLabel?: string
  snapButton: Ref<HTMLButtonElement>
  dimensions: DimensionMode
  setDimensions: (mode: DimensionMode) => void
}) {
  const objectsActive = snap.objects && OBJECT_REFERENCES.some(reference => snap.references[reference])
  const gridText = showGrid ? `Cuadrícula · ${formatNumber(gridStep(scale))} m` : 'Cuadrícula oculta'
  const objectsText = objectsActive ? 'objetos activos' : snap.objects ? 'sin referencias de objeto' : 'objetos desactivados'
  return <footer className="statusbar" role="region" aria-label="Estado del modelador">
    <div className="status-geometry" role="group" aria-label="Información geométrica">
      <div className="cursor-status" aria-label="Coordenadas globales">
        <Icon name="cursor" size={15} /><span className="status-caption" aria-hidden="true">Global</span>
        {(['x', 'y'] as const).map(axis => {
          const value = position ? formatNumber(position[axis], digits) : '—'
          return <span className="status-coordinate" key={axis}>{axis.toUpperCase()} <output title={value}>{value}</output></span>
        })}
        <span className="status-unit" title="metros">m</span>
      </div>
      <div className="status-view">
        <span title="Escala"><span className="status-caption">Escala </span><output>{formatNumber(scale, 2)} px/m</output></span>
        <button type="button" className="status-button status-grid" aria-label="Cuadrícula visual" aria-pressed={showGrid}
          title={gridText} onClick={toggleGrid}>
          <Icon name="grid" size={16} /><span className="status-button-text">{gridText}</span>
        </button>
      </div>
    </div>
    <div className="status-work" role="group" aria-label="Controles de trabajo">
      <button ref={snapButton} type="button" className="status-button" aria-label="Snap" aria-haspopup="dialog"
        aria-expanded={activePanel === 'snap'} aria-controls="workspace-snap"
        title={`Snap · ajuste a cuadrícula ${snap.grid ? 'activo' : 'desactivado'} · ${objectsText}`}
        onClick={event => openPanel('snap', event.currentTarget)}>
        <Icon name="snap" size={17} /><span className="status-button-text">Snap</span>
        <span className="snap-dots" aria-hidden="true"><i className={snap.grid ? 'active' : ''} /><i className={objectsActive ? 'active' : ''} /></span>
      </button>
      <select className="status-button dimension-select" aria-label="Modo de cotas" title="Modo de cotas" value={dimensions}
        onChange={event => {
          const value = event.target.value
          if (value === 'hidden' || value === 'selection' || value === 'all') setDimensions(value)
        }}>
        <option value="hidden">Sin cotas</option>
        <option value="selection">Cotas de selección</option>
        <option value="all">Todas las cotas</option>
      </select>
      <button type="button" className="status-button" aria-label="Configurar UCS desde barra de estado" aria-haspopup="dialog"
        aria-expanded={activePanel === 'ucs'} aria-controls="workspace-ucs" title={`Configurar UCS · ${ucsLabel}`}
        onClick={event => openPanel('ucs', event.currentTarget)}>
        <Icon name="axes" size={17} /><span className="status-button-text">UCS</span>
      </button>
    </div>
    <div className="status-active" title={snapLabel ? `${tool} · ${snapLabel}` : tool}>
      <span className="status-dot" /><span>{tool}</span>{snapLabel && <span className="status-snap-label">{snapLabel}</span>}
    </div>
    <div className="status-help" role="group" aria-label="Ayuda">
      <button type="button" className="status-button" aria-label="Atajos de teclado" aria-haspopup="dialog"
        aria-expanded={activePanel === 'shortcuts'} aria-controls="workspace-shortcuts" title="Atajos de teclado"
        onClick={event => openPanel('shortcuts', event.currentTarget)}>
        <Icon name="keyboard" size={18} /><span className="status-button-text">Atajos</span>
      </button>
    </div>
  </footer>
}
