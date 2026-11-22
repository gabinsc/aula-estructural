import { loadBarGeometry } from '../domain/load'
import type { Structure } from '../domain/structure'
import type { AnalysisDefinition, AnalysisResult, BarResult } from './contracts'
import { evaluateFrameSection } from './frame'
import { compensatedSum } from './summation'

export type Solved = Extract<AnalysisResult, { ok: true }>
export interface Efforts { readonly N: number; readonly V: number; readonly M: number }
export interface WorkSample { readonly s: number; readonly real: Efforts; readonly unit: Efforts; readonly weight?: number }
export interface WorkInterval {
  readonly from: number
  readonly to: number
  readonly axial: number
  readonly flexural: number
  readonly samples: readonly WorkSample[]
}
export interface WorkMember {
  readonly barId: string
  readonly axial: number
  readonly flexural: number
  readonly EA: number
  readonly EI?: number
  readonly intervals: readonly WorkInterval[]
}
export interface WorkIntegral {
  readonly total: number
  readonly members: readonly WorkMember[]
}
export interface MemberSource { readonly barId: string; readonly offset: number }

const gauss4 = [
  [-0.8611363115940526, 0.34785484513745385],
  [-0.3399810435848563, 0.6521451548625461],
  [0.3399810435848563, 0.6521451548625461],
  [0.8611363115940526, 0.34785484513745385],
] as const

export function effortAt(bar: BarResult, s: number, side: 'left' | 'right' = 'right'): Efforts {
  return bar.kind === 'frame2d' ? evaluateFrameSection(bar, s, side) : { N: bar.axialForce, V: 0, M: 0 }
}

/** Cada tramo separa discontinuidades y cambios de ley de ambos sistemas.
 * N tiene grado máximo 2, M grado 3. Gauss–Legendre de 4 puntos es exacta
 * hasta grado 7, salvo el redondeo de Float64. Las muestras de extremo son unilaterales. */
export function integrateWork(model: Structure, definition: AnalysisDefinition, left: Solved, right: Solved,
  sources: ReadonlyMap<string, MemberSource> = new Map(), recordSamples = true): WorkIntegral {
  const byLeft = new Map(left.bars.map(bar => [bar.barId, bar]))
  const byRight = new Map(right.bars.map(bar => [bar.barId, bar]))
  const groups = new Map<string, WorkMember>()
  for (const assignment of definition.assignments) {
    const id = assignment.barId
    const source = sources.get(id) ?? { barId: id, offset: 0 }
    const a = byLeft.get(id)!
    const b = byRight.get(id)!
    const length = a.kind === 'frame2d' ? a.length : loadBarGeometry(model, id)!.length
    const EA = assignment.E * assignment.A
    const EI = assignment.kind === 'frame2d' ? assignment.E * assignment.I : undefined
    const rootEA = Math.sqrt(EA)
    const rootEI = EI === undefined ? undefined : Math.sqrt(EI)
    const breaks = new Set([0, length])
    for (const bar of [a, b]) if (bar.kind === 'frame2d') {
      for (const { s } of bar.sections) breaks.add(s)
    }
    const stations = [...breaks].sort((x, y) => x - y)
    function sample(s: number, side: 'left' | 'right' = 'right', weight?: number): WorkSample {
      const { N, V, M } = effortAt(a, s, side)
      const unit = effortAt(b, s, side)
      return { s: source.offset + s, real: { N, V, M }, unit: { N: unit.N, V: unit.V, M: unit.M }, weight }
    }
    const intervals = stations.slice(1).map((hi, i): WorkInterval => {
      const lo = stations[i]!
      const half = (hi - lo) / 2
      if (a.kind !== 'frame2d' && b.kind !== 'frame2d') {
        const axial = (a.axialForce / rootEA) * (b.axialForce / rootEA) * (hi - lo)
        return { from: source.offset + lo, to: source.offset + hi, axial, flexural: 0,
          samples: recordSamples ? [sample(lo), sample(hi, 'left')] : [] }
      }
      const quadrature = gauss4.map(([x, w]) => sample(lo + half * (1 + x), 'right', w * half))
      const axial = compensatedSum(quadrature.map(({ real, unit, weight }) =>
        (real.N / rootEA) * (unit.N / rootEA) * weight!))
      const flexural = rootEI === undefined ? 0 : compensatedSum(quadrature.map(({ real, unit, weight }) =>
        (real.M / rootEI) * (unit.M / rootEI) * weight!))
      return { from: source.offset + lo, to: source.offset + hi, axial, flexural,
        samples: recordSamples ? [sample(lo), ...quadrature, sample(hi, 'left')] : [] }
    })
    const combined = [...(groups.get(source.barId)?.intervals ?? []), ...intervals]
    groups.set(source.barId, { barId: source.barId, EA, EI, intervals: combined,
      axial: compensatedSum(combined.map(interval => interval.axial)),
      flexural: compensatedSum(combined.map(interval => interval.flexural)) })
  }
  const members = [...groups.values()]
  const total = compensatedSum(members.flatMap(({ axial, flexural }) => [axial, flexural]))
  if (!Number.isFinite(total) || members.some(({ axial, flexural, intervals }) => !Number.isFinite(axial) ||
    !Number.isFinite(flexural) || intervals.some(i => !Number.isFinite(i.axial) || !Number.isFinite(i.flexural)))) {
    throw new RangeError('La integral de trabajo virtual no es representable en Float64.')
  }
  return { total, members }
}
