export interface Point {
  readonly x: number
  readonly y: number
}

export interface CoordinateFrame {
  readonly origin: Point
  readonly angle: number
}

export const GLOBAL_FRAME: CoordinateFrame = { origin: { x: 0, y: 0 }, angle: 0 }
export const GEOMETRIC_TOLERANCE = 1e-8
export const MAX_COORDINATE = 1e9

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y }
}

/** Traslada un punto por el mismo vector que lleva la referencia hasta su destino. */
export function translateFromReference(point: Point, reference: Point, destination: Point): Point {
  return add(destination, subtract(point, reference))
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function isModelPoint(point: Point): boolean {
  return Math.abs(point.x) <= MAX_COORDINATE && Math.abs(point.y) <= MAX_COORDINATE
}

export function radians(degrees: number): number {
  return degrees * Math.PI / 180
}

export function degrees(angle: number): number {
  return angle * 180 / Math.PI
}

function rotate(point: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: cos * point.x - sin * point.y, y: sin * point.x + cos * point.y }
}

/** Convierte coordenadas métricas locales a coordenadas físicas globales. */
export function toGlobal(point: Point, frame: CoordinateFrame = GLOBAL_FRAME): Point {
  return add(frame.origin, rotate(point, frame.angle))
}

/** Invierte la traslación y la rotación de un sistema de trabajo o de barra. */
export function fromGlobal(point: Point, frame: CoordinateFrame = GLOBAL_FRAME): Point {
  return rotate(subtract(point, frame.origin), -frame.angle)
}

export function relativeToGlobal(reference: Point, offset: Point, axisAngle = 0): Point {
  return toGlobal(offset, { origin: reference, angle: axisAngle })
}

/** El ángulo polar se mide desde el eje X de referencia, en sentido antihorario. */
export function polarToGlobal(reference: Point, radius: number, angle: number, axisAngle = 0): Point {
  return relativeToGlobal(reference, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }, axisAngle)
}

export function barGeometry(start: Point, end: Point) {
  const delta = subtract(end, start)
  const length = Math.hypot(delta.x, delta.y)
  if (length <= GEOMETRIC_TOLERANCE) return null
  const angle = Math.atan2(delta.y, delta.x)
  const frame: CoordinateFrame = { origin: start, angle }
  return { length, angle, frame }
}
