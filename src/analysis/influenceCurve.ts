import { compensatedSum } from './summation'

export type Cubic = readonly [number, number, number, number]
export interface CurvePiece { readonly from: number; readonly to: number; readonly coefficients: Cubic }
export interface CurveKnot { readonly s: number; readonly exact: number; readonly left?: number; readonly right?: number }
export type CurvePoint = { readonly s: number; readonly value: number; readonly side: 'exact' | 'left' | 'right' }

export const INTERIOR_ABSCISSAE = [1 / 8, 3 / 8, 5 / 8, 7 / 8] as const
export function cubicFromSamples([a, b, c, d]: Cubic): Cubic {
  // Newton en z = 4t−1/2, con las muestras en z=0,1,2,3.
  const p = (d - 3 * c + 3 * b - a) / 6
  const q = (c - 2 * b + a) / 2 - 3 * p
  const r = b - a - (c - 2 * b + a) / 2 + 2 * p
  return [a - r / 2 + q / 4 - p / 8, 4 * r - 4 * q + 3 * p, 16 * q - 24 * p, 64 * p]
}

export function cubicValue([a, b, c, d]: Cubic, t: number): number {
  return ((d * t + c) * t + b) * t + a
}

export function sampleCubic(from: number, to: number, valueAt: (s: number) => number): CurvePiece {
  const [ta, tb, tc, td] = INTERIOR_ABSCISSAE
  const at = (t: number) => from + (to - from) * t
  const a = at(ta), b = at(tb), c = at(tc), d = at(td)
  if (!(from < a && a < b && b < c && c < d && d < to)) {
    throw new RangeError('Float64 no distingue las cuatro abscisas interiores de un tramo de influencia.')
  }
  return { from, to, coefficients: cubicFromSamples([valueAt(a), valueAt(b), valueAt(c), valueAt(d)]) }
}

export function stationary([, b, c, d]: Cubic): number[] {
  const scale = Math.max(Math.abs(b), Math.abs(c), Math.abs(d))
  if (!scale) return []
  const a = 3 * (d / scale), k = 2 * (c / scale), h = b / scale
  const epsilon = 64 * Number.EPSILON
  if (Math.abs(a) <= epsilon) return Math.abs(k) <= epsilon ? [] : [-h / k].filter(t => t > 0 && t < 1)
  const disc = k * k - 4 * a * h
  if (disc < -epsilon) return []
  const q = -(k + (k < 0 ? -1 : 1) * Math.sqrt(Math.max(0, disc))) / 2
  return [...new Set(q === 0 ? [-k / (2 * a)] : [q / a, h / q])].filter(t => t > 0 && t < 1).sort((x, y) => x - y)
}

export function curveKnots(pieces: readonly CurvePiece[], exact: (s: number) => number): CurveKnot[] {
  const last = pieces.at(-1)
  if (!last) return []
  const breaks = [...pieces.map(piece => piece.from), last.to]
  return breaks.map((s, i) => ({ s, exact: exact(s),
    left: i > 0 ? cubicValue(pieces[i - 1]!.coefficients, 1) : undefined,
    right: i < pieces.length ? cubicValue(pieces[i]!.coefficients, 0) : undefined }))
}

export function extrema(pieces: readonly CurvePiece[], knots: readonly CurveKnot[]) {
  const roundoff = 1e-12 * Math.max(0, ...pieces.flatMap(piece => piece.coefficients.map(Math.abs)))
  const candidates: CurvePoint[] = knots.flatMap(knot => {
    const points: CurvePoint[] = [{ s: knot.s, value: knot.exact, side: 'exact' }]
    const different = (value: number) => Math.abs(value - knot.exact) > roundoff
    if (knot.left !== undefined && different(knot.left)) points.push({ s: knot.s, value: knot.left, side: 'left' })
    if (knot.right !== undefined && different(knot.right)) points.push({ s: knot.s, value: knot.right, side: 'right' })
    return points
  })
  for (const piece of pieces) {
    const [, b, c, d] = piece.coefficients
    const positions = Math.abs(b) + Math.abs(c) + Math.abs(d) <= roundoff ? [.5] : stationary(piece.coefficients)
    for (const t of positions) candidates.push({
      s: piece.from + (piece.to - piece.from) * t, value: cubicValue(piece.coefficients, t), side: 'exact',
    })
  }
  let min = candidates[0]!, max = min
  for (const point of candidates) {
    const preferMin = point.side === 'exact' && min.side !== 'exact'
    const preferMax = point.side === 'exact' && max.side !== 'exact'
    if (point.value < min.value - roundoff || (preferMin && Math.abs(point.value - min.value) <= roundoff)) min = point
    if (point.value > max.value + roundoff || (preferMax && Math.abs(point.value - max.value) <= roundoff)) max = point
  }
  return { min, max }
}

