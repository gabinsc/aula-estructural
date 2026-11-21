import type { GeometrySelection, Selection, Structure } from '../../domain/structure'
import { worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import { distance } from '../../geometry/coordinates'
import type { Point } from '../../geometry/coordinates'
import { distanceToSegment, nearest } from '../../geometry/picking'
import { segmentIntersection } from '../../geometry/segments'

const NODE_RADIUS = 10
const BAR_RADIUS = 7

export function findNodeAt(model: Structure, point: Point, camera: Camera, viewport: Viewport, radius = NODE_RADIUS) {
  return nearest(model.nodes, node => distance(point, worldToScreen(node, camera, viewport)), radius)
}

export interface SelectionBox {
  readonly start: Point
  readonly end: Point
}

/** Los nudos tienen prioridad sobre las barras que pasan bajo el puntero. */
export function selectionAt(model: Structure, point: Point, camera: Camera, viewport: Viewport): GeometrySelection | null {
  const node = findNodeAt(model, point, camera, viewport)
  if (node) return { kind: 'node', id: node.id }

  const positions = new Map(model.nodes.map(node => [node.id, worldToScreen(node, camera, viewport)]))
  const bar = nearest(model.bars, bar => {
    const a = positions.get(bar.startId)
    const b = positions.get(bar.endId)
    return a && b ? distanceToSegment(point, a, b) : Infinity
  }, BAR_RADIUS)
  return bar ? { kind: 'bar', id: bar.id } : null
}

export function selectionWindow(box: SelectionBox) {
  const left = Math.min(box.start.x, box.end.x)
  const right = Math.max(box.start.x, box.end.x)
  const top = Math.min(box.start.y, box.end.y)
  const bottom = Math.max(box.start.y, box.end.y)
  const a = { x: left, y: top }
  const b = { x: right, y: top }
  const c = { x: right, y: bottom }
  const d = { x: left, y: bottom }
  const edges = [{ start: a, end: b }, { start: b, end: c }, { start: c, end: d }, { start: d, end: a }]
  const crossing = box.start.x > box.end.x
  const contains = (p: Point) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom
  const intersects = (start: Point, end: Point) =>
    contains(start) || contains(end) || edges.some(edge => segmentIntersection({ start, end }, edge))
  return { crossing, contains, intersects }
}

/** De izquierda a derecha exige inclusión total. En sentido inverso admite barras que cruzan el borde. */
export function selectionInBox(model: Structure, box: SelectionBox, camera: Camera, viewport: Viewport): Selection[] {
  const { crossing, contains, intersects } = selectionWindow(box)
  const points = new Map(model.nodes.map(node => [node.id, worldToScreen(node, camera, viewport)]))
  const items: Selection[] = []
  for (const [id, point] of points) {
    if (contains(point)) items.push({ kind: 'node', id })
  }
  for (const bar of model.bars) {
    const start = points.get(bar.startId)
    const end = points.get(bar.endId)
    if (!start || !end) continue
    const inside = crossing
      ? intersects(start, end)
      : contains(start) && contains(end)
    if (inside) items.push({ kind: 'bar', id: bar.id })
  }
  return items
}
