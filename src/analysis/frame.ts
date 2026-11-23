import type { Point } from '../geometry/coordinates'
import type { FrameInteriorLoad, FrameResult, FrameSection, FrameVector, PreparedFrame } from './contracts'
import { compensatedSum } from './summation'

type FrameGeometry = Pick<PreparedFrame, 'length' | 'unit' | 'axialStiffness' | 'EI' | 'releaseI' | 'releaseJ'>
export type FrameEnergyMode = { readonly axial: number; readonly transverse: number; readonly spinI: number; readonly spinJ: number; readonly stiffness: number }

/** Tres modos energéticos: extensión, flexión simétrica y diferencia de giros. */
export function frameEnergyModes(bar: FrameGeometry): readonly FrameEnergyMode[] {
  const bending = bar.EI / bar.length
  const axial = { axial: -1, transverse: 0, spinI: 0, spinJ: 0, stiffness: bar.axialStiffness }
  if (bar.releaseI && bar.releaseJ) return [axial]
  if (bar.releaseI || bar.releaseJ) return [axial, { axial: 0, transverse: 1 / bar.length,
    spinI: bar.releaseI ? 0 : 1, spinJ: bar.releaseJ ? 0 : 1, stiffness: 3 * bending }]
  return [axial,
    { axial: 0, transverse: 2 / bar.length, spinI: 1, spinJ: 1, stiffness: 3 * bending },
    { axial: 0, transverse: 0, spinI: 1, spinJ: -1, stiffness: bending }]
}

/** Schur complement in energy form. Released slots remain padded with zeros for trace display. */
export function condensedFrameStiffness(bar: FrameGeometry): Float64Array {
  if (!bar.releaseI && !bar.releaseJ) return frameLocalStiffness(bar)
  const modes = frameEnergyModes(bar).map(({ axial, transverse, spinI, spinJ, stiffness }) => ({
    stiffness, direction: [axial, transverse, spinI, -axial, -transverse, spinJ],
  }))
  return Float64Array.from({ length: 36 }, (_, index) => compensatedSum(modes.map(({ stiffness, direction }) =>
    stiffness * direction[Math.floor(index / 6)]! * direction[index % 6]!)))
}

/** Eliminate the rotational load block with dimensionless factors from its 1×1 or 2×2 solve. */
export function condenseFrameLoad(bar: FrameGeometry, load: FrameVector): FrameVector {
  if (!bar.releaseI && !bar.releaseJ) return load
  const [xi, yi, mi, xj, yj, mj] = load
  const shift = bar.releaseI && bar.releaseJ ? (mi + mj) / bar.length
    : 1.5 * (bar.releaseI ? mi : mj) / bar.length
  return [xi, yi - shift, bar.releaseI ? 0 : mi - mj / 2,
    xj, yj + shift, bar.releaseJ ? 0 : mj - mi / 2]
}

export function frameLocalStiffness(bar: FrameGeometry): Float64Array {
  const a = bar.axialStiffness
  const r = bar.EI / bar.length
  const d = 6 * r / bar.length
  const b = 2 * d / bar.length
  const e = 4 * r
  const f = 2 * r
  return Float64Array.of(
    a, 0, 0, -a, 0, 0,
    0, b, d, 0, -b, d,
    0, d, e, 0, -d, f,
    -a, 0, 0, a, 0, 0,
    0, -b, -d, 0, b, -d,
    0, d, f, 0, -d, e,
  )
}

export function frameTransformation({ x: c, y: s }: Point): Float64Array {
  return Float64Array.of(
    c, s, 0, 0, 0, 0,
    -s, c, 0, 0, 0, 0,
    0, 0, 1, 0, 0, 0,
    0, 0, 0, c, s, 0,
    0, 0, 0, -s, c, 0,
    0, 0, 0, 0, 0, 1,
  )
}

export function toLocalVector(vector: Point, { x: c, y: s }: Point): Point {
  return { x: c * vector.x + s * vector.y, y: -s * vector.x + c * vector.y }
}