export function curveZeros(pieces: readonly CurvePiece[], knots: readonly CurveKnot[]): number[] {
  const reference = Math.max(0, ...pieces.flatMap(piece => piece.coefficients.map(Math.abs)))
  const tol = reference * 1e-10
  const zeros = knots.filter(knot => Math.abs(knot.exact) <= tol).map(knot => knot.s)
  for (const { from, to, coefficients } of pieces) {
    const breaks = [0, ...stationary(coefficients), 1]
    for (let i = 1; i < breaks.length; i++) {
      let a = breaks[i - 1]!, b = breaks[i]!
      let fa = cubicValue(coefficients, a)
      const fb = cubicValue(coefficients, b)
      if (i < breaks.length - 1 && Math.abs(fb) <= tol) zeros.push(from + (to - from) * b)
      if (Math.sign(fa) === Math.sign(fb) || Math.abs(fa) <= tol || Math.abs(fb) <= tol) continue
      for (let j = 0; j < 52; j++) {
        const m = (a + b) / 2
        const fm = cubicValue(coefficients, m)
        if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm } else b = m
      }
      zeros.push(from + (to - from) * (a + b) / 2)
    }
  }
  return [...new Set(zeros)].sort((a, b) => a - b)
}

export function stationEqual(a: number, b: number) {
  return Math.abs(a - b) <= 8 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b))
}

export function curveAt(pieces: readonly CurvePiece[], knots: readonly CurveKnot[], s: number, side: CurvePoint['side'] = 'exact') {
  const knot = knots.find(item => item.s === s)
  if (knot) return side === 'exact' ? knot.exact : knot[side] ?? 0
  const piece = pieces.find(item => item.from < s && s < item.to)
  return piece ? cubicValue(piece.coefficients, (s - piece.from) / (piece.to - piece.from)) : 0
}

export interface Axle { readonly id: string; readonly force: number; readonly offset: number }
export interface Train { readonly id: string; readonly name: string; readonly sense: 1 | -1; readonly axles: readonly Axle[] }

export function validateTrain(train: Train) {
  const { axles } = train
  if (!train.id.trim() || !train.name.trim() || (train.sense !== 1 && train.sense !== -1) ||
    axles.length === 0 || axles.length > 16 || new Set(axles.map(axle => axle.id)).size !== axles.length ||
    axles.some(axle => !axle.id || !Number.isFinite(axle.force) || !Number.isFinite(axle.offset) || axle.offset < 0 || axle.offset > 1e9) ||
    !axles.some(axle => axle.offset === 0)) throw new RangeError('Define de 1 a 16 ejes identificados, fuerzas finitas y distancias no negativas, con al menos un eje en el origen.')
}

export function trainValue(pieces: readonly CurvePiece[], knots: readonly CurveKnot[], train: Train, position: number,
  side: CurvePoint['side'] = 'exact') {
  return compensatedSum(train.axles.map(axle => {
    const shift = train.sense * axle.offset
    const knot = knots.find(item => item.s + shift === position)
    if (knot) return axle.force * (side === 'exact' ? knot.exact : knot[side] ?? 0)
    const piece = pieces.find(item => item.from + shift < position && position < item.to + shift)
    if (!piece) return 0
    const from = piece.from + shift, to = piece.to + shift
    return axle.force * cubicValue(piece.coefficients, (position - from) / (to - from))
  }))
}

/** Canoniza la estación física de un eje al coincidir con un evento del tren. */
export function axleStation(knots: readonly CurveKnot[], reference: number, shift: number) {
  return knots.find(knot => knot.s + shift === reference)?.s ?? reference - shift
}

/** La suma es cúbica entre eventos desplazados de todos los ejes. */
export function trainEnvelope(pieces: readonly CurvePiece[], knots: readonly CurveKnot[], train: Train) {
  validateTrain(train)
  const events = train.axles.flatMap(axle => {
    const moved = knots.map(knot => knot.s + train.sense * axle.offset)
    if (moved.some((s, i) => i > 0 && stationEqual(s, moved[i - 1]!))) {
      throw new RangeError(`El desplazamiento del eje ${axle.id} impide distinguir sus estaciones en Float64.`)
    }
    return moved
  }).sort((a, b) => a - b)
  const stations = [...new Set(events)]
  const exact = (x: number) => trainValue(pieces, knots, train, x)
  const curve = stations.slice(1).map((to, i) => sampleCubic(stations[i]!, to, exact))
  const rawLimits = curveKnots(curve, exact)
  const limits = rawLimits.map((item, i) => ({ ...item,
    left: i === 0 ? 0 : item.left, right: i === rawLimits.length - 1 ? 0 : item.right }))
  if (curve.some(piece => !piece.coefficients.every(Number.isFinite)) || limits.some(knot => !Number.isFinite(knot.exact))) {
    throw new RangeError('La respuesta del tren supera el rango numérico.')
  }
  return { pieces: curve, knots: limits, ...extrema(curve, limits) }
}
