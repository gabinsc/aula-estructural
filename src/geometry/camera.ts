import { add, subtract } from './coordinates'
import type { Point } from './coordinates'

export interface Viewport {
  readonly width: number
  readonly height: number
}

export interface Camera {
  readonly center: Point
  readonly scale: number
}

export const DEFAULT_CAMERA: Camera = { center: { x: 0, y: 0 }, scale: 58 }
const MIN_SCALE = 1e-9
const MAX_SCALE = 1e5

function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))
}

/** Proyecta metros globales a píxeles CSS del lienzo, invirtiendo Y. */
export function worldToScreen(point: Point, camera: Camera, view: Viewport): Point {
  return {
    x: view.width / 2 + (point.x - camera.center.x) * camera.scale,
    y: view.height / 2 - (point.y - camera.center.y) * camera.scale,
  }
}

/** Recupera el punto físico bajo una posición expresada en píxeles CSS. */
export function screenToWorld(point: Point, camera: Camera, view: Viewport): Point {
  return {
    x: camera.center.x + (point.x - view.width / 2) / camera.scale,
    y: camera.center.y - (point.y - view.height / 2) / camera.scale,
  }
}

export function panCamera(camera: Camera, pixels: Point): Camera {
  return { ...camera, center: subtract(camera.center, { x: pixels.x / camera.scale, y: -pixels.y / camera.scale }) }
}

export function zoomCamera(camera: Camera, view: Viewport, anchor: Point, factor: number): Camera {
  const scaled = { ...camera, scale: clampScale(camera.scale * factor) }
  const correction = subtract(screenToWorld(anchor, camera, view), screenToWorld(anchor, scaled, view))
  return { ...scaled, center: add(camera.center, correction) }
}

export function fitCamera(points: readonly Point[], view: Viewport): Camera {
  const first = points[0]
  if (!first || view.width <= 0 || view.height <= 0) return DEFAULT_CAMERA
  let minX = first.x
  let maxX = first.x
  let minY = first.y
  let maxY = first.y
  for (const { x, y } of points) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    scale: clampScale(Math.min(
      DEFAULT_CAMERA.scale * 2,
      view.width * 0.78 / (maxX - minX),
      view.height * 0.78 / (maxY - minY),
    )),
  }
}