export function toGlobalVector(vector: Point, { x: c, y: s }: Point): Point {
  return { x: c * vector.x - s * vector.y, y: s * vector.x + c * vector.y }
}

export function frameVector(value: (index: number) => number): FrameVector {
  return [value(0), value(1), value(2), value(3), value(4), value(5)]
}

export function transformFrameVector(vector: FrameVector, unit: Point, turn: typeof toLocalVector): FrameVector {
  const i = turn({ x: vector[0], y: vector[1] }, unit)
  const j = turn({ x: vector[3], y: vector[4] }, unit)
  return [i.x, i.y, vector[2], j.x, j.y, vector[5]]
}

function pointEquivalent(length: number, s: number, { x, y }: Point): FrameVector {
  const t = s / length
  const w = 1 - t
  return [w * x, w * w * (1 + 2 * t) * y, t * w * w * length * y,
    t * x, t * t * (1 + 2 * w) * y, -w * t * t * length * y]
}

const GAUSS_3 = [
  { x: -Math.sqrt(3 / 5), weight: 5 / 9 },
  { x: 0, weight: 8 / 9 },
  { x: Math.sqrt(3 / 5), weight: 5 / 9 },
]

/** Evalúa q lineal en el tramo original, aunque la integral termine en una sección interior. */
function distributedSamples(load: Extract<FrameInteriorLoad, { kind: 'distributed' }>, end: number) {
  const half = (end - load.s0) / 2
  return GAUSS_3.map(({ x, weight }) => {
    const offset = half * (1 + x)
    const fraction = offset / (load.s1 - load.s0)
    return { s: load.s0 + offset, arm: end - load.s0 - offset, weight: weight * half, q: {
      x: (1 - fraction) * load.q0.x + fraction * load.q1.x,
      y: (1 - fraction) * load.q0.y + fraction * load.q1.y,
    } }
  })
}

/** Vector de acciones nodales consistentes en N y N·m, en ejes locales. */
export function frameEquivalentLoad(length: number, load: FrameInteriorLoad): FrameVector {
  if (load.kind === 'point') return pointEquivalent(length, load.s, load.force)
  const samples = distributedSamples(load, load.s1).map(({ s, weight, q }) => ({
    equivalent: pointEquivalent(length, s, q), weight,
  }))
  return frameVector(i => compensatedSum(samples.map(({ equivalent, weight }) => weight * equivalent[i]!)))
}

/** N en tracción, V positivo hacia −y en la cara derecha del corte, M sagante positivo. */
export function evaluateFrameSection(bar: Pick<FrameResult, 'length' | 'EA' | 'EI' | 'endForces' | 'localDisplacements' | 'loads'>,
  s: number, side: FrameSection['side'] = s === bar.length ? 'left' : 'right'): FrameSection {
  if (!Number.isFinite(s) || s < 0 || s > bar.length) throw new RangeError('La estación debe pertenecer a [0, L].')
  const [px, py, mz] = bar.endForces
  const [ui, vi, ti] = bar.localDisplacements
  const axial = [-px]
  const shear = [py]
  const moment = [-mz, s * py]
  const extension = [ui, -px / bar.EA * s]
  const angle = [ti, -mz / bar.EI * s, py / bar.EI * s * s / 2]
  const deflection = [vi, ti * s, -mz / bar.EI * s * s / 2, py / bar.EI * s * s * s / 6]
  function applyLoad(x: number, y: number, arm: number) {
    axial.push(-x)
    shear.push(y)
    moment.push(y * arm)
    extension.push(-x / bar.EA * arm)
    angle.push(y / bar.EI * arm * arm / 2)
    deflection.push(y / bar.EI * arm * arm * arm / 6)
  }
  for (const load of bar.loads) {
    if (load.kind === 'point') {
      if (load.s < s || (load.s === s && side === 'right')) applyLoad(load.force.x, load.force.y, s - load.s)
    } else if (s > load.s0) {
      const end = Math.min(s, load.s1)
      for (const { arm, weight, q } of distributedSamples(load, end)) {
        applyLoad(q.x * weight, q.y * weight, s - end + arm)
      }
    }
  }
  const terms = [axial, shear, moment, extension, deflection, angle]
  const [N, V, M, u, v, rotation] = frameVector(i => compensatedSum(terms[i]!))
  if (![N, V, M, u, v, rotation].every(Number.isFinite)) {
    throw new RangeError('El resultado de sección supera el rango de Float64.')
  }
  return { s, side, N, V, M, u, v, rotation }
}

