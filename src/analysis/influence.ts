import { loadBarGeometry } from '../domain/load'
import type { StructuralLoad } from '../domain/load'
import type { Structure } from '../domain/structure'
import type { Point } from '../geometry/coordinates'
import type { AnalysisInput } from './contracts'
import { evaluateFrameSection } from './frame'
import { axleStation, curveAt, curveKnots, curveZeros, cubicValue, extrema, INTERIOR_ABSCISSAE, sampleCubic, trainEnvelope } from './influenceCurve'
import type { CurveKnot, CurvePiece, CurvePoint, Train } from './influenceCurve'
import { solveAnalysis } from './solve'
import { conjugate, methodFailure, modelCase } from './virtualWork'
import type { MethodFailure, Motion } from './virtualWork'
import type { Solved } from './workIntegral'
import { compensatedSum } from './summation'

export const MAX_INFLUENCE_MEMBERS = 24
const MAX_INFLUENCE_DOFS = 160

export type InfluenceTarget =
  | { readonly kind: 'displacement'; readonly nodeId: string; readonly motion: Motion }
  | { readonly kind: 'reaction'; readonly nodeId: string; readonly direction: Point }
  | { readonly kind: 'effort'; readonly barId: string; readonly s: number; readonly side: 'left' | 'right'; readonly field: 'N' | 'V' | 'M' }

export interface InfluenceStep {
  readonly barId: string
  readonly startId: string
  readonly endId: string
  readonly from: number
  readonly to: number
  readonly length: number
  readonly reversed: boolean
}

export interface InfluenceOptions {
  readonly bars: readonly string[]
  readonly reversed: boolean
  readonly target: InfluenceTarget
  readonly direction: Point
  readonly train?: Train
}

export interface InfluenceDetail {
  readonly kind: 'influence'
  readonly target: InfluenceTarget
  readonly direction: Point
  readonly path: readonly InfluenceStep[]
  readonly pieces: readonly CurvePiece[]
  readonly knots: readonly CurveKnot[]
  readonly zeros: readonly number[]
  readonly min: CurvePoint
  readonly max: CurvePoint
  readonly verification: { readonly s: number; readonly direct: number; readonly ordinate: number; readonly maxError: number }
  readonly train?: { readonly spec: Train; readonly envelope: ReturnType<typeof trainEnvelope>;
    readonly verification: { readonly s: number; readonly direct: number; readonly ordinate: number } }
}

function direction(value: Point) {
  const length = Math.hypot(value.x, value.y)
  if (!Number.isFinite(length) || length <= 0) throw new RangeError('La dirección debe ser finita y no nula.')
  return { x: value.x / length, y: value.y / length }
}

export function buildInfluencePath(model: Structure, ids: readonly string[], backwards = false,
  assignments = model.mechanics.assignments): readonly InfluenceStep[] {
  if (!ids.length || ids.length > MAX_INFLUENCE_MEMBERS || ids.length !== new Set(ids).size) {
    throw new RangeError(`Indica de 1 a ${MAX_INFLUENCE_MEMBERS} barras distintas en el orden de avance.`)
  }
  const frameIds = new Set(assignments.filter(item => item.kind === 'frame2d').map(item => item.barId))
  const byId = new Map(model.bars.map(bar => [bar.id, bar]))
  const bars = ids.map(id => {
    const bar = byId.get(id)
    if (!bar || !frameIds.has(id)) throw new RangeError(`La barra ${id} debe existir y ser un elemento de pórtico que admita cargas interiores.`)
    return bar
  })
  const first = bars[0]!
  const second = bars[1]
  const shares = (node: string) => second && (second.startId === node || second.endId === node)
  let entry = shares(first.startId) ? first.endId : first.startId
  const visited = new Set([entry])
  let s = 0
  const order = bars.map(bar => {
    const reversed = bar.endId === entry
    if (!reversed && bar.startId !== entry) throw new RangeError(`El camino es discontinuo o está desordenado en ${bar.id}. Usa un recorrido explícito sin bifurcaciones.`)
    const startId = entry
    const endId = reversed ? bar.startId : bar.endId
    const geometry = loadBarGeometry(model, bar.id)
    if (visited.has(endId) || !geometry) throw new RangeError('El recorrido contiene un ciclo, una bifurcación o una geometría inválida.')
    visited.add(endId)
    entry = endId
    const from = s
    s += geometry.length
    if (!(s > from)) throw new RangeError('El tramo no admite estaciones acumuladas representables.')
    return { barId: bar.id, startId, endId, length: geometry.length, from, to: s, reversed }
  })
  if (!backwards) return order
  let reversedStation = 0
  return order.reverse().map(item => {
    const from = reversedStation
    reversedStation += item.length
    if (!(reversedStation > from)) throw new RangeError('La inversión impide distinguir las estaciones de un tramo.')
    return { ...item, startId: item.endId, endId: item.startId, from, to: reversedStation, reversed: !item.reversed }
  })
}

