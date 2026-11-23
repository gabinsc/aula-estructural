import { useMemo } from 'react'
import type { NodeOverlap } from '../../domain/nodeOverlaps'
import type { LoadDefinition } from '../../domain/load'
import type { Selection, Structure } from '../../domain/structure'
import { worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import { translateFromReference } from '../../geometry/coordinates'
import type { Point } from '../../geometry/coordinates'
import { SupportSymbol } from './SupportSymbol'
import { LoadLayer } from './LoadLayer'

interface LayerProps {
  model: Structure
  selection: readonly Selection[]
  hover: Selection | null
  camera: Camera
  viewport: Viewport
  preview: { from: Point; to: Point | null } | null
  movePreview: { nodeIds: readonly string[]; reference: Point; destination: Point } | null
  overlaps: readonly NodeOverlap[]
  activeLoadId: string | null
  loadDraft: LoadDefinition | null
  showGeometry: boolean
  showLoads: boolean
  showIds: boolean
  decimals: number
}

export function StructureLayer({ model, selection, hover, camera, viewport, preview, movePreview, overlaps, activeLoadId, loadDraft,
  showGeometry, showLoads, showIds, decimals }: LayerProps) {
  const { nodes } = model
  const positions = useMemo(() => new Map(nodes.map(node => [node.id, worldToScreen(node, camera, viewport)])),
    [nodes, camera, viewport])
  const selectedIds = useMemo(() => new Set(selection.map(item => item.id)), [selection])
  const overlappingIds = useMemo(() => new Set(overlaps.flatMap(group => group.map(node => node.id))), [overlaps])
  const movedPositions = new Map<string, Point>()
  if (movePreview) {
    const ids = new Set(movePreview.nodeIds)
    for (const node of model.nodes) {
      if (ids.has(node.id)) movedPositions.set(node.id, worldToScreen(
        translateFromReference(node, movePreview.reference, movePreview.destination), camera, viewport,
      ))
    }
  }
  return <g aria-hidden="true">
    {showGeometry && model.bars.map(bar => {
      const a = positions.get(bar.startId)
      const b = positions.get(bar.endId)
      if (!a || !b) return null
      const selected = selectedIds.has(bar.id)
      const pointed = hover?.kind === 'bar' && hover.id === bar.id
      return <g className={`member${selected ? ' is-selected' : ''}${pointed ? ' is-hovered' : ''}`} key={bar.id} data-bar-id={bar.id}>
        <line className="member-halo" x1={a.x} x2={b.x} y1={a.y} y2={b.y} />
        <line className="member-line" x1={a.x} x2={b.x} y1={a.y} y2={b.y} />
        {([['i', a, b, bar.releaseI], ['j', b, a, bar.releaseJ]] as const)
          .map(([side, tip, other, released]) => {
            if (!released) return null
            const fraction = Math.min(.28, 12 / Math.hypot(other.x - tip.x, other.y - tip.y))
            return <circle key={side} data-release={side} className="member-release"
              cx={tip.x + (other.x - tip.x) * fraction} cy={tip.y + (other.y - tip.y) * fraction} r={4.5}>
              <title>{bar.id} · giro liberado en {side}</title>
            </circle>
          })}
        {showIds && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 11} textAnchor="middle">{bar.label}</text>}
      </g>
    })}
    {showGeometry && model.supports.map(support => {
      const point = positions.get(support.nodeId)
      return point && <SupportSymbol key={support.nodeId} support={support} point={point} selected={selectedIds.has(support.nodeId)} />
    })}
    {(showLoads || loadDraft) && <LoadLayer model={showLoads ? model : { ...model, loads: [] }}
      positions={positions} camera={camera} viewport={viewport} activeId={activeLoadId}
      selectedIds={selectedIds} draft={loadDraft} decimals={decimals} />}
    {showGeometry && model.nodes.map(node => {
      const point = positions.get(node.id)
      if (!point) return null
      const selected = selectedIds.has(node.id)
      const pointed = hover?.kind === 'node' && hover.id === node.id
      return <g className={`joint${selected ? ' is-selected' : ''}${pointed ? ' is-hovered' : ''}`} key={node.id} data-node-id={node.id}>
        <circle className="joint-halo" cx={point.x} cy={point.y} r={9} />
        <circle className="joint-mark" cx={point.x} cy={point.y} r={4.5} />
        {showIds && !overlappingIds.has(node.id) && <text x={point.x + 10} y={point.y - 9}>{node.label}</text>}
      </g>
    })}
    {showGeometry && overlaps.map(group => {
      const anchor = group[0]!
      const point = positions.get(anchor.id)
      if (!point) return null
      return <g key={anchor.id} className="node-overlap-marker" transform={`translate(${point.x} ${point.y})`}>
        <circle r={11} />
        <path d="M17-24 25-10H9Z" />
        <path className="node-overlap-symbol" d="M17-20v4m0 2.5v.2" />
      </g>
    })}
    {preview && <g className="member-preview">
      {preview.to && <line x1={preview.from.x} y1={preview.from.y} x2={preview.to.x} y2={preview.to.y} />}
      <circle cx={preview.from.x} cy={preview.from.y} r={5} />
    </g>}
    {movePreview && <g className="member-preview move-preview">
      {model.bars.map(bar => {
        const movedStart = movedPositions.get(bar.startId)
        const movedEnd = movedPositions.get(bar.endId)
        if (!movedStart && !movedEnd) return null
        const start = movedStart ?? positions.get(bar.startId)
        const end = movedEnd ?? positions.get(bar.endId)
        return start && end && <line key={bar.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
      })}
      {[...movedPositions].map(([id, point]) => <circle key={id} cx={point.x} cy={point.y} r={5} />)}
    </g>}
    {movePreview && model.supports.map(support => {
      const point = movedPositions.get(support.nodeId)
      return point && <SupportSymbol key={support.nodeId} support={support} point={point} preview />
    })}
  </g>
}
