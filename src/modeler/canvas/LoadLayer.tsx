import { memo } from 'react'
import { distributedIntensity, globalLoadVector, loadBarGeometry, loadTarget, toKiloUnits } from '../../domain/load'
import type { LoadDefinition, LoadFrame } from '../../domain/load'
import type { Structure } from '../../domain/structure'
import { worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import { toGlobal } from '../../geometry/coordinates'
import type { CoordinateFrame, Point } from '../../geometry/coordinates'
import { formatNumber } from '../format'

function arrowHead(tip: Point, direction: Point, length = 8) {
  const x = tip.x - length * direction.x
  const y = tip.y - length * direction.y
  const wing = length / 2
  return `M${x - wing * direction.y} ${y + wing * direction.x}L${tip.x} ${tip.y}L${x + wing * direction.y} ${y - wing * direction.x}`
}

function ForceArrow({ tip, direction, length, text }: {
  tip: Point; direction: Point; length: number; text?: string
}) {
  const tail = { x: tip.x - length * direction.x, y: tip.y - length * direction.y }
  return <g className="force-arrow">
    <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} />
    <path d={arrowHead(tip, direction, Math.min(8, length * .55))} />
    {text && <text x={tail.x + (direction.x > 0.2 ? -5 : 5)} y={tail.y - 5}
      textAnchor={direction.x > 0.2 ? 'end' : 'start'}>{text}</text>}
  </g>
}

function MomentArrow({ anchor, value, radius }: { anchor: Point; value: number; radius: number }) {
  const sign = Math.sign(value)
  const k = Math.SQRT1_2
  const tip = { x: sign * k * radius, y: k * radius }
  return <g className="moment-arrow" transform={`translate(${anchor.x} ${anchor.y})`}>
    <path className="moment-arc" d={`M0 ${-radius}A${radius} ${radius} 0 1 ${sign > 0 ? 0 : 1} ${tip.x} ${tip.y}`} />
    <path d={arrowHead(tip, { x: sign * k, y: -k })} />
    <text x={radius + 6} y={radius + 12}>{formatNumber(toKiloUnits(value))} kN·m</text>
  </g>
}

function NodalSymbol({ load, point, index, id }: { load: Extract<LoadDefinition, { kind: 'nodal' }>; point: Point; index: number; id: string }) {
  const { force, moment } = load
  const length = 32 + index * 15
  const sx = Math.sign(force.x)
  const sy = Math.sign(force.y)
  return <>
    {force.x !== 0 && <ForceArrow tip={{ x: point.x - 7 * sx, y: point.y }} direction={{ x: sx, y: 0 }}
      length={length} text={`${formatNumber(toKiloUnits(force.x))} kN`} />}
    {force.y !== 0 && <ForceArrow tip={{ x: point.x, y: point.y + 7 * sy }} direction={{ x: 0, y: -sy }}
      length={length} text={`${formatNumber(toKiloUnits(force.y))} kN`} />}
    {moment !== 0 && <MomentArrow anchor={point} value={moment} radius={16 + index * 10} />}
    {force.x === 0 && force.y === 0 && moment === 0 && <>
      <circle className="load-anchor" cx={point.x + 13} cy={point.y + 13 + index * 14} r={3} />
      <text x={point.x + 20} y={point.y + 16 + index * 14}>{id} · 0 kN · 0 kN·m</text>
    </>}
  </>
}

function formatVector(vector: Point) {
  return `(${formatNumber(toKiloUnits(vector.x))}, ${formatNumber(toKiloUnits(vector.y))})`
}

function forceDirection(force: Point, frame: LoadFrame, angle: number): { direction: Point; size: number } {
  const size = Math.hypot(force.x, force.y)
  if (!size) return { direction: { x: 0, y: 0 }, size }
  const physical = globalLoadVector({ x: force.x / size, y: force.y / size }, frame, angle)
  return { direction: { x: physical.x, y: -physical.y }, size }
}

