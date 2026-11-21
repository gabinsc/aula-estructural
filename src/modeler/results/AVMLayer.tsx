import { memo, useId } from 'react'
import { evaluateFrameSection } from '../../analysis'
import type { Structure } from '../../domain/structure'
import { worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import type { Point } from '../../geometry/coordinates'
import { resultNumber } from '../../app/results/ResultTable'
import type { Effort, SectionCut } from './diagramFields'
import { activeEfforts, deformationFactor, deformedPoint, diagramPoint, effortCurve, effortHeight, EFFORT_UNIT, jumpAt, xy } from './diagramModel'
import type { AVMPreferences, DiagramModel, PlotMember, SolvedAnalysis } from './diagramModel'
import { developedValue } from './developedSpan'
import type { DevelopedMember } from './developedSpan'

export interface Overlay {
  readonly preferences: AVMPreferences
  readonly diagram?: DiagramModel
  readonly result?: SolvedAnalysis
  readonly cut?: SectionCut
  readonly selectedId?: string
  readonly learning: boolean
  readonly pick: (cut: SectionCut) => void
}

type Projection = { camera: Camera; viewport: Viewport }

function EffortPlot({ step, field, max, preferences, emphasized, camera, viewport }: Projection & {
  step: DevelopedMember; field: Effort; max: number; preferences: AVMPreferences; emphasized: boolean
}) {
  const { member, reversed } = step
  if (!member.fields && field !== 'N') return null
  const { amplitude, labels } = preferences
  const plot = (s: number, height: number) => diagramPoint(member, s, reversed ? -height : height, camera, viewport)
  const heightOf = (value: number) => effortHeight(field, developedValue(step, field, value), max, amplitude)
  const a = plot(0, 0), b = plot(member.length, 0)
  const path = effortCurve(member, field, heightOf, plot, max)
  if (!path) return null
  const candidates = member.fields ? member.fields.marks[field].map(({ section, kind }) => ({
    s: section.s, value: section[field], priority: kind === 'jump' ? 2 : kind === 'critical' ? 1 : 0,
  })) : [{ s: member.length / 2, value: member.bar.axialForce, priority: 1 }]
  const marks: { point: Point; value: number; s: number }[] = []
  if (labels) for (const candidate of candidates.sort((x, y) => y.priority - x.priority || Math.abs(y.value) - Math.abs(x.value))) {
    const { s, value } = candidate
    const point = plot(s, heightOf(value))
    if (point.x < 30 || point.x > viewport.width - 24 || point.y < 35 || point.y > viewport.height - 14) continue
    if (marks.some(mark => Math.abs(mark.point.x - point.x) < 54 && Math.abs(mark.point.y - point.y) < 18)) continue
    if (marks.length >= 8) break
    marks.push({ point, value, s })
  }
  return <g data-effort={field} data-avm-bar={member.id} className={emphasized ? 'avm-emphasized' : undefined}>
    <path className="avm-area" d={`${path} L ${xy(b)} L ${xy(a)} Z`} />
    <path className="avm-line" d={path} />
    {marks.map(({ point, value, s }, i) => {
      const formatted = Math.abs(value) <= max * 64 * Number.EPSILON ? '0' :
        resultNumber(developedValue(step, field, value), .001)
      return <g key={i} data-avm-mark={s}><circle cx={point.x} cy={point.y} r={2.3} />
        <text x={point.x} y={point.y - 7} textAnchor="middle">{formatted}</text></g>
    })}
  </g>
}

function deformedPath(member: PlotMember, factor: number, { camera, viewport }: Projection) {
  const intervals = member.fields?.intervals.map(({ end }) => end.s) ?? [member.length]
  const project = (s: number) => worldToScreen(deformedPoint(member, s, factor), camera, viewport)
  const points = [project(0)]
  function refine(a: number, start: Point, b: number, end: Point, depth: number) {
    if (member.fields && depth < 8) {
      const curved = [.2, .4, .6, .8].some(t => {
        const point = project(a + (b - a) * t)
        return Math.hypot(point.x - (start.x + (end.x - start.x) * t),
          point.y - (start.y + (end.y - start.y) * t)) > .45
      })
      if (curved) {
        const middle = a + (b - a) / 2
        const knot = project(middle)
        refine(a, start, middle, knot, depth + 1)
        refine(middle, knot, b, end, depth + 1)
        return
      }
    }
    points.push(end)
  }
  let a = 0
  for (const b of intervals) {
    refine(a, points.at(-1)!, b, project(b), 0)
    a = b
  }
  return points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)) ? `M ${points.map(xy).join(' L ')}` : ''
}

