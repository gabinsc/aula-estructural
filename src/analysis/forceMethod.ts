import type { Structure } from '../domain/structure'
import type { NodalSupport } from '../domain/support'
import { rollerNormal } from './assembly'
import type { AnalysisInput } from './contracts'
import { evaluateFrameSection } from './frame'
import { CONDITION_WARNING, solvePositiveDefinite } from './linear'
import { solveAnalysis } from './solve'
import { compensatedSum } from './summation'
import { action, activeLoads, conjugate, methodFailure, modelCase } from './virtualWork'
import type { MethodFailure, Motion } from './virtualWork'
import { integrateWork } from './workIntegral'
import type { Solved, WorkIntegral } from './workIntegral'

export const MAX_REDUNDANTS = 8
type Axis = 'x' | 'y' | 'normal' | 'rotation'

export interface Redundant {
  readonly id: string
  readonly nodeId: string
  readonly support: NodalSupport['kind']
  readonly axis: Axis
  readonly motion: Motion
}

export function rotationNodes(model: Structure, assignments: Structure['mechanics']['assignments'] = model.mechanics.assignments) {
  const frames = new Set(assignments.filter(item => item.kind === 'frame2d').map(item => item.barId))
  return new Set(model.bars.filter(bar => frames.has(bar.id)).flatMap(bar => [bar.startId, bar.endId]))
}

export function availableRedundants(model: Structure, rotations = rotationNodes(model)): readonly Redundant[] {
  return model.supports.flatMap((support): Redundant[] => {
    const { nodeId, kind } = support
    const candidate = (axis: Axis, motion: Motion): Redundant => ({ id: `${nodeId}:${axis}`, nodeId, support: kind, axis, motion })
    if (kind === 'roller') return [candidate('normal', { kind: 'translation', direction: rollerNormal(support.surfaceAngle) })]
    const choices = [candidate('x', { kind: 'translation', direction: { x: 1, y: 0 } }),
      candidate('y', { kind: 'translation', direction: { x: 0, y: 1 } })]
    if (kind === 'fixed' && rotations.has(nodeId)) choices.push(candidate('rotation', { kind: 'rotation' }))
    return choices
  })
}

export interface PrimaryConstraints {
  readonly supports: readonly NodalSupport[]
  readonly rotationLocks: readonly string[]
}

function primaryConstraints(model: Structure, selected: readonly Redundant[], rotations: ReadonlySet<string>): PrimaryConstraints {
  const byId = new Set(selected.map(item => item.id))
  const rotationLocks: string[] = []
  const supports = model.supports.flatMap((support): readonly NodalSupport[] => {
    const { nodeId, kind } = support
    if (kind === 'roller') return byId.has(`${nodeId}:normal`) ? [] : [support]
    const freeX = byId.has(`${nodeId}:x`)
    const freeY = byId.has(`${nodeId}:y`)
    const fixed = kind === 'fixed' && !byId.has(`${nodeId}:rotation`)
    if (!freeX && !freeY) return [{ nodeId, kind: fixed ? 'fixed' : 'pinned' }]
    if (fixed && rotations.has(nodeId)) rotationLocks.push(nodeId)
    if (freeX && freeY) return []
    return [{ nodeId, kind: 'roller', surfaceAngle: freeX ? 0 : -Math.PI / 2 }]
  })
  return { supports, rotationLocks }
}

type ErrorMetric = 'length' | 'rotation' | 'force' | 'moment'
interface RecoveryComparison {
  readonly maximum: Readonly<Record<ErrorMetric, number>>
  readonly agrees: boolean
}

