import { expect, it } from 'vitest'
import { calculateSection, LENGTH_MM } from './sections'
import type { ParametricSection, Primitive } from './sections'

function values(kind: ParametricSection, dimensions: Record<string, number>) {
  return calculateSection({ kind, dimensions }).values
}

it.each([
  ['rectangle', { b: 4, h: 6 }, 24, 2, 3, 72, 32],
  ['circle', { d: 4 }, 4 * Math.PI, 2, 2, 4 * Math.PI, 4 * Math.PI],
  ['roundTube', { d: 4, t: 1 }, 3 * Math.PI, 2, 2, 15 * Math.PI / 4, 15 * Math.PI / 4],
  ['boxTube', { b: 4, h: 6, t: 1 }, 16, 2, 3, 72 - 128 / 12, 32 - 32 / 12],
  ['I', { b: 4, h: 6, tw: 1, tf: 1 }, 12, 2, 3, 56, 11],
  ['T', { b: 4, h: 6, tw: 1, tf: 1 }, 9, 2, 23 / 6, 30.75, 5.75],
  ['C', { b: 4, h: 6, tw: 1, tf: 1 }, 12, 1.5, 3, 56, 17],
] as const)('contrasta %s con área y momentos analíticos', (kind, p, A, cx, cy, Ixx, Iyy) => {
  const result = values(kind, p)
  for (const [field, reference] of Object.entries({ A, cx, cy, Ixx, Iyy, Ixy: 0 })) {
    expect(result[field as keyof typeof result]).toBeCloseTo(reference, 12)
  }
})

it('calcula L con producto de inercia negativo en la convención aprobada', () => {
  const result = values('L', { b: 4, h: 6, t: 1 })
  expect(result.A).toBe(9)
  expect(result.cx).toBeCloseTo(7 / 6, 12)
  expect(result.cy).toBeCloseTo(13 / 6, 12)
  expect(result.Ixy).toBeCloseTo(-10, 12)
  // Rectángulo exterior menos el rincón 3 × 5, usando momentos sobre los ejes de origen.
  expect(result.Ixx).toBeCloseTo(4 * 6 ** 3 / 3 - 3 * (6 ** 3 - 1) / 3 - 9 * (13 / 6) ** 2, 12)
  expect(result.Iyy).toBeCloseTo(6 * 4 ** 3 / 3 - 5 * (4 ** 3 - 1) / 3 - 9 * (7 / 6) ** 2, 12)
})

const rect = (x: number, y: number, b: number, h: number, hole?: boolean): Primitive => ({ kind: 'rect', x, y, b, h, hole })
const disk = (x: number, y: number, r: number, hole?: boolean): Primitive => ({ kind: 'disk', x, y, r, hole })
const compound = (...parts: Primitive[]) => calculateSection({ kind: 'compound', parts }).values

it('aplica ejes paralelos a un rectángulo y un disco, con un vacío interior explícito', () => {
  const result = compound(rect(0, 0, 4, 4), disk(6, 5, 1), disk(2, 2, .5, true))
  const A = 16 + 3 * Math.PI / 4
  const cx = 2 + 4 * Math.PI / A, cy = 2 + 3 * Math.PI / A
  expect(result.A).toBeCloseTo(A, 12)
  expect(result.cx).toBeCloseTo(cx, 12)
  expect(result.cy).toBeCloseTo(cy, 12)
  const common = 4 ** 4 / 12 + 15 * Math.PI / 64
  const reducedArea = (16 - Math.PI / 4) * Math.PI / A
  expect(result.Ixx).toBeCloseTo(common + reducedArea * 9, 11)
  expect(result.Iyy).toBeCloseTo(common + reducedArea * 16, 11)
  expect(result.Ixy).toBeCloseTo(reducedArea * 12, 11)
})

it('admite contacto de sólidos y rechaza solapes y vacíos sin alojamiento', () => {
  expect(compound(rect(0, 0, 1, 1), rect(1, 0, 1, 1)).A).toBe(2)
  expect(compound(rect(.1, 0, .2, 1), rect(.3, 0, .2, 1)).A).toBeCloseTo(.4, 14)
  expect(() => compound(rect(0, 0, 2, 2), rect(1, 1, 2, 2))).toThrow('superpone')
  expect(() => compound(rect(0, 0, 2, 2), disk(2, 2, .5))).toThrow('superpone')
  expect(() => compound(disk(0, 0, 1), disk(.5, .5, 1))).toThrow('superpone')
  expect(() => compound(rect(0, 0, 2, 2), disk(0, 1, .5, true))).toThrow('dentro')
  expect(() => compound(disk(0, 0, 3), disk(1, 0, 1, true), disk(1.5, 0, 1, true))).toThrow('superpone')
})

it('rechaza secciones degeneradas y conserva dimensiones al pasar de mm a SI', () => {
  const result = values('rectangle', { b: 200 * LENGTH_MM, h: 400 * LENGTH_MM })
  expect(result.A).toBeCloseTo(.08, 14)
  expect(result.Ixx).toBeCloseTo(.2 * .4 ** 3 / 12, 14)
  expect(() => values('roundTube', { d: 2, t: 1 })).toThrow()
  expect(() => values('boxTube', { b: 4, h: 4, t: 2 })).toThrow()
  expect(() => values('I', { b: 3, h: 5, tw: 1, tf: 3 })).toThrow()
  expect(() => values('rectangle', { b: 0, h: 5 })).toThrow()
  expect(() => calculateSection({ kind: 'manual', values: { A: 1, cx: 0, cy: 0, Ixx: 2, Iyy: 2, Ixy: 3 } })).toThrow()
})