export const AVMLayer = memo(function AVMLayer({ model, overlay, camera, viewport }: Projection & {
  model: Structure; overlay: Overlay
}) {
  const arrow = useId()
  const { diagram, result, preferences, selectedId, cut } = overlay
  if (!result) return null
  const { view, reactions, labels, deformed } = preferences
  if ((view === 'model' || view === 'combined') && !reactions) return null
  const fields = activeEfforts(view)
  const factor = diagram && view === 'deformed' && deformed ? deformationFactor(diagram, preferences.amplification) : 0
  const selected = diagram?.members.find(member => member.id === cut?.barId)
  const marker = cut && selected && fields.length ? diagramPoint(selected, cut.s, 0, camera, viewport) : undefined
  const markerSection = marker && cut && selected?.bar.kind === 'frame2d' ? evaluateFrameSection(selected.bar, cut.s, cut.side) : undefined
  const positions = new Map(model.nodes.map(node => [node.id, node]))
  const forceMax = reactions ? result.reactions.reduce((max, row) => Math.max(max, Math.hypot(row.x, row.y)), 0) : 0
  const momentMax = reactions ? result.reactions.reduce((max, row) => Math.max(max, Math.abs(row.moment ?? 0)), 0) : 0
  return <g className="avm-layer" data-avm-layer={view} aria-hidden="true" pointerEvents="none">
    {diagram && fields.flatMap(field => diagram.members.map(member =>
      <EffortPlot key={`${field}:${member.id}`} step={diagram.orientations.get(member.id)!} field={field} max={diagram.maxima[field]}
        preferences={preferences} emphasized={selectedId === member.id} camera={camera} viewport={viewport} />))}
    {diagram && fields.map(field => <g data-effort={field} key={field}>
      {diagram.joints[field].map(({ nodeId, left, leftS, before, after }) => {
        const at = (value: number) => diagramPoint(left.member, leftS,
          (left.reversed ? -1 : 1) * effortHeight(field, value, diagram.maxima[field], preferences.amplitude), camera, viewport)
        const a = at(before), b = at(after)
        return <line className="avm-line" key={nodeId} data-avm-joint-jump={nodeId} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      })}
    </g>)}
    {factor > 0 && <g className="avm-deform" data-deformation-factor={factor}>
      {diagram?.members.map(member => <path key={member.id} data-deformed-bar={member.id}
        d={deformedPath(member, factor, { camera, viewport })} />)}
      {result.displacements.map(node => {
        const base = positions.get(node.nodeId)!
        const point = worldToScreen({ x: base.x + factor * node.x, y: base.y + factor * node.y }, camera, viewport)
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
        const angle = node.rotation !== undefined && Math.abs(node.rotation) > 1e-12 ? Math.atan(factor * node.rotation) : 0
        return <g key={node.nodeId}>
          {angle !== 0 && <line className="avm-rotation" data-deformed-rotation={node.nodeId}
            x1={point.x - 7 * Math.cos(angle)} y1={point.y + 7 * Math.sin(angle)}
            x2={point.x + 7 * Math.cos(angle)} y2={point.y - 7 * Math.sin(angle)} />}
          <circle data-deformed-node={node.nodeId} cx={point.x} cy={point.y} r={3.5} />
        </g>
      })}
    </g>}
    {reactions && <g className="avm-reactions">
      <defs><marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 Z" />
      </marker></defs>
      {result.reactions.map(row => {
        const force = Math.hypot(row.x, row.y), moment = row.moment ?? 0
        const hasForce = force > forceMax * 1e-10
        const hasMoment = Math.abs(moment) > momentMax * 1e-10
        if (!hasForce && !hasMoment) return null
        const a = worldToScreen(positions.get(row.nodeId)!, camera, viewport)
        const b = { x: a.x + 53 * (row.x / (forceMax || 1)), y: a.y - 53 * (row.y / (forceMax || 1)) }
        const radius = 10 + 12 * Math.sqrt(Math.abs(moment) / (momentMax || 1))
        const direction = moment > 0 ? 0 : 1
        return <g key={row.nodeId} data-reaction-node={row.nodeId}>
          {hasForce && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={`url(#${arrow})`} />}
          {hasMoment && <path d={`M ${a.x + radius} ${a.y} A ${radius} ${radius} 0 1 ${direction} ${a.x} ${a.y + (moment > 0 ? radius : -radius)}`}
            markerEnd={`url(#${arrow})`} />}
          {labels && <text x={Math.max(a.x, b.x) + 7} y={Math.min(a.y, b.y) - 8}>
            {hasForce ? `R (${resultNumber(row.x, .001)}, ${resultNumber(row.y, .001)}) kN` : ''}
            {hasMoment ? `${hasForce ? ' · ' : ''}Mz ${resultNumber(moment, .001)} kN·m` : ''}
          </text>}
        </g>
      })}
    </g>}
    {marker && cut && selected && <g className="avm-cut" data-cut-bar={cut.barId}>
      <circle cx={marker.x} cy={marker.y} r={5} />
      {fields.map(field => {
        if (selected.bar.kind !== 'frame2d' && field !== 'N') return null
        const step = diagram!.orientations.get(selected.id)!
        const value = developedValue(step, field, markerSection?.[field] ?? selected.bar.axialForce)
        const p = diagramPoint(selected, cut.s, (step.reversed ? -1 : 1) *
          effortHeight(field, value, diagram!.maxima[field], preferences.amplitude), camera, viewport)
        return <g key={field} data-effort={field}><line x1={marker.x} y1={marker.y} x2={p.x} y2={p.y} />
          <circle cx={p.x} cy={p.y} r={4} /></g>
      })}
    </g>}
  </g>
})