function compareResults(original: Solved, reconstructed: Solved): RecoveryComparison {
  const maximum = { length: 0, rotation: 0, force: 0, moment: 0 }
  let agrees = true
  function check(metric: ErrorMetric, a: number, b: number) {
    const abs = Math.abs(a - b)
    maximum[metric] = Math.max(maximum[metric], abs)
    const floor = metric === 'force' || metric === 'moment' ? 1e-6 : 1e-9
    agrees &&= abs <= floor + 1e-7 * Math.max(Math.abs(a), Math.abs(b))
  }
  for (const values of [original.displacements, original.reactions]) {
    const kinematic = values === original.displacements
    const other = new Map((kinematic ? reconstructed.displacements : reconstructed.reactions).map(item => [item.nodeId, item]))
    for (const a of values) {
      const b = other.get(a.nodeId)!
      check(kinematic ? 'length' : 'force', a.x, b.x)
      check(kinematic ? 'length' : 'force', a.y, b.y)
      if (kinematic) check('rotation', 'rotation' in a ? a.rotation ?? 0 : 0, 'rotation' in b ? b.rotation ?? 0 : 0)
      else check('moment', 'moment' in a ? a.moment ?? 0 : 0, 'moment' in b ? b.moment ?? 0 : 0)
    }
  }
  const others = new Map(reconstructed.bars.map(bar => [bar.barId, bar]))
  for (const a of original.bars) {
    const b = others.get(a.barId)!
    check('length', a.elongation, b.elongation)
    if (a.kind !== 'frame2d' || b.kind !== 'frame2d') {
      check('force', a.axialForce, b.axialForce)
      continue
    }
    const stations = new Set([...a.sections, ...b.sections].map(section => section.s))
    const ordered = [...stations].sort((x, y) => x - y)
    // Cuatro abscisas distintas determinan los polinomios de esfuerzo de grado ≤ 3.
    const interior = ordered.slice(1).flatMap((hi, i) => [1 / 4, 1 / 2, 3 / 4].map(t => ordered[i]! + (hi - ordered[i]!) * t))
    for (const s of [...ordered, ...interior]) for (const side of ['left', 'right'] as const) {
      const aa = evaluateFrameSection(a, s, side)
      const bb = evaluateFrameSection(b, s, side)
      check('force', aa.N, bb.N)
      check('force', aa.V, bb.V)
      check('moment', aa.M, bb.M)
      check('length', aa.u, bb.u)
      check('length', aa.v, bb.v)
      check('rotation', aa.rotation, bb.rotation)
    }
  }
  return { maximum, agrees }
}

export interface ForceMethodDetail {
  readonly kind: 'forces'
  readonly redundants: readonly Redundant[]
  readonly primary: PrimaryConstraints
  readonly primaryIndeterminacy: number
  readonly delta: readonly WorkIntegral[]
  readonly flexibility: readonly (readonly WorkIntegral[])[]
  readonly values: readonly number[]
  readonly compatibility: readonly number[]
  readonly reciprocalCondition: number
  readonly symmetryError: number
  readonly backwardError: number
  readonly comparison: RecoveryComparison
}

function displacement(result: Solved, redundant: Redundant) {
  return conjugate(result.displacements.find(item => item.nodeId === redundant.nodeId)!, redundant.motion)
}

