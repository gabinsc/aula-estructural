import { assembleModel, reduceComponent } from './assembly'
import type { AnalysisInput, PreparedNodalLoad } from './contracts'
import { recoverFrame, toLocalVector } from './frame'
import { prepareAnalysis } from './prepare'
import { checkComponent, checkFrameEnds, computeReactions } from './recover'
import { solveAnalysis } from './solve'
import { compensatedSum } from './summation'
import { methodFailure } from './virtualWork'
import type { MethodFailure } from './virtualWork'
import type { Solved } from './workIntegral'

const MAX_SWEEPS = 200

export interface CrossEnd {
  readonly id: string
  readonly barId: string
  readonly nodeId: string
  readonly opposite: string
  readonly stiffness: number
  readonly carry: number
  readonly factor: number
  readonly initial: number
}
export interface CrossJoint {
  readonly nodeId: string
  readonly fixed: boolean
  readonly applied: number
  readonly ends: readonly CrossEnd[]
}
export interface CrossBalance {
  readonly nodeId: string
  readonly imbalance: number
  readonly correction: number
  readonly rotationIncrement: number
  readonly ends: readonly { readonly id: string; readonly opposite: string; readonly distributed: number; readonly carried: number }[]
}
export interface CrossIteration {
  readonly sweep: number
  readonly before: number
  readonly residual: number
  readonly balances: readonly CrossBalance[]
  readonly moments: Readonly<Record<string, number>>
}
export interface CrossDetail {
  readonly kind: 'cross'
  readonly joints: readonly CrossJoint[]
  readonly iterations: readonly CrossIteration[]
  readonly final: Readonly<Record<string, number>>
  readonly reference: Readonly<Record<string, number>>
  readonly tolerance: number
  readonly residual: number
  readonly maxChordMoment: number
  readonly maxMomentError: number
  readonly maxReactionError: number
  readonly maxRotationError: number
}

/** Hardy Cross con far end bloqueado en cada distribución y transporte 1/2.
 * Las traslaciones del caso se admiten solo si no inducen un momento de cuerda significativo. */
