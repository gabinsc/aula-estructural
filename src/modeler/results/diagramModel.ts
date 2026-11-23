import { evaluateFrameSection } from '../../analysis'
import type { AnalysisResult, BarResult, FrameSection } from '../../analysis'
import { worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import type { Point } from '../../geometry/coordinates'
import type { Structure } from '../../domain/structure'
import { buildFrameFields, EFFORTS, isEffortJump } from './diagramFields'
import type { Effort, FrameFields, SectionCut } from './diagramFields'
import { developedSpans, developedValue, jointJumps } from './developedSpan'
import type { DevelopedMember } from './developedSpan'

export type SolvedAnalysis = Extract<AnalysisResult, { ok: true }>
export const AVM_VIEWS = [
  { key: 'model', label: 'Modelo' }, { key: 'N', label: 'A · Axial' }, { key: 'V', label: 'V · Cortante' },
  { key: 'M', label: 'M · Momento' }, { key: 'combined', label: 'AVM · Combinada' }, { key: 'deformed', label: 'Deformada' },
] as const
export type AVMView = typeof AVM_VIEWS[number]['key']
export type AVMPresentation = 'auto' | 'developed' | 'compact'
export const EFFORT_UNIT = { N: 'kN', V: 'kN', M: 'kN·m' } as const
export const BASE_HEIGHT = { N: 54, V: 76, M: 98 } as const
export const DEFAULT_PREFERENCES = { view: 'model' as AVMView, loads: true, reactions: false, labels: true,
  geometry: true, deformed: true, query: false, amplitude: 1, amplification: null as number | null,
  decimals: 2, extremes: true, ids: true, automaticLabels: true, presentation: 'auto' as AVMPresentation }
export type AVMPreferences = typeof DEFAULT_PREFERENCES
export const MAX_AMPLIFICATION = 1e12
const ZERO_DISPLACEMENT = 1e-12

export interface PlotMember {
  readonly id: string
  readonly startId: string
  readonly endId: string
  readonly bar: BarResult
  readonly start: Point
  readonly end: Point
  readonly tangent: Point
  readonly length: number
  readonly startDisplacement: Point
  readonly endDisplacement: Point
  readonly fields?: FrameFields
}

export interface DiagramModel {
  readonly members: readonly PlotMember[]
  readonly maxima: Readonly<Record<Effort, number>>
  readonly deformationReference: number
  readonly modelSpan: number
  readonly activeLoadIds: ReadonlySet<string>
  readonly orientations: ReadonlyMap<string, DevelopedMember>
  readonly joints: Readonly<Record<Effort, ReturnType<typeof jointJumps>>>
}

export function activeEfforts(view: AVMView): readonly Effort[] {
  if (view === 'model' || view === 'deformed' || view === 'combined') return []
  return [view]
}

export function buildDiagramModel(model: Structure, result: SolvedAnalysis): DiagramModel {
  const nodes = new Map(model.nodes.map(node => [node.id, node]))
  const displacements = new Map(result.displacements.map(item => [item.nodeId, item]))
  const bars = new Map(model.bars.map(bar => [bar.id, bar]))
  const maxima = { N: 0, V: 0, M: 0 }
  let deformationReference = result.displacements.reduce((max, { x, y }) => Math.max(max, Math.hypot(x, y)), 0)
  let modelSpan = 0
  const members = result.bars.map((bar): PlotMember => {
    const geometry = bars.get(bar.barId)!
    const start = nodes.get(geometry.startId)!, end = nodes.get(geometry.endId)!
    const startDisplacement = displacements.get(geometry.startId)!, endDisplacement = displacements.get(geometry.endId)!
    const dx = end.x - start.x, dy = end.y - start.y
    const length = bar.kind === 'frame2d' ? bar.length : Math.hypot(dx, dy)
    modelSpan = Math.max(modelSpan, length)
    const member = { id: bar.barId, bar, startId: geometry.startId, endId: geometry.endId,
      start, end, length, tangent: { x: dx / length, y: dy / length },
      startDisplacement, endDisplacement }
    if (bar.kind !== 'frame2d') {
      maxima.N = Math.max(maxima.N, Math.abs(bar.axialForce))
      return member
    }
    const fields = buildFrameFields(bar)
    for (const field of EFFORTS) for (const { section } of fields.marks[field]) {
      maxima[field] = Math.max(maxima[field], Math.abs(section[field]))
    }
    // La referencia solo decide la amplificación visual. La trayectoria usa el campo de sección.
    for (const { start, first, second, end } of fields.intervals) {
      const ds = end.s - start.s
      for (const cut of [start, first, second, end, evaluateFrameSection(bar, start.s + ds / 6),
        evaluateFrameSection(bar, start.s + ds / 2), evaluateFrameSection(bar, end.s - ds / 6)]) {
        deformationReference = Math.max(deformationReference, Math.hypot(cut.u, cut.v))
      }
    }
    return { ...member, fields }
  })
  const spans = developedSpans(members)
  const orientations = new Map(spans.flatMap(span => span.map(step => [step.member.id, step] as const)))
  const joints = { N: spans.flatMap(span => jointJumps(span, 'N', maxima.N)),
    V: spans.flatMap(span => jointJumps(span, 'V', maxima.V)), M: spans.flatMap(span => jointJumps(span, 'M', maxima.M)) }
  return { members, maxima, deformationReference, modelSpan, activeLoadIds: new Set(result.loads.map(load => load.id)), orientations, joints }
}

export function deformationFactor(model: DiagramModel, manual: number | null) {
  if (model.deformationReference <= ZERO_DISPLACEMENT || !Number.isFinite(model.deformationReference)) return 0
  return manual ?? Math.min(MAX_AMPLIFICATION, .18 * model.modelSpan / model.deformationReference)
}

function interpolate(a: Point, b: Point, t: number): Point {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
}

export function memberPoint(member: PlotMember, s: number): Point {
  return interpolate(member.start, member.end, s / member.length)
}

export function memberDisplacement(member: PlotMember, s: number): Point {
  if (s === 0) return member.startDisplacement
  if (s === member.length) return member.endDisplacement
  if (member.bar.kind !== 'frame2d') return interpolate(member.startDisplacement, member.endDisplacement, s / member.length)
  const { u, v } = evaluateFrameSection(member.bar, s)
  const { x: c, y: sn } = member.tangent
  return { x: c * u - sn * v, y: sn * u + c * v }
}

export function deformedPoint(member: PlotMember, s: number, factor: number): Point {
  const base = memberPoint(member, s)
  const vector = memberDisplacement(member, s)
  return { x: base.x + factor * vector.x, y: base.y + factor * vector.y }
}

/** Proyecta la base física y añade una ordenada gráfica en píxeles CSS. */
export function diagramPoint(member: PlotMember, s: number, height: number, camera: Camera, viewport: Viewport): Point {
  const base = worldToScreen(memberPoint(member, s), camera, viewport)
  return { x: base.x - member.tangent.y * height, y: base.y - member.tangent.x * height }
}

export function effortHeight(field: Effort, value: number, max: number, amplitude: number) {
  return max > 0 ? BASE_HEIGHT[field] * amplitude * (value / max) : 0
}

export function jumpAt(diagram: DiagramModel, field: Effort, barId: string, s: number) {
  return diagram.joints[field].find(item => (item.left.member.id === barId && item.leftS === s) ||
    (item.right.member.id === barId && item.rightS === s))
}

/** Ordenadas de Bézier en t=⅓ y t=⅔. El campo original es de grado ≤ 3. */
export function bezierControls(a: number, atThird: number, atTwoThirds: number, b: number) {
  const first = 27 * atThird - 8 * a - b
  const second = 27 * atTwoThirds - a - 8 * b
  return [(2 * first - second) / 18, (2 * second - first) / 18] as const
}

export const xy = ({ x, y }: Point) => `${x} ${y}`

/** Forma SVG común para CAD y franjas, con un segmento recto explícito en cada salto. */
export function effortCurve(member: PlotMember, field: Effort,
  ordinate: (value: number) => number, project: (s: number, ordinate: number) => Point, reference: number): string | undefined {
  const intervals = member.fields?.intervals
  if (!intervals) {
    if (field !== 'N') return
    const h = ordinate(member.bar.axialForce)
    return `M ${xy(project(0, h))} L ${xy(project(member.length, h))}`
  }
  return intervals.map(({ start, first, second, end }, i) => {
    const from = ordinate(start[field]), to = ordinate(end[field])
    const [c1, c2] = bezierControls(from, ordinate(first[field]), ordinate(second[field]), to)
    const ds = (end.s - start.s) / 3
    const previous = intervals[i - 1]?.end[field]
    const jump = previous !== undefined && member.fields!.jumps.has(start.s) && isEffortJump(previous, start[field], reference)
    const anchor = i === 0 ? `M ${xy(project(start.s, from))} `
      : jump ? ` L ${xy(project(start.s, from))} ` : ' '
    return `${anchor}C ${xy(project(start.s + ds, c1))} ${xy(project(end.s - ds, c2))} ${xy(project(end.s, to))}`
  }).join('')
}

function effortAt(member: PlotMember, s: number) {
  if (member.bar.kind !== 'frame2d') return [{ N: member.bar.axialForce }]
  const section = evaluateFrameSection(member.bar, s)
  return member.fields?.jumps.has(s) ? [evaluateFrameSection(member.bar, s, 'left'), section] : [section]
}

function distanceToRange(value: number, samples: readonly number[]) {
  return Math.max(0, Math.min(...samples) - value, value - Math.max(...samples))
}

/** El clic se proyecta sobre el eje original y se comprueba su cercanía al campo vigente. */
export function pickDiagram(model: DiagramModel, fields: readonly Effort[], amplitude: number,
  point: Point, camera: Camera, viewport: Viewport): SectionCut | undefined {
  let closest: { cut: SectionCut; distance: number } | undefined
  for (const member of model.members) {
    const applicable = member.bar.kind === 'frame2d' ? fields : fields.filter(field => field === 'N')
    if (!applicable.length) continue
    const a = worldToScreen(member.start, camera, viewport)
    const dx = point.x - a.x, dy = point.y - a.y
    const { x: c, y: sn } = member.tangent
    const along = c * dx - sn * dy
    const normal = -sn * dx - c * dy
    if (along < -8 || along > member.length * camera.scale + 8) continue
    const raw = Math.max(0, Math.min(member.length, along / camera.scale))
    let s = raw
    let snapDistance = 7
    for (const station of member.fields?.stations ?? [0, member.length]) {
      const distance = Math.abs(station - raw) * camera.scale
      if (distance <= snapDistance) { s = station; snapDistance = distance }
    }
    // En un salto se admite la línea vertical que une sus dos valores.
    const registered: readonly Partial<FrameSection>[] = effortAt(member, s)
    const orientation = model.orientations.get(member.id)!
    let displacement = Math.abs(normal)
    for (const field of applicable) {
      const joint = jumpAt(model, field, member.id, s)
      const values = joint ? [joint.before, joint.after] : registered.map(section => developedValue(orientation, field, section[field]!))
      const heights = values.map(value => (orientation.reversed ? -1 : 1) * effortHeight(field, value, model.maxima[field], amplitude))
      displacement = Math.min(displacement, distanceToRange(normal, heights))
    }
    const distance = Math.hypot(displacement, (s * camera.scale - along))
    if (distance <= 10 && (!closest || distance < closest.distance)) {
      closest = { distance, cut: { barId: member.id, s, side: s === member.length ? 'left' : 'right', source: 'canvas' } }
    }
  }
  return closest?.cut
}
