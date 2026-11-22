import { useId } from 'react'
import { MAX_REDUNDANTS } from '../../analysis/forceMethod'
import type { PrimaryConstraints, Redundant } from '../../analysis/forceMethod'
import type { Motion, Target } from '../../analysis/virtualWork'
import type { WorkInterval } from '../../analysis/workIntegral'
import { loadBarGeometry } from '../../domain/load'
import type { Structure } from '../../domain/structure'
import { fitCamera, worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import { toGlobal } from '../../geometry/coordinates'
import { LoadLayer } from '../../modeler/canvas/LoadLayer'
import { SupportSymbol } from '../../modeler/canvas/SupportSymbol'
import { AXIS_LABEL } from './MethodControls'
import { resultNumber } from './ResultTable'

export function RedundantMarkers({ model, candidates, ids, toggle, camera, viewport }: {
  model: Structure; candidates: readonly Redundant[]; ids: readonly string[]; toggle: (id: string) => void
  camera: Camera; viewport: Viewport
}) {
  const nodes = new Map(model.nodes.map(node => [node.id, worldToScreen(node, camera, viewport)]))
  const counts = new Map<string, number>()
  return <g className="method-markers" role="group" aria-label="Restricciones seleccionables en el CAD">
    {candidates.map(item => {
      const point = nodes.get(item.nodeId)
      if (!point || point.x < 26 || point.y < 25 || point.x > viewport.width || point.y > viewport.height) return null
      const index = counts.get(item.nodeId) ?? 0
      counts.set(item.nodeId, index + 1)
      const checked = ids.includes(item.id)
      const y = point.y >= 61 ? point.y - 30 : point.y + 39
      const x = Math.max(39, Math.min(viewport.width - 67, point.x - 29)) + 25 * index
      return <g key={item.id} className="method-marker" role="checkbox" tabIndex={0} aria-checked={checked}
        aria-label={`CAD ${item.id} · ${AXIS_LABEL[item.axis]}`} aria-disabled={!checked && ids.length >= MAX_REDUNDANTS}
        transform={`translate(${x} ${y})`}
        onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
        onClick={() => toggle(item.id)} onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.stopPropagation()
          toggle(item.id)
        }}>
        <title>{item.id} · {AXIS_LABEL[item.axis]}</title>
        <rect x={-10} y={-10} width={21} height={20} rx={4} />
        <text textAnchor="middle" y={4}>{item.axis === 'normal' ? 'n' : item.axis === 'rotation' ? 'θ' : item.axis.toUpperCase()}</text>
      </g>
    })}
  </g>
}

