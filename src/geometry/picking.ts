import type { Point } from './coordinates'
import { segmentProjection } from './segments'

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const { direction, offset, u } = segmentProjection(point, { start, end })
  const fraction = Math.max(0, Math.min(1, u))
  return Math.hypot(offset.x - fraction * direction.x, offset.y - fraction * direction.y)
}

/** Selecciona el candidato más cercano dentro del radio indicado. Los empates conservan el orden. */
export function nearest<T>(items: readonly T[], measure: (item: T) => number, radius: number): T | undefined {
  let match: T | undefined
  let best = radius
  for (const item of items) {
    const separation = measure(item)
    if (separation <= best && (match === undefined || separation < best)) {
      best = separation
      match = item
    }
  }
  return match
}
