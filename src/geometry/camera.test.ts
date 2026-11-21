import { describe, expect, it } from 'vitest'
import { DEFAULT_CAMERA, fitCamera, panCamera, screenToWorld, worldToScreen, zoomCamera } from './camera'

const viewport = { width: 1409, height: 975 }

describe('Cámara CAD', () => {
  it('invierte el eje Y y recupera las coordenadas métricas', () => {
    const sample = { x: -7.125, y: 2.5 }
    const pixel = worldToScreen(sample, DEFAULT_CAMERA, viewport)
    expect(pixel.y).toBeLessThan(viewport.height / 2)
    expect(screenToWorld(pixel, DEFAULT_CAMERA, viewport)).toEqual(sample)
  })

  it('mantiene fijo el punto global bajo el cursor después de varios zooms', () => {
    const anchor = { x: 260.25, y: 618.125 }
    const world = screenToWorld(anchor, DEFAULT_CAMERA, viewport)
    const camera = [1.4, 2, 0.2, 1.3, 0.7].reduce(
      (view, factor) => zoomCamera(view, viewport, anchor, factor), DEFAULT_CAMERA,
    )
    const pixel = worldToScreen(world, camera, viewport)
    expect(pixel.x).toBeCloseTo(anchor.x, 10)
    expect(pixel.y).toBeCloseTo(anchor.y, 10)
  })

  it('desplaza la pantalla en píxeles y mantiene la precisión métrica después de zoom y pan', () => {
    const world = { x: -45.123456789, y: 24.789123456 }
    const anchor = { x: 401, y: 790 }
    const zoomed = zoomCamera(DEFAULT_CAMERA, viewport, anchor, 7)
    const delta = { x: -127.5, y: 731.125 }
    const panned = panCamera(zoomed, delta)
    const before = worldToScreen(world, zoomed, viewport)
    const after = worldToScreen(world, panned, viewport)
    expect(after.x - before.x).toBeCloseTo(delta.x, 9)
    expect(after.y - before.y).toBeCloseTo(delta.y, 9)
    const recovered = screenToWorld(after, panned, viewport)
    expect(recovered.x).toBeCloseTo(world.x, 12)
    expect(recovered.y).toBeCloseTo(world.y, 12)
  })

  it('ajusta los extremos al lienzo y admite el modelo vacío y un solo nudo', () => {
    const points = [{ x: -180, y: 5 }, { x: 400, y: 5 }]
    const camera = fitCamera(points, viewport)
    const projected = points.map(point => worldToScreen(point, camera, viewport))
    expect(projected[0]?.x).toBeCloseTo(0.11 * viewport.width, 9)
    expect(projected[1]?.x).toBeCloseTo(0.89 * viewport.width, 9)
    expect(fitCamera([], viewport)).toBe(DEFAULT_CAMERA)
    const point = { x: 3, y: 8 }
    expect(worldToScreen(point, fitCamera([point], viewport), viewport)).toEqual({ x: 704.5, y: 487.5 })
  })
})