export function solveCross(input: AnalysisInput):
  MethodFailure | { readonly ok: true; readonly result: Solved; readonly detail: CrossDetail } {
  if (input.definition.assignments.some(item => item.kind !== 'frame2d')) {
    return methodFailure(input, 'Cross admite vigas y pórticos prismáticos con nudos rígidos; el modelo contiene elementos de armadura.')
  }
  const base = prepareAnalysis(input)
  if (!base.ok) return methodFailure(input, 'Los datos del modelo no son compatibles con Cross.', 'INVALID_MODEL', base.diagnostics)
  const reference = solveAnalysis({ ...input, includeTrace: true })
  if (!reference.ok) return methodFailure(input, 'El modelo no es estable para distribuir momentos.', 'UNSTABLE_OR_SINGULAR', reference.diagnostics)
  const { model } = base
  const stiffness = assembleModel(model)
  const { K, F, equivalentLocal, memberLoads } = stiffness
  const byBar = new Map(model.bars.map(bar => [bar.barId, bar]))
  const u = reference.trace!.u.slice()
  const members = model.bars.flatMap(bar => bar.kind === 'frame2d' ? [bar] : [])
  const referenceEnds: Record<string, number> = {}
  for (const bar of reference.bars) if (bar.kind === 'frame2d') {
    referenceEnds[`${bar.barId}:i`] = bar.endForces[2]
    referenceEnds[`${bar.barId}:j`] = bar.endForces[5]
  }
  const incident = new Map(model.nodes.map(node => [node.id, [] as CrossEnd[]]))
  let scale = 1
  let maxChordMoment = 0
  for (const bar of members) {
    const [xi, yi, , xj, yj] = bar.dofIndices
    const { y: chord } = toLocalVector({ x: u[xj]! - u[xi]!, y: u[yj]! - u[yi]! }, bar.unit)
    maxChordMoment = Math.max(maxChordMoment, Math.abs(chord) * (6 * (bar.EI / bar.length) / bar.length))
    const k = 4 * (bar.EI / bar.length)
    const fem = equivalentLocal.get(bar.barId)!
    const i = `${bar.barId}:i`, j = `${bar.barId}:j`
    for (const [id, opposite, nodeId, value] of [[i, j, bar.startId, -fem[2]], [j, i, bar.endId, -fem[5]]] as const) {
      incident.get(nodeId)!.push({ id, opposite, barId: bar.barId, nodeId, initial: value, stiffness: k, carry: .5, factor: 0 })
      scale = Math.max(scale, Math.abs(value), Math.abs(referenceEnds[id]!))
    }
  }
  const groupedLoads = new Map<string, PreparedNodalLoad[]>()
  for (const load of model.loads) if (load.kind === 'nodal') {
    const previous = groupedLoads.get(load.nodeId) ?? []
    groupedLoads.set(load.nodeId, [...previous, load])
  }
  const totalStiffness = new Map<string, number>()
  const joints = model.nodes.map(({ id: nodeId }): CrossJoint => {
    const ends = incident.get(nodeId)!
    const fixed = model.rotationLocks.has(nodeId)
    const applied = compensatedSum((groupedLoads.get(nodeId) ?? []).map(load => load.moment))
    const sum = compensatedSum(ends.map(end => end.stiffness))
    totalStiffness.set(nodeId, sum)
    scale = Math.max(scale, Math.abs(applied))
    u[model.dofByNode.get(nodeId)![2]!] = 0
    return { nodeId, fixed, applied, ends: ends.map(end => ({ ...end, factor: fixed ? 0 : end.stiffness / sum })) }
  })
  if (!Number.isFinite(maxChordMoment) || maxChordMoment > 1e-7 + 1e-8 * scale) {
    return methodFailure(input, 'Cross sin traslación lateral no es aplicable: las traslaciones relativas producen momentos de cuerda apreciables.')
  }
  const free = joints.filter(joint => !joint.fixed)
  if (free.some(joint => !Number.isFinite(totalStiffness.get(joint.nodeId)!) || totalStiffness.get(joint.nodeId)! <= 0 ||
    Math.abs(compensatedSum(joint.ends.map(end => end.factor)) - 1) > 1e-12)) {
    return methodFailure(input, 'Rigideces o factores de distribución inválidos.', 'NUMERICAL_FAILURE')
  }
  const moments = Object.fromEntries(joints.flatMap(joint => joint.ends.map(end => [end.id, end.initial] as const)))
  const imbalance = (joint: CrossJoint) => compensatedSum(joint.ends.map(end => moments[end.id]!)) - joint.applied
  const maximum = () => free.reduce((max, joint) => Math.max(max, Math.abs(imbalance(joint))), 0)
  const tolerance = 1e-9 + 1e-12 * scale
  const iterations: CrossIteration[] = []
  let residual = maximum()
  for (let sweep = 1; residual > tolerance && sweep <= MAX_SWEEPS; sweep++) {
    const before = residual
    const balances = free.map((joint): CrossBalance => {
      const error = imbalance(joint)
      const correction = -error
      const rz = model.dofByNode.get(joint.nodeId)![2]!
      const rotationIncrement = correction / totalStiffness.get(joint.nodeId)!
      u[rz] = u[rz]! + rotationIncrement
      const ends = joint.ends.map(end => {
        const distributed = correction * end.factor
        const carried = distributed * end.carry
        moments[end.id] = moments[end.id]! + distributed
        moments[end.opposite] = moments[end.opposite]! + carried
        return { id: end.id, opposite: end.opposite, distributed, carried }
      })
      return { nodeId: joint.nodeId, imbalance: error, correction, rotationIncrement, ends }
    })
    residual = maximum()
    iterations.push({ sweep, before, residual, balances, moments: { ...moments } })
  }
  if (!Number.isFinite(residual) || residual > tolerance || !u.every(Number.isFinite)) {
    return methodFailure(input, `Cross no converge en ${MAX_SWEEPS} barridos. Residuo: ${residual} N·m.`, 'NUMERICAL_FAILURE')
  }
  const R = computeReactions(K, u, F)
  const reactions = reference.reactions.map(({ nodeId, moment }) => {
    const [x, y, rz] = model.dofByNode.get(nodeId)!
    return { nodeId, x: R[x]!, y: R[y]!, ...(moment !== undefined && { moment: R[rz!]! }) }
  })
  const displacements = reference.displacements.map(({ nodeId, x, y }) => ({
    nodeId, x, y, rotation: u[model.dofByNode.get(nodeId)![2]!]!,
  }))
  try {
    const bars = members.map(bar => recoverFrame(bar, u, memberLoads.get(bar.barId) ?? [], equivalentLocal.get(bar.barId)!))
    const checked = model.components.map((component, index) => checkComponent(model, component,
      reduceComponent(model, component, byBar, F), u, R, groupedLoads, byBar, memberLoads, 0,
      reference.checks[index]?.scaledRcondEstimate ?? null))
    if (!checked.every(item => item.valid) || !bars.every(checkFrameEnds)) {
      return methodFailure(input, 'Las rotaciones distribuidas no reproducen el equilibrio ni la compatibilidad del modelo. Revisa el alcance sin traslación lateral.', 'EQUILIBRIUM_FAILURE')
    }
    const maxMomentError = Math.max(0, ...Object.keys(moments).map(id => Math.abs(moments[id]! - referenceEnds[id]!)))
    const maxReactionError = Math.max(0, ...reactions.map((item, i) => Math.hypot(
      item.x - reference.reactions[i]!.x, item.y - reference.reactions[i]!.y)))
    const maxRotationError = Math.max(0, ...displacements.map((item, i) => Math.abs(item.rotation - reference.displacements[i]!.rotation!)))
    const recoveredError = Math.max(0, ...bars.flatMap(bar => [
      Math.abs(bar.endForces[2] - moments[`${bar.barId}:i`]!),
      Math.abs(bar.endForces[5] - moments[`${bar.barId}:j`]!),
    ]))
    if (Math.max(maxMomentError, recoveredError) > 1e-6 + 2e-8 * scale) {
      return methodFailure(input, 'Los momentos de Cross difieren de la recuperación o de la referencia matricial.', 'EQUILIBRIUM_FAILURE')
    }
    const result: Solved = { ...reference, trace: undefined, displacements, reactions, bars,
      checks: checked.map(item => item.checks) }
    return { ok: true, result, detail: { kind: 'cross', joints, iterations, final: moments, reference: referenceEnds,
      residual, tolerance, maxChordMoment, maxMomentError, maxReactionError, maxRotationError } }
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause
    return methodFailure(input, cause.message, 'NUMERICAL_FAILURE')
  }
}