export const CutReadout = memo(function CutReadout({ overlay }: { overlay: Overlay }) {
  const { cut, diagram, preferences, learning } = overlay
  const fields = activeEfforts(preferences.view)
  const member = diagram?.members.find(item => item.id === cut?.barId)
  if (!cut || !member || !fields.length) return null
  const frame = member.bar.kind === 'frame2d' ? member.bar : undefined
  const jump = member.fields?.jumps.has(cut.s)
  const left = frame && evaluateFrameSection(frame, cut.s, 'left')
  const right = frame && (jump ? evaluateFrameSection(frame, cut.s, 'right') : left)
  const sources = frame?.loads.filter(load => load.kind === 'point' ? load.s <= cut.s : load.s0 < cut.s)
  return <output className="avm-readout" aria-label="Consulta en el diagrama">
    <strong>{cut.barId} · s = {resultNumber(cut.s)} m</strong>
    <span>{fields.map(field => {
      const joint = jumpAt(diagram!, field, cut.barId, cut.s)
      if (joint) return `${field} izq. ${resultNumber(joint.before, .001)} / der. ${resultNumber(joint.after, .001)} ${EFFORT_UNIT[field]}`
      if (!left || !right) return field === 'N' ? `N ${resultNumber(member.bar.axialForce, .001)} kN` : `${field} no aplicable`
      const step = diagram!.orientations.get(member.id)!
      const value = (number: number) => resultNumber(developedValue(step, field, number), .001)
      return `${field} ${jump ? `izq. ${value((step.reversed ? right : left)[field])} / der. ${value((step.reversed ? left : right)[field])}` :
        value(left[field])} ${EFFORT_UNIT[field]}`
    }).join(' · ')}</span>
    {learning && <small>{frame ? jump ? 'ΔN = −Px, ΔV = Py, M continuo'
      : 'N′ = −qx, V′ = qy, M′ = V' : 'Axial constante en la barra'}
      {!!sources?.length && ` · Cargas hasta el corte ${sources.map(load => load.id).join(', ')}`}</small>}
  </output>
})
