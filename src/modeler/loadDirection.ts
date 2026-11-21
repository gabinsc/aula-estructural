import { degrees, radians } from '../geometry/coordinates'
import type { Point } from '../geometry/coordinates'

export const DEFAULT_LOAD_ANGLE = 270

export function normalizeDirection(angle: number): number {
  const remainder = angle % 360
  return remainder < 0 ? remainder + 360 : remainder || 0
}

export function forceComponents(magnitude: number, angle: number): Point {
  const direction = normalizeDirection(angle)
  if (direction === 0) return { x: magnitude, y: 0 }
  if (direction === 90) return { x: 0, y: magnitude }
  if (direction === 180) return { x: -magnitude, y: 0 }
  if (direction === 270) return { x: 0, y: -magnitude }
  return { x: magnitude * Math.cos(radians(direction)), y: magnitude * Math.sin(radians(direction)) }
}

export function forceDirectionAngle(vector: Point): number {
  return normalizeDirection(degrees(Math.atan2(vector.y, vector.x)))
}