export function recoverFrame(bar: PreparedFrame, u: Float64Array, loads: readonly FrameInteriorLoad[], equivalentLocal: FrameVector): FrameResult {
  const displacements = transformFrameVector(frameVector(i => u[bar.dofIndices[i]!] ?? 0), bar.unit, toLocalVector)
  const [ui, vi, originalI, uj, vj, originalJ] = displacements
  const elongation = uj - ui
  const axial = bar.axialStiffness * elongation
  const bending = bar.EI / bar.length
  const chord = (vj - vi) / bar.length
  const [mi, mj] = [equivalentLocal[2], equivalentLocal[5]]
  // Solve Krr θr = fr − Kra ua. Compute in chord-relative coordinates.
  let relativeI = originalI - chord
  let relativeJ = originalJ - chord
  if (bar.releaseI && bar.releaseJ) {
    relativeI = (mi - mj / 2) / (3 * bending)
    relativeJ = (mj - mi / 2) / (3 * bending)
  } else if (bar.releaseI) relativeI = mi / (4 * bending) - relativeJ / 2
  else if (bar.releaseJ) relativeJ = mj / (4 * bending) - relativeI / 2
  const localDisplacements: FrameVector = [ui, vi, bar.releaseI ? chord + relativeI : originalI,
    uj, vj, bar.releaseJ ? chord + relativeJ : originalJ]
  const ti = localDisplacements[2]
  const tj = localDisplacements[5]
  const symmetric = 3 * bending * (ti + tj - 2 * ((vj - vi) / bar.length))
  const antisymmetric = bending * (ti - tj)
  const condensed = condenseFrameLoad(bar, equivalentLocal)
  // In released elements compute the retained forces directly in the Schur system.
  const retainedMoment = 3 * bending * (bar.releaseI ? relativeJ : relativeI)
  const bothReleased = bar.releaseI && bar.releaseJ
  const released = bar.releaseI || bar.releaseJ
  const shear = released ? (bothReleased ? 0 : retainedMoment / bar.length) : 2 * symmetric / bar.length
  const elastic: FrameVector = [-axial, shear, bar.releaseI ? 0 : bar.releaseJ ? retainedMoment : symmetric + antisymmetric,
    axial, -shear, bar.releaseJ ? 0 : bar.releaseI ? retainedMoment : symmetric - antisymmetric]
  const endForces = frameVector(i => elastic[i]! - condensed[i]!)
  const field = { length: bar.length, EA: bar.E * bar.A, EI: bar.EI, loads, localDisplacements, endForces }
  const stations = new Set([0, bar.length])
  const jumps = new Set<number>()
  for (const load of loads) {
    if (load.kind === 'point') {
      stations.add(load.s)
      jumps.add(load.s)
    } else {
      stations.add(load.s0)
      stations.add(load.s1)
    }
  }
  const sections = [...stations].sort((a, b) => a - b).flatMap(s => jumps.has(s)
    ? [evaluateFrameSection(field, s, 'left'), evaluateFrameSection(field, s, 'right')]
    : [evaluateFrameSection(field, s)])
  return { ...field, kind: 'frame2d', barId: bar.barId, elongation, axialForce: sections[0]!.N, equivalentLocal, sections }
}
