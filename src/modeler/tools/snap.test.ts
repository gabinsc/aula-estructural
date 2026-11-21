import { describe, expect, it } from 'vitest'
import { createBar, EMPTY_STRUCTURE } from '../../domain/structure'
import { DEFAULT_CAMERA, panCamera, screenToWorld, worldToScreen, zoomCamera } from '../../geometry/camera'
import { buildObjectSnaps, DEFAULT_SNAP, resolveSnap, snapToGrid } from './snap'
import type { Endpoint, Edit } from '../../domain/structure'

function created<T>(operation: Edit<T>) {
  if ('error' in operation) throw new Error(operation.error)
  return operation
}

const end = (x: number, y: number): Endpoint => ({ point: { x, y } })
const firstBar = created(createBar(EMPTY_STRUCTURE, end(0, 1.25), end(8, 1.25)))
const crossBars = created(createBar(firstBar.model, end(2, -2), end(2, 4)))
const candidates = buildObjectSnaps(crossBars.model)

describe('Grid Snap y Object Snap', () => {
  it('ajusta (3,72; 5,36) a (4; 5) con el incremento predeterminado', () => {
    const result = resolveSnap({ x: 3.72, y: 5.36 }, 58, DEFAULT_SNAP, candidates)
    expect(result).toMatchObject({ kind: 'grid', point: { x: 4, y: 5 } })
  })

  it.each([0.1, 0.25, 0.5, 1])('ajusta en múltiplos de %s m con signo simétrico', step => {
    expect(snapToGrid({ x: -1.5 * step, y: 1.5 * step }, { x: step, y: step }))
      .toEqual({ x: -2 * step, y: 2 * step })
  })

  it('admite incrementos decimales personalizados por eje', () => {
    expect(snapToGrid({ x: 0.301, y: -0.866 }, { x: 0.075, y: 0.125 })).toEqual({ x: 0.3, y: -0.875 })
  })

  it('conserva la rejilla global al cambiar el zoom o el desplazamiento', () => {
    const viewport = { width: 980, height: 720 }
    const point = { x: 3.72, y: 5.36 }
    const zoomed = zoomCamera(DEFAULT_CAMERA, viewport, { x: 320, y: 120 }, 2)
    const panned = panCamera(zoomed, { x: -94, y: 70 })
    for (const camera of [DEFAULT_CAMERA, zoomed, panned]) {
      const recovered = screenToWorld(worldToScreen(point, camera, viewport), camera, viewport)
      expect(resolveSnap(recovered, camera.scale, DEFAULT_SNAP, candidates).point).toEqual({ x: 4, y: 5 })
    }
  })

  it.each([50, 500])('prioriza Object Snap dentro de 10 píxeles a %s px/m', scale => {
    const object = { x: 8, y: 1.25 }
    expect(resolveSnap({ x: object.x + 9.8 / scale, y: object.y }, scale, DEFAULT_SNAP, candidates))
      .toMatchObject({ kind: 'endpoint', nodeId: 'N2', point: object })
    expect(resolveSnap({ x: object.x + 10.2 / scale, y: object.y }, scale, DEFAULT_SNAP, candidates).kind)
      .toBe('grid')
  })

  it('resuelve puntos medios e intersecciones de segmentos sin crear uniones', () => {
    expect(resolveSnap({ x: 4.04, y: 1.31 }, 100, DEFAULT_SNAP, candidates))
      .toMatchObject({ kind: 'midpoint', point: { x: 4, y: 1.25 } })
    expect(resolveSnap({ x: 2.03, y: 1.27 }, 100, DEFAULT_SNAP, candidates))
      .toMatchObject({ kind: 'intersection', point: { x: 2, y: 1.25 } })
    expect(crossBars.model.nodes).toHaveLength(4)
    const extended = created(createBar(firstBar.model, end(9, -3), end(9, 4)))
    expect(buildObjectSnaps(extended.model).some(candidate => candidate.kind === 'intersection')).toBe(false)
  })

  it('conmuta los dos sistemas por separado y conserva el punto libre si ambos se desactivan', () => {
    const point = { x: 8.06, y: 1.25 }
    expect(resolveSnap(point, 100, { ...DEFAULT_SNAP, grid: false }, candidates).kind).toBe('endpoint')
    expect(resolveSnap(point, 100, { ...DEFAULT_SNAP, objects: false }, candidates).kind).toBe('grid')
    expect(resolveSnap(point, 100, { ...DEFAULT_SNAP, objects: false, grid: false }, candidates))
      .toMatchObject({ kind: 'free', point })
  })

  it('excluye durante un movimiento las referencias que dependen del nudo desplazado', () => {
    const moving = new Set(['N2', 'N3'])
    expect(resolveSnap({ x: 8.02, y: 1.25 }, 100, DEFAULT_SNAP, candidates, moving).kind).toBe('grid')
    expect(resolveSnap({ x: 4.02, y: 1.25 }, 100, DEFAULT_SNAP, candidates, moving).kind).toBe('grid')
    expect(resolveSnap({ x: 2.02, y: 1.25 }, 100, DEFAULT_SNAP, candidates, moving).kind).toBe('grid')
    expect(resolveSnap({ x: 2, y: -2 }, 100, DEFAULT_SNAP, candidates, moving).kind).toBe('grid')
    expect(resolveSnap({ x: 0.02, y: 1.25 }, 100, DEFAULT_SNAP, candidates, moving).kind).toBe('endpoint')
  })

  it('aplica únicamente las referencias habilitadas y admite dejarlas todas desactivadas', () => {
    const points = {
      endpoint: { x: 8.05, y: 1.25 }, midpoint: { x: 4.05, y: 1.25 }, intersection: { x: 2.03, y: 1.27 },
    }
    for (const kind of ['endpoint', 'midpoint', 'intersection'] as const) {
      const settings = { ...DEFAULT_SNAP, references: { ...DEFAULT_SNAP.references, [kind]: false } }
      expect(resolveSnap(points[kind], 100, settings, candidates).kind).toBe('grid')
    }
    const disabled = { ...DEFAULT_SNAP, references: { endpoint: false, midpoint: false, intersection: false } }
    expect(resolveSnap(points.endpoint, 100, disabled, candidates).kind).toBe('grid')
    expect(resolveSnap(points.endpoint, 100, { ...disabled, grid: false }, candidates).kind).toBe('free')
  })

  it('convierte la tolerancia configurada en píxeles a la apertura física de la cámara', () => {
    const point = { x: 8.14, y: 1.25 }
    expect(resolveSnap(point, 100, DEFAULT_SNAP, candidates).kind).toBe('grid')
    expect(resolveSnap(point, 100, { ...DEFAULT_SNAP, tolerancePx: 15 }, candidates).kind).toBe('endpoint')
    expect(resolveSnap(point, 200, { ...DEFAULT_SNAP, tolerancePx: 15 }, candidates).kind).toBe('grid')
  })
})
