import type { Endpoint, Structure } from '../../domain/structure'
import { GEOMETRIC_TOLERANCE, MAX_COORDINATE, distance } from '../../geometry/coordinates'
import type { Point } from '../../geometry/coordinates'
import { nearest } from '../../geometry/picking'
import { midpoint, segmentIntersection } from '../../geometry/segments'

export const OBJECT_REFERENCES = ['endpoint', 'midpoint', 'intersection'] as const
export type ObjectReference = (typeof OBJECT_REFERENCES)[number]
export type SnapKind = ObjectReference | 'grid' | 'free'

export interface SnapSettings {
  readonly grid: boolean
  readonly objects: boolean
  readonly step: Point
  readonly references: Readonly<Record<ObjectReference, boolean>>
  readonly tolerancePx: number
}

export type SnapResult = Endpoint & { readonly kind: SnapKind }
type ObjectSnapCandidate = SnapResult & {
  readonly kind: ObjectReference
  readonly sourceNodes: readonly string[]
}

export const DEFAULT_SNAP: SnapSettings = {
  grid: true, objects: true, step: { x: 1, y: 1 }, tolerancePx: 10,
  references: { endpoint: true, midpoint: true, intersection: true },
}

export const SNAP_LABELS: Record<SnapKind, string> = {
  endpoint: 'Extremo', midpoint: 'Punto medio', intersection: 'Intersección', grid: 'Paso de cuadrícula', free: 'Libre',
}

export function isSnapStep(value: number): boolean {
  return value >= GEOMETRIC_TOLERANCE && value <= MAX_COORDINATE
}

export function isSnapTolerance(value: number): boolean {
  return value >= 1 && value <= 50
}

function snapAxis(value: number, step: number): number {
  const magnitude = Math.abs(value) / step
  const index = Math.round(magnitude + Number.EPSILON * Math.min(magnitude, 8))
  const [coefficient = '', exponent = '0'] = step.toString().split('e')
  const places = Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent))
  return Number((Math.sign(value) * index * step).toFixed(places)) || 0
}

/** Los múltiplos se miden desde el origen global, en metros. Los empates se alejan de cero. */
export function snapToGrid(point: Point, step: Point): Point {
  return { x: snapAxis(point.x, step.x), y: snapAxis(point.y, step.y) }
}

/** Las referencias fijas se recalculan al editar el documento. Nearest y Perpendicular requerirán el cursor. */
export function buildObjectSnaps(model: Pick<Structure, 'nodes' | 'bars'>): readonly ObjectSnapCandidate[] {
  const nodes = new Map(model.nodes.map(node => [node.id, node]))
  const segments = model.bars.flatMap(bar => {
    const start = nodes.get(bar.startId)
    const end = nodes.get(bar.endId)
    return start && end ? [{ start, end, sourceNodes: [start.id, end.id] }] : []
  })
  const endpoints: ObjectSnapCandidate[] = model.nodes.map(node => ({
    kind: 'endpoint', point: node, nodeId: node.id, sourceNodes: [node.id],
  }))
  const middles: ObjectSnapCandidate[] = segments.map(segment => ({
    kind: 'midpoint', point: midpoint(segment), sourceNodes: segment.sourceNodes,
  }))
  const intersections: ObjectSnapCandidate[] = []
  for (const [index, first] of segments.entries()) {
    for (let other = index + 1; other < segments.length; other++) {
      const second = segments[other]
      if (!second || first.sourceNodes.some(id => second.sourceNodes.includes(id))) continue
      const point = segmentIntersection(first, second)
      if (point) intersections.push({
        kind: 'intersection', point, sourceNodes: [...first.sourceNodes, ...second.sourceNodes],
      })
    }
  }
  return [...endpoints, ...intersections, ...middles]
}

/** Resuelve un único punto global usando la apertura de Object Snap en píxeles CSS. */
export function resolveSnap(
  point: Point, scale: number, settings: SnapSettings, candidates: readonly ObjectSnapCandidate[],
  excludedNodes?: ReadonlySet<string>,
): SnapResult {
  if (settings.objects) {
    const match = nearest(candidates, candidate => {
      if (!settings.references[candidate.kind] || candidate.sourceNodes.some(id => excludedNodes?.has(id))) return Infinity
      return distance(point, candidate.point)
    }, settings.tolerancePx / scale)
    if (match) return { point: match.point, kind: match.kind, nodeId: match.nodeId }
  }
  if (settings.grid) return { kind: 'grid', point: snapToGrid(point, settings.step) }
  return { kind: 'free', point }
}
