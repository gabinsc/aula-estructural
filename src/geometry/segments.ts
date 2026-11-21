import { subtract } from './coordinates'
import type { Point } from './coordinates'

export interface Segment {
  readonly start: Point
  readonly end: Point
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x
}

export function midpoint({ start, end }: Segment): Point {
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
}

/** La proyección ortogonal puede quedar fuera del tramo. El parámetro u vale 0 al inicio y 1 al final. */
export function segmentProjection(point: Point, { start, end }: Segment) {
  const direction = subtract(end, start)
  const offset = subtract(point, start)
  const squaredLength = direction.x ** 2 + direction.y ** 2
  const u = squaredLength ? (offset.x * direction.x + offset.y * direction.y) / squaredLength : 0
  return { direction, offset, u }
}

/** Intersección única de dos segmentos finitos. Los tramos colineales solapados no definen un punto. */
export function segmentIntersection(a: Segment, b: Segment): Point | null {
  if (Math.max(a.start.x, a.end.x) < Math.min(b.start.x, b.end.x)
      || Math.max(b.start.x, b.end.x) < Math.min(a.start.x, a.end.x)
      || Math.max(a.start.y, a.end.y) < Math.min(b.start.y, b.end.y)
      || Math.max(b.start.y, b.end.y) < Math.min(a.start.y, a.end.y)) return null

  const first = subtract(a.end, a.start)
  const second = subtract(b.end, b.start)
  const denominator = cross(first, second)
  if (Math.abs(denominator) <= Number.EPSILON * Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y)) return null

  const delta = subtract(b.start, a.start)
  const t = cross(delta, second) / denominator
  const u = cross(delta, first) / denominator
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a.start.x + first.x * t, y: a.start.y + first.y * t }
}
