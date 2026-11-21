import { describe, expect, it } from 'vitest'
import {
  barGeometry, fromGlobal, GLOBAL_FRAME, polarToGlobal, radians, relativeToGlobal, toGlobal,
} from './coordinates'

describe('Transformaciones físicas', () => {
  it('conserva coordenadas absolutas en el sistema global', () => {
    const point = { x: -1.375, y: 6.25 }
    expect(toGlobal(point)).toEqual(point)
    expect(fromGlobal(point, GLOBAL_FRAME)).toEqual(point)
  })

  it('transforma un UCS trasladado y rotado en ambas direcciones', () => {
    const frame = { origin: { x: 14, y: -7 }, angle: radians(90) }
    const world = toGlobal({ x: 4, y: 3 }, frame)
    expect(world.x).toBeCloseTo(11, 12)
    expect(world.y).toBeCloseTo(-3, 12)
    const local = fromGlobal(world, frame)
    expect(local.x).toBeCloseTo(4, 12)
    expect(local.y).toBeCloseTo(3, 12)
  })

  it('resuelve coordenadas relativas respecto de la referencia y los ejes elegidos', () => {
    const anchor = { x: 4, y: 5 }
    const offset = { x: 3, y: -2 }
    expect(relativeToGlobal(anchor, offset)).toEqual({ x: 7, y: 3 })
    expect(relativeToGlobal(anchor, offset, radians(90))).toEqual({ x: 6, y: 8 })
  })

  it('interpreta el ángulo polar desde X, positivo en sentido antihorario', () => {
    const point = polarToGlobal({ x: 1, y: 5 }, 5, Math.atan2(3, 4))
    expect(point.x).toBeCloseTo(5, 12)
    expect(point.y).toBeCloseTo(8, 12)
    const rotated = polarToGlobal({ x: 3, y: -2 }, 5, radians(30), radians(60))
    expect(rotated.x).toBeCloseTo(3, 12)
    expect(rotated.y).toBeCloseTo(3, 12)
  })

  it('calcula longitud, orientación y ejes locales de una barra', () => {
    const start = { x: 6, y: -3 }
    const end = { x: 3, y: 1 }
    const geometry = barGeometry(start, end)!
    expect(geometry.length).toBe(5)
    expect(geometry.angle).toBeCloseTo(Math.atan2(4, -3), 12)
    const localEnd = fromGlobal(end, geometry.frame)
    expect(localEnd.x).toBeCloseTo(5, 12)
    expect(localEnd.y).toBeCloseTo(0, 12)
    const positiveY = toGlobal({ x: 0, y: 5 }, geometry.frame)
    expect(positiveY.x).toBeCloseTo(2, 12)
    expect(positiveY.y).toBeCloseTo(-6, 12)
  })
})