export function solveForceMethod(input: AnalysisInput, ids: readonly string[]):
  MethodFailure | { readonly ok: true; readonly result: Solved; readonly detail: ForceMethodDetail } {
  if (!ids.length) return methodFailure(input, 'Selecciona al menos una reacción redundante. Sin liberaciones no se forma la matriz de flexibilidad.')
  if (ids.length > MAX_REDUNDANTS) return methodFailure(input, `El método permite hasta ${MAX_REDUNDANTS} redundantes por consulta.`)
  if (ids.length !== new Set(ids).size) return methodFailure(input, 'Las redundantes repetidas son linealmente dependientes.')
  const rotations = rotationNodes(input.model, input.definition.assignments)
  const options = new Map(availableRedundants(input.model, rotations).map(item => [item.id, item]))
  const redundants = ids.flatMap(id => options.get(id) ?? [])
  if (redundants.length !== ids.length) return methodFailure(input, 'Alguna restricción seleccionada ya no está activa.')
  const reference = solveAnalysis({ ...input, includeTrace: false })
  if (!reference.ok) return { ok: false, result: reference }
  const primary = primaryConstraints(input.model, redundants, rotations)
  const base = modelCase({ ...input, model: { ...input.model, supports: primary.supports }, rotationLocks: primary.rotationLocks }, activeLoads(input))
  const real = solveAnalysis(base)
  if (!real.ok) return methodFailure(input, `La primaria liberada (${ids.join(', ')}) no es estable o compatible. Elige otras restricciones.`,
    'UNSTABLE_OR_SINGULAR', real.diagnostics)
  // La estabilidad garantiza rango completo en las coordenadas libres. Cada barra
  // aporta uno (armadura) o tres (pórtico) modos elásticos independientes.
  const lockedTranslations = primary.supports.reduce((sum, support) => sum + (support.kind === 'roller' ? 1 : 2), 0)
  const lockedRotations = new Set([...primary.rotationLocks, ...primary.supports
    .filter(support => support.kind === 'fixed' && rotations.has(support.nodeId)).map(support => support.nodeId)])
  const freeDofs = real.dofs.length - lockedTranslations - lockedRotations.size
  const primaryIndeterminacy = input.definition.assignments.reduce((sum, bar) => sum + (bar.kind === 'frame2d' ? 3 : 1), 0) - freeDofs
  const units: Solved[] = []
  for (const { id, nodeId, motion } of redundants) {
    const result = solveAnalysis(modelCase(base, [action(nodeId, motion)], id))
    if (!result.ok) return methodFailure(input, `No se pudo resolver el sistema unitario de ${id}.`, 'NUMERICAL_FAILURE', result.diagnostics)
    units.push(result)
  }
  try {
    const { model, definition } = base
    const n = units.length
    const delta = units.map(unit => integrateWork(model, definition, real, unit, undefined, false))
    const energy = (i: number, j: number) => integrateWork(model, definition, units[i]!, units[j]!, undefined, false)
    const flexibility = units.map((_, i) => units.map((__, j) => i <= j ? energy(i, j) : undefined))
    const symmetric = flexibility.map((row, i) => row.map((cell, j) => cell ?? flexibility[j]![i]!))
    const matrix = Float64Array.from(symmetric.flatMap(row => row.map(cell => cell.total)))
    const diag = Float64Array.from(units, (_, i) => matrix[i * n + i]!)
    let symmetryError = 0
    for (const [i, row] of redundants.entries()) for (const [j, column] of redundants.entries()) {
      const a = displacement(units[j]!, row)
      const b = displacement(units[i]!, column)
      const scale = Math.sqrt(diag[i]!) * Math.sqrt(diag[j]!)
      const asymmetry = Math.abs(a - b) / scale
      symmetryError = Math.max(symmetryError, asymmetry)
      if (!Number.isFinite(asymmetry) || asymmetry > 1e-7 || Math.abs(a - matrix[i * n + j]!) > 1e-7 * scale) {
        return methodFailure(input, 'Los sistemas unitarios no cumplen reciprocidad y concordancia energética.', 'NUMERICAL_FAILURE')
      }
    }
    for (const [i, redundant] of redundants.entries()) {
      const direct = displacement(real, redundant)
      const work = delta[i]!.total
      if (Math.abs(direct - work) > 1e-9 + 1e-7 * Math.max(Math.abs(direct), Math.abs(work))) {
        return methodFailure(input, 'El desplazamiento primario no concuerda con su integral de trabajo.', 'NUMERICAL_FAILURE')
      }
    }
    const solution = solvePositiveDefinite(matrix, Float64Array.from(delta, item => -item.total), diag)
    if (!solution.ok) return methodFailure(input, `Flexibilidad singular o mal condicionada. ${solution.message}`, solution.code)
    const values = [...solution.z]
    const applied = redundants.map(({ nodeId, motion }, i) => action(nodeId, motion, values[i]!, `@redundante-${i}`))
    const recovered = solveAnalysis(modelCase(base, [...base.model.loads, ...applied]))
    if (!recovered.ok) return methodFailure(input, 'Falló la recuperación por superposición en el sistema primario.', 'NUMERICAL_FAILURE', recovered.diagnostics)
    const compatibility = redundants.map(item => displacement(recovered, item))
    const compatible = compatibility.every((value, i) => {
      const contributions = values.map((x, j) => Math.abs(x * matrix[i * n + j]!))
      const scale = compensatedSum([Math.abs(delta[i]!.total), ...contributions])
      return Number.isFinite(scale) && Math.abs(value) <= 1e-9 + 1e-7 * scale
    })
    if (!compatible) return methodFailure(input, 'La recuperación incumple la compatibilidad en las restricciones liberadas.', 'EQUILIBRIUM_FAILURE')
    const retained = new Map(recovered.reactions.map(reaction => [reaction.nodeId, reaction]))
    const reactions = reference.reactions.map(({ nodeId, moment }) => {
      const support = retained.get(nodeId)
      const loads = applied.filter(item => item.nodeId === nodeId)
      const x = compensatedSum([support?.x ?? 0, ...loads.map(load => load.force.x)])
      const y = compensatedSum([support?.y ?? 0, ...loads.map(load => load.force.y)])
      return { nodeId, x, y, ...(moment === undefined ? {} : { moment: compensatedSum([support?.moment ?? 0,
        ...loads.map(load => load.moment)]) }) }
    })
    const rcond = solution.rcond!
    const diagnostics = [...real.diagnostics, ...recovered.diagnostics]
    if (rcond < CONDITION_WARNING) diagnostics.push({ code: 'ILL_CONDITIONED', severity: 'warning',
      message: 'La flexibilidad equilibrada tiene una condición recíproca baja.' })
    const result: Solved = { ...recovered, reactions, diagnostics, loads: recovered.loads.filter(load => !load.id.startsWith('@redundante-')) }
    const comparison = compareResults(reference, result)
    if (!comparison.agrees) diagnostics.push({ code: 'NUMERICAL_FAILURE', severity: 'warning',
      message: 'La recuperación por flexibilidad difiere de la referencia de rigidez.' })
    return { ok: true, result, detail: { kind: 'forces', redundants, primary, primaryIndeterminacy, delta, flexibility: symmetric, values,
      compatibility, reciprocalCondition: rcond, symmetryError, backwardError: solution.backwardError, comparison } }
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause
    return methodFailure(input, cause.message, 'NUMERICAL_FAILURE')
  }
}