export function mobileLocation(path: readonly InfluenceStep[], S: number) {
  const step = path.find(item => item.from <= S && S <= item.to)
  if (!step) return undefined
  const forward = S === step.to ? step.length : Math.min(S - step.from, step.length)
  return { step, s: step.reversed ? step.length - forward : forward }
}

function structuralValue(result: Solved, target: InfluenceTarget) {
  if (target.kind === 'displacement') {
    const node = result.displacements.find(item => item.nodeId === target.nodeId)
    if (!node || (target.motion.kind === 'rotation' && node.rotation === undefined)) throw new RangeError('El nudo no posee el grado activo solicitado.')
    return conjugate(node, target.motion)
  }
  if (target.kind === 'reaction') {
    const reaction = result.reactions.find(item => item.nodeId === target.nodeId)
    if (!reaction) throw new RangeError('Selecciona un nudo con apoyo para consultar su reacción.')
    return conjugate(reaction, { kind: 'translation', direction: target.direction })
  }
  const bar = result.bars.find(item => item.barId === target.barId)
  if (!bar) throw new RangeError('La barra objetivo ya no existe.')
  if (bar.kind === 'frame2d') return evaluateFrameSection(bar, target.s, target.side)[target.field]
  if (target.field !== 'N') throw new RangeError('Solo puede consultarse N en una barra de armadura.')
  return bar.axialForce
}

function direct(input: AnalysisInput, target: InfluenceTarget, loads: readonly StructuralLoad[]) {
  const result = solveAnalysis(modelCase(input, loads, 'movil-temporal'))
  if (!result.ok) throw new RangeError(result.diagnostics.map(item => item.message).join(' '))
  return structuralValue(result, target)
}

