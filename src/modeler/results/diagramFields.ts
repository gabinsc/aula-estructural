import { evaluateFrameSection } from '../../analysis'
import type { FrameResult, FrameSection } from '../../analysis'
import { compensatedSum } from '../../analysis/summation'

export const EFFORTS = ['N', 'V', 'M'] as const
export type Effort = typeof EFFORTS[number]
export type CutSide = FrameSection['side']
export type SectionCut = { barId: string; s: number; side: CutSide; source: 'canvas' | 'chart' | 'table' }

/** Tolerancia gráfica en N o N·m, independiente de zoom y amplificación. */
export function isEffortJump(left: number, right: number, reference: number) {
  return Math.abs(right - left) > 1e-6 + 128 * Number.EPSILON * Math.max(reference, Math.abs(left), Math.abs(right))
}

export interface FieldMark {
  readonly section: FrameSection
  readonly kind: 'boundary' | 'jump' | 'critical' | 'zero'
}

interface Interval {
  readonly start: FrameSection
  readonly first: FrameSection
  readonly second: FrameSection
  readonly end: FrameSection
}

export interface FrameFields {
  readonly intervals: readonly Interval[]
  readonly marks: Readonly<Record<Effort, readonly FieldMark[]>>
  readonly stations: readonly number[]
  readonly jumps: ReadonlySet<number>
}

/** Raíz interior de una intensidad lineal. Se normaliza antes de sumar magnitudes. */
function linearRoot(a: number, b: number, x: number, y: number): number[] {
  if (x === 0 || y === 0 || Math.sign(x) === Math.sign(y)) return []
  const scale = Math.max(Math.abs(x), Math.abs(y))
  const fraction = (Math.abs(x) / scale) / (Math.abs(x) / scale + Math.abs(y) / scale)
  const root = a + (b - a) * fraction
  return a < root && root < b ? [root] : []
}

/** Busca ceros dentro de tramos monótonos sin evaluar a través de un salto. */
function roots(stations: readonly number[], field: (s: number) => number): number[] {
  const values = stations.map(field)
  const scale = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
  if (!scale) return []
  const zero = 64 * Number.EPSILON * scale
  const result: number[] = []
  for (let i = 0; i < stations.length; i++) {
    if (Math.abs(values[i]!) <= zero) result.push(stations[i]!)
    if (!i || Math.abs(values[i - 1]!) <= zero || Math.abs(values[i]!) <= zero ||
      Math.sign(values[i - 1]!) === Math.sign(values[i]!)) continue
    let a = stations[i - 1]!, b = stations[i]!
    const sign = Math.sign(values[i - 1]!)
    for (let iteration = 0; iteration < 64; iteration++) {
      const middle = a + (b - a) / 2
      if (middle === a || middle === b) break
      const value = field(middle)
      if (value === 0) { a = middle; b = middle; break }
      if (Math.sign(value) === sign) a = middle
      else b = middle
    }
    result.push(a + (b - a) / 2)
  }
  return result.sort((a, b) => a - b)
}

function axialAndShearCandidates(bar: FrameResult, a: number, b: number) {
  const loads = bar.loads.filter(load => load.kind === 'distributed').filter(load => load.s0 <= a && load.s1 >= b)
  function intensity(s: number, axis: 'x' | 'y') {
    return compensatedSum(loads.map(load => {
      const t = (s - load.s0) / (load.s1 - load.s0)
      return (1 - t) * load.q0[axis] + t * load.q1[axis]
    }))
  }
  return {
    N: linearRoot(a, b, intensity(a, 'x'), intensity(b, 'x')),
    V: linearRoot(a, b, intensity(a, 'y'), intensity(b, 'y')),
  }
}

/** Los límites del motor fijan los intervalos polinómicos. Solo el motor evalúa N, V y M. */
export function buildFrameFields(bar: FrameResult): FrameFields {
  const boundaries = [...new Set(bar.sections.map(item => item.s))]
  const jumps = new Set(bar.loads.flatMap(load => load.kind === 'point' ? [load.s] : []))
  const stations = new Set(boundaries)
  const marks: Record<Effort, FieldMark[]> = { N: [], V: [], M: [] }
  for (const field of EFFORTS) {
    for (const section of bar.sections) {
      marks[field].push({ section, kind: jumps.has(section.s) && field !== 'M' ? 'jump' : 'boundary' })
    }
  }
  const intervals: Interval[] = []
  const original = new Map(bar.sections.map(section => [`${section.s}:${section.side}`, section]))
  function at(s: number, side: CutSide) {
    return original.get(`${s}:${side}`) ?? evaluateFrameSection(bar, s, side)
  }
  for (let i = 1; i < boundaries.length; i++) {
    const a = boundaries[i - 1]!, b = boundaries[i]!
    const cache = new Map<number, FrameSection>()
    function evaluate(s: number) {
      const cached = cache.get(s)
      if (cached) return cached
      const section = at(s, s === b ? 'left' : 'right')
      cache.set(s, section)
      return section
    }
    const intensity = axialAndShearCandidates(bar, a, b)
    const shearZeros = roots([a, ...intensity.V, b], s => evaluate(s).V)
    const critical = { ...intensity, M: shearZeros.filter(s => a < s && s < b) }
    const splits = new Set([a, b])
    for (const field of EFFORTS) {
      const zeros = field === 'V' ? shearZeros : roots([a, ...critical[field], b], s => evaluate(s)[field])
      for (const [kind, points] of [['critical', critical[field]], ['zero', zeros]] as const) {
        for (const s of points) {
          if (s <= a || s >= b) continue
          marks[field].push({ section: evaluate(s), kind })
          stations.add(s)
          splits.add(s)
        }
      }
    }
    const ordered = [...splits].sort((left, right) => left - right)
    for (let j = 1; j < ordered.length; j++) {
      const s0 = ordered[j - 1]!, s1 = ordered[j]!
      const span = s1 - s0
      intervals.push({ start: evaluate(s0), first: evaluate(s0 + span / 3),
        second: evaluate(s1 - span / 3), end: evaluate(s1) })
    }
  }
  return { intervals, marks, stations: [...stations].sort((a, b) => a - b), jumps }
}
