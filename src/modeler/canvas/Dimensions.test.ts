import { describe, expect, it } from 'vitest'
import { measureBar } from './Dimensions'

describe('Cotas físicas', () => {
  it.each([
    [{ x: 3, y: 0 }, 3, 0],
    [{ x: 0, y: -4 }, 4, -Math.PI / 2],
    [{ x: 3, y: 4 }, 5, Math.atan2(4, 3)],
  ] as const)('mide %o desde un origen trasladado', (end, length, angle) => {
    const start = { x: 2, y: -1 }
    const result = measureBar(start, { x: start.x + end.x, y: start.y + end.y }, Math.PI / 2)
    expect(result.delta).toEqual(end)
    expect(result.length).toBeCloseTo(length)
    expect(result.angle).toBeCloseTo(angle)
    expect(result.ucs.x).toBeCloseTo(end.y)
    expect(result.ucs.y).toBeCloseTo(-end.x)
  })
})
