import { describe, expect, it } from 'vitest'
import { DEFAULT_LOAD_ANGLE, forceComponents, forceDirectionAngle, normalizeDirection } from './loadDirection'

describe('Dirección de cargas', () => {
  it('inicia hacia abajo y obtiene componentes cardinales exactas', () => {
    expect(DEFAULT_LOAD_ANGLE).toBe(270)
    expect(forceComponents(12, DEFAULT_LOAD_ANGLE)).toEqual({ x: 0, y: -12 })
    expect(forceComponents(12, -90)).toEqual({ x: 0, y: -12 })
    expect(forceComponents(12, 450)).toEqual({ x: 0, y: 12 })
    expect(forceComponents(12, 180)).toEqual({ x: -12, y: 0 })
  })

  it('convierte direcciones oblicuas antihorarias y recupera su ángulo', () => {
    const vector = forceComponents(10, 225)
    expect(vector.x).toBeCloseTo(-5 * Math.SQRT2)
    expect(vector.y).toBeCloseTo(-5 * Math.SQRT2)
    expect(forceDirectionAngle(vector)).toBeCloseTo(225)
    expect(forceDirectionAngle({ x: 0, y: -5 })).toBe(270)
    expect(normalizeDirection(-30)).toBe(330)
  })
})
