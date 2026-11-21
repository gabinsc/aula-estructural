import type { Point } from '../../geometry/coordinates'
import { degrees, fromGlobal, subtract } from '../../geometry/coordinates'
import { worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import { formatNumber } from '../format'
import type { Editor } from '../tools/editor'

export type DimensionMode = 'hidden' | 'selection' | 'all'

export function measureBar(start: Point, end: Point, ucsAngle: number) {
  const delta = subtract(end, start)
  const ucs = fromGlobal(delta, { origin: { x: 0, y: 0 }, angle: ucsAngle })
  return { delta, ucs, length: Math.hypot(delta.x, delta.y), angle: Math.atan2(delta.y, delta.x),
    ucsAngle: Math.atan2(ucs.y, ucs.x) }
}

function text(point: Point, value: string) {
  return <text x={point.x} y={point.y} textAnchor="middle">{value}</text>
}

function Dimension({ a, b, start, end, angle, temporary }: {
  a: Point; b: Point; start: Point; end: Point; angle: number; temporary: boolean
}) {
  const measure = measureBar(start, end, angle)
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const f = (n: number) => formatNumber(Math.abs(n) < 1e-10 ? 0 : n, 4)
  const theta = measure.length ? `${f(degrees(measure.angle))}°` : '—'
  const projection = `ΔX ${f(measure.delta.x)} m · ΔY ${f(measure.delta.y)} m`
  const n = span ? { x: (b.y - a.y) / span, y: (a.x - b.x) / span } : { x: 0, y: -1 }
  const side = n.y > 0 ? -1 : 1
  const shift = (p: Point, offset: number) => ({ x: p.x + n.x * side * offset, y: p.y + n.y * side * offset })
  const first = shift(a, 18)
  const last = shift(b, 18)
  const label = shift(center, 26)
  return <g data-cad-dimension={temporary ? 'preview' : 'bar'} className={temporary ? 'dimension-draft' : undefined}>
    {span >= 18 && <>
      <line x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
      {[first, last].map((p, index) => <path key={index} d={`M${p.x - 3} ${p.y + 4}l6 -8`} />)}
      <path className="dimension-projection" d={`M${a.x} ${a.y}H${b.x}V${b.y}`} />
    </>}
    {text(label, `L ${f(measure.length)} m · θ ${theta}${angle ? ' global' : ''}`)}
    {(temporary || span > 115) && text({ x: label.x, y: label.y - 14 }, projection + (angle ? ' · global' : ''))}
    {temporary && angle !== 0 && text({ x: label.x, y: label.y - 28 },
      `UCS · ΔX ${f(measure.ucs.x)} m · ΔY ${f(measure.ucs.y)} m · θ ${measure.length ? f(degrees(measure.ucsAngle)) + '°' : '—'}`)}
  </g>
}

export function Dimensions({ editor, camera, viewport, mode, destination }: {
  editor: Editor; camera: Camera; viewport: Viewport; mode: DimensionMode; destination?: Point
}) {
  const { model, interaction, selection, ucs } = editor
  const nodes = new Map(model.nodes.map(node => [node.id, node]))
  const selected = new Set(selection.filter(item => item.kind === 'bar').map(item => item.id))
  const physicalStart = interaction.tool === 'bar' && interaction.stage === 'end' ? interaction.start.point : null
  const toScreen = (point: Point) => worldToScreen(point, camera, viewport)
  const used = new Set<string>()
  if (physicalStart && destination) {
    const a = toScreen(physicalStart)
    const b = toScreen(destination)
    used.add(`${Math.floor((a.x + b.x) / 2 / 170)}:${Math.floor((a.y + b.y) / 2 / 55)}`)
  }
  const existing = mode === 'hidden' ? [] : model.bars.filter(bar => mode === 'all' || selected.has(bar.id))
    .sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)))
  return <g className="cad-dimensions" aria-hidden="true">
    {existing.map(bar => {
      const start = nodes.get(bar.startId)!
      const end = nodes.get(bar.endId)!
      const a = toScreen(start)
      const b = toScreen(end)
      const x = (a.x + b.x) / 2
      const y = (a.y + b.y) / 2
      const key = `${Math.floor(x / 170)}:${Math.floor(y / 55)}`
      if (x < 28 || x > viewport.width || y < 35 || y > viewport.height || used.has(key) ||
        (!selected.has(bar.id) && Math.hypot(b.x - a.x, b.y - a.y) < 28)) return null
      used.add(key)
      return <Dimension key={bar.id} a={a} b={b} start={start} end={end} angle={ucs.angle} temporary={false} />
    })}
    {physicalStart && destination && <Dimension a={toScreen(physicalStart)} b={toScreen(destination)}
      start={physicalStart} end={destination} angle={ucs.angle} temporary />}
  </g>
}