export function solveInfluence(input: AnalysisInput, options: InfluenceOptions):
  MethodFailure | { readonly ok: true; readonly result: Solved; readonly detail: InfluenceDetail } {
  const base = solveAnalysis(modelCase(input, []))
  if (!base.ok) return { ok: false, result: base }
  try {
    if (base.dofs.length > MAX_INFLUENCE_DOFS) throw new RangeError(`La evaluación de influencia admite hasta ${MAX_INFLUENCE_DOFS} grados activos.`)
    const path = buildInfluencePath(input.model, options.bars, options.reversed, input.definition.assignments)
    const unit = direction(options.direction)
    let target = options.target
    if (target.kind === 'reaction') target = { ...target, direction: direction(target.direction) }
    if (target.kind === 'displacement' && target.motion.kind === 'translation') {
      target = { ...target, motion: { kind: 'translation', direction: direction(target.motion.direction) } }
    }
    if (target.kind === 'effort') {
      const geometry = loadBarGeometry(input.model, target.barId)
      if (!geometry || !Number.isFinite(target.s) || target.s < 0 || target.s > geometry.length) {
        throw new RangeError('La estación del corte debe pertenecer a la barra objetivo.')
      }
    }
    structuralValue(base, target)
    const cut = target.kind === 'effort' ? target : undefined
    const stepWithCut = cut && path.find(item => item.barId === cut.barId)
    let cutS: number | undefined
    if (cut && stepWithCut) {
      const forward = stepWithCut.reversed ? stepWithCut.length - cut.s : cut.s
      cutS = forward === 0 ? stepWithCut.from : forward === stepWithCut.length ? stepWithCut.to : stepWithCut.from + forward
    }
    const breaks = [...new Set([0, ...path.map(item => item.to), ...(cutS === undefined ? [] : [cutS])])].sort((a, b) => a - b)
    function loadAt(S: number, magnitude: number, id: string): StructuralLoad[] {
      const point = mobileLocation(path, S)
      if (!point) return []
      const s = cut && S === cutS && point.step.barId === cut.barId ? cut.s : point.s
      return [{ id, kind: 'point', barId: point.step.barId, s, frame: 'global', force: { x: unit.x * magnitude, y: unit.y * magnitude } }]
    }
    const at = (s: number) => direct(input, target, loadAt(s, 1, '@movil'))
    const pieces = breaks.slice(1).map((to, i) => sampleCubic(breaks[i]!, to, at))
    const knots = curveKnots(pieces, at)
    let verification: InfluenceDetail['verification'] | undefined
    for (const piece of pieces) {
      if (!piece.coefficients.every(Number.isFinite)) throw new RangeError('La ordenada polinómica supera el rango numérico.')
      const length = piece.to - piece.from
      const trials = new Set(INTERIOR_ABSCISSAE.map(t => piece.from + length * t))
      const s = piece.from + length / 2
      if (s === piece.from || s === piece.to || trials.has(s)) {
        throw new RangeError('Float64 no distingue una quinta abscisa para verificar el tramo de influencia.')
      }
      const evaluated = at(s)
      const ordinate = cubicValue(piece.coefficients, (s - piece.from) / length)
      const maxError = Math.abs(ordinate - evaluated)
      const scale = Math.max(Math.abs(evaluated), ...piece.coefficients.map(Math.abs))
      if (maxError > 1e-10 + 2e-7 * scale) throw new RangeError('El polinomio por tramo no concuerda con el caso unitario directo.')
      if (!verification || maxError > verification.maxError) verification = { s, direct: evaluated, ordinate, maxError }
    }
    const extremes = extrema(pieces, knots)
    let train: InfluenceDetail['train']
    if (options.train) {
      const spec = options.train
      const envelope = trainEnvelope(pieces, knots, spec)
      const positions = envelope.pieces.map(piece => (piece.from + piece.to) / 2)
      const axlesAt = (x: number) => spec.axles.flatMap(axle =>
        loadAt(axleStation(knots, x, spec.sense * axle.offset), axle.force, `@eje-${axle.id}`))
      const s = positions.reduce((a, b) => axlesAt(b).length > axlesAt(a).length ? b : a, positions[0]!)
      const evaluated = direct(input, target, axlesAt(s))
      const ordinate = curveAt(envelope.pieces, envelope.knots, s)
      const sumAbsForce = compensatedSum(spec.axles.map(axle => Math.abs(axle.force)))
      const scale = Math.max(Math.abs(extremes.min.value), Math.abs(extremes.max.value)) * sumAbsForce
      if (!Number.isFinite(scale) || Math.abs(evaluated - ordinate) > 1e-8 + 2e-7 * Math.max(Math.abs(evaluated), scale)) {
        throw new RangeError('La suma de los ejes no concuerda con el caso directo del tren.')
      }
      train = { spec, envelope, verification: { s, direct: evaluated, ordinate } }
    }
    return { ok: true, result: base, detail: { kind: 'influence', target, direction: unit, path, pieces, knots,
      ...extremes, zeros: curveZeros(pieces, knots), verification: verification!, train } }
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause
    return methodFailure(input, cause.message)
  }
}