export function SystemDiagram({ label, model, activeIds, primary, action, selectedBar }: {
  label: string; model: Structure; activeIds?: readonly string[]; primary?: PrimaryConstraints; selectedBar?: string
  action?: { readonly target: Target; readonly motion: Motion }
}) {
  const id = useId()
  const view = { width: 340, height: 185 }
  // Deja margen vertical para apoyos y acciones.
  const fit = fitCamera(model.nodes, { width: 300, height: 104 })
  const positions = new Map(model.nodes.map(node => [node.id, worldToScreen(node, fit, view)]))
  const geometry = action?.target.kind === 'section' ? loadBarGeometry(model, action.target.id) : undefined
  const point = !action ? undefined : action.target.kind === 'node' ? positions.get(action.target.id)
    : geometry ? worldToScreen(toGlobal({ x: action.target.s, y: 0 }, geometry.frame), fit, view) : undefined
  const shownLoads = activeIds && model.loads.filter(load => activeIds.includes(load.id))
  return <figure className="method-diagram">
    <figcaption>{label}</figcaption>
    <svg viewBox="0 0 340 185" role="img" aria-label={label}>
      <defs><marker id={id} orient="auto" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="6" refY="3.5">
        <path d="M0 0L7 3.5L0 7Z" className="method-action-head" />
      </marker></defs>
      {model.bars.map(bar => {
        const a = positions.get(bar.startId)!
        const b = positions.get(bar.endId)!
        return <line key={bar.id} className={bar.id === selectedBar ? 'method-member current' : 'method-member'}
          x1={a.x} y1={a.y} x2={b.x} y2={b.y}><title>{bar.id}</title></line>
      })}
      {(primary?.supports ?? model.supports).map(support =>
        <SupportSymbol key={support.nodeId} support={support} point={positions.get(support.nodeId)!} preview />)}
      {primary?.rotationLocks.map(nodeId => {
        const p = positions.get(nodeId)!
        return <text key={nodeId} className="method-action-label" x={p.x + 6} y={p.y + 15}>θ = 0</text>
      })}
      {shownLoads && <LoadLayer model={{ ...model, loads: shownLoads }} positions={positions} camera={fit} viewport={view}
        activeId={null} selectedIds={new Set()} draft={null} />}
      {[...positions].map(([nodeId, p]) => <g className="method-node" key={nodeId}>
        <circle cx={p.x} cy={p.y} r={2.6} /><text x={p.x + 5} y={p.y - 5}>{nodeId}</text>
      </g>)}
      {point && action && <g className="method-action" transform={`translate(${point.x} ${point.y})`}>
        {action.motion.kind === 'rotation' ? <path d="M14 5 A15 15 0 1 0 -12 9" markerEnd={`url(#${id})`} />
          : <line x1={-37 * action.motion.direction.x} y1={37 * action.motion.direction.y}
            x2={0} y2={0} markerEnd={`url(#${id})`} />}
        <circle r={3.2} />
        <text className="method-action-label" x={7} y={-24}>{action.motion.kind === 'rotation' ? '1 N·m' : '1 N'}</text>
      </g>}
    </svg>
  </figure>
}

/** Interpola el campo local de grado ≤ 3 a partir de las cuatro muestras de Gauss. */
function curve(interval: WorkInterval, system: 'real' | 'unit', field: 'N' | 'M') {
  const points = interval.samples.filter(sample => sample.weight !== undefined)
  const span = interval.to - interval.from
  const t = points.map(point => (point.s - interval.from) / span)
  if (points.length !== 4 || new Set(t).size < 4) return interval.samples.map(point => point[system][field])
  return Array.from({ length: 41 }, (_, index) => {
    if (index === 0 || index === 40) return interval.samples.at(index === 0 ? 0 : -1)![system][field]
    return points.reduce((sum, point, i) => sum + point[system][field] * t.reduce((coef, value, j) =>
      i === j ? coef : coef * (index / 40 - value) / (t[i]! - value), 1), 0)
  })
}

export function EffortDiagram({ interval, system, field }: {
  interval: WorkInterval; system: 'real' | 'unit'; field: 'N' | 'M'
}) {
  const points = curve(interval, system, field)
  const extent = Math.max(...points.map(Math.abs))
  const path = points.map((value, i) => `${i === 0 ? 'M' : 'L'}${12 + i * 146 / (points.length - 1)},${36 - 25 * (extent ? value / extent : 0)}`).join(' ')
  const letter = system === 'real' ? field : field.toLowerCase()
  const unit = field === 'N' ? 'kN' : 'kN·m'
  return <figure className="method-diagram">
    <figcaption>{letter} · {system === 'real' ? 'Real' : 'Unitario'} · escala ±{resultNumber(extent, .001)} {unit}</figcaption>
    <svg viewBox="0 0 170 73" role="img" aria-label={`Diagrama ${letter} del intervalo`}>
      <path className="method-baseline" d="M8 36H162" />
      <path data-field={field} className="method-curve" d={path} />
      <text x={12} y={70}>{resultNumber(interval.from)} m</text>
      <text x={158} y={70} textAnchor="end">{resultNumber(interval.to)} m</text>
    </svg>
  </figure>
}