function PointSymbol({ load, point, angle, index }: {
  load: Extract<LoadDefinition, { kind: 'point' }>; point: Point; angle: number; index: number
}) {
  const { direction, size } = forceDirection(load.force, load.frame, angle)
  const label = `${formatVector(load.force)} kN · ${load.frame}`
  const tip = { x: point.x - direction.x * 5, y: point.y - direction.y * 5 }
  return <>
    <circle className="load-anchor" cx={point.x} cy={point.y} r={3} />
    {size ? <ForceArrow tip={tip} direction={direction} length={33 + index * 15} text={label} />
      : <text x={point.x + 8} y={point.y - 8 - index * 13}>{label}</text>}
  </>
}

function DistributedSymbol({ load, frame, index, camera, viewport }: {
  load: Extract<LoadDefinition, { kind: 'distributed' }>; frame: CoordinateFrame; index: number
  camera: Camera; viewport: Viewport
}) {
  const at = (u: number) => worldToScreen(toGlobal({ x: (1 - u) * load.s0 + u * load.s1, y: 0 }, frame), camera, viewport)
  const start = at(0)
  const end = at(1)
  const spacing = Math.hypot(end.x - start.x, end.y - start.y)
  const intervals = Math.max(1, Math.min(10, Math.floor(spacing / 25)))
  const peak = Math.max(Math.hypot(load.q0.x, load.q0.y), Math.hypot(load.q1.x, load.q1.y))
  const sample = (u: number) => {
    const tip = at(u)
    const { direction, size } = forceDirection(distributedIntensity(load, u), load.frame, frame.angle)
    const length = peak ? size / peak * (43 + index * 12) : 0
    return { tip, length, direction, tail: { x: tip.x - length * direction.x, y: tip.y - length * direction.y } }
  }
  const first = sample(0)
  const last = sample(1)
  const { tail: middle } = sample(.5)
  const label = load.profile === 'uniform' ? `q ${formatVector(load.q0)}`
    : `q₀ ${formatVector(load.q0)} → q₁ ${formatVector(load.q1)}`
  return <>
    <line className="load-span" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
    <line className="load-envelope" x1={first.tail.x} y1={first.tail.y} x2={last.tail.x} y2={last.tail.y} />
    {Array.from({ length: intervals + 1 }, (_, i) => {
      const { tip, direction, length } = sample(i / intervals)
      return length >= 1 && <ForceArrow key={i} tip={tip} direction={direction} length={length} />
    })}
    <circle className="load-anchor" cx={start.x} cy={start.y} r={2} />
    <circle className="load-anchor" cx={end.x} cy={end.y} r={2} />
    <text x={middle.x} y={middle.y - 8 - index * 13} textAnchor="middle">{label} kN/m · {load.frame}</text>
  </>
}

export const LoadLayer = memo(function LoadLayer({ model, positions, camera, viewport, selectedIds, activeId, draft }: {
  model: Structure
  positions: ReadonlyMap<string, Point>
  camera: Camera
  viewport: Viewport
  activeId: string | null
  selectedIds: ReadonlySet<string>
  draft: LoadDefinition | null
}) {
  const indices = new Map<string, number>()
  function symbol(load: LoadDefinition, index: number, id: string) {
      const geometry = load.kind === 'nodal' ? null : loadBarGeometry(model, load.barId)
      const point = load.kind === 'nodal' ? positions.get(load.nodeId) : null
      return <>
        {load.kind === 'nodal' && point && <NodalSymbol load={load} point={point} index={index} id={id} />}
        {load.kind === 'point' && geometry && <PointSymbol load={load} angle={geometry.angle} index={index}
          point={worldToScreen(toGlobal({ x: load.s, y: 0 }, geometry.frame), camera, viewport)} />}
        {load.kind === 'distributed' && geometry && <DistributedSymbol load={load} frame={geometry.frame}
          index={index} camera={camera} viewport={viewport} />}
      </>
  }
  return <g className="load-layer">
    {model.loads.map(load => {
      const owner = loadTarget(load)
      const index = indices.get(owner.id) ?? 0
      indices.set(owner.id, index + 1)
      return <g key={load.id} data-load-id={load.id} data-load-kind={load.kind}
        className={`load-symbol${activeId === load.id || selectedIds.has(load.id) ? ' is-selected' : ''}`}>
        <title>{load.id} · {owner.id}</title>
        {symbol(load, index, load.id)}
      </g>
    })}
    {draft && <g className="load-symbol is-draft" data-load-preview={draft.kind}>{symbol(draft, 0, 'Vista previa')}</g>}
  </g>
})
