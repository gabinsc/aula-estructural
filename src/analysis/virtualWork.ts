import { splitBar } from '../domain/barEdition'
import { globalLoadVector, loadBarGeometry } from '../domain/load'
import type { StructuralLoad } from '../domain/load'
import type { Point } from '../geometry/coordinates'
import type { AnalysisDiagnostic, AnalysisInput, AnalysisResult } from './contracts'
import { evaluateFrameSection } from './frame'
import { ANALYSIS_ENGINE_VERSION, solveAnalysis } from './solve'
import { integrateWork } from './workIntegral'
import type { MemberSource, Solved, WorkIntegral } from './workIntegral'

export type Target = { readonly kind: 'node'; readonly id: string } |
  { readonly kind: 'section'; readonly id: string; readonly s: number }
export type Motion = { readonly kind: 'rotation' } | { readonly kind: 'translation'; readonly direction: Point }
export interface VirtualObjective { readonly target: Target; readonly motion: Motion }

export interface VirtualWorkDetail {
  readonly kind: 'virtual'
  readonly objective: VirtualObjective
  readonly work: WorkIntegral
  readonly reference: number
  readonly absoluteError: number
  readonly relativeError: number | null
  readonly agrees: boolean
}

export type MethodFailure = { readonly ok: false; readonly result: Extract<AnalysisResult, { ok: false }> }

export function methodFailure(input: AnalysisInput, message: string, code: AnalysisDiagnostic['code'] = 'INVALID_MODEL',
  diagnostics: readonly AnalysisDiagnostic[] = []): MethodFailure {
  return { ok: false, result: { ok: false, engineVersion: ANALYSIS_ENGINE_VERSION, revision: input.revision,
    caseId: input.loadCase.id, diagnostics: [{ code, severity: 'error', message }, ...diagnostics] } }
}

export function activeLoads(input: AnalysisInput): readonly StructuralLoad[] {
  const selected = input.loadCase.loadIds && new Set(input.loadCase.loadIds)
  return selected ? input.model.loads.filter(load => selected.has(load.id)) : input.model.loads
}

export function action(nodeId: string, motion: Motion, magnitude = 1, id = '@unit'): Extract<StructuralLoad, { kind: 'nodal' }> {
  return motion.kind === 'rotation' ? { id, nodeId, kind: 'nodal', force: { x: 0, y: 0 }, moment: magnitude }
    : { id, nodeId, kind: 'nodal', force: { x: motion.direction.x * magnitude, y: motion.direction.y * magnitude }, moment: 0 }
}

export function conjugate(state: Point & { readonly rotation?: number }, motion: Motion): number {
  return motion.kind === 'rotation' ? state.rotation!
    : state.x * motion.direction.x + state.y * motion.direction.y
}

export function modelCase(input: AnalysisInput, loads: readonly StructuralLoad[], id = input.loadCase.id): AnalysisInput {
  return { ...input, includeTrace: false, model: { ...input.model, loads }, loadCase: { id } }
}

function prepareTarget(input: AnalysisInput, target: Target) {
  const sources = new Map<string, MemberSource>()
  if (target.kind === 'node') return { primary: input, nodeId: target.id, sources }
  const member = input.model.bars.find(bar => bar.id === target.id)
  const geometry = member && loadBarGeometry(input.model, member.id)
  if (!member || !geometry || !Number.isFinite(target.s) || target.s < 0 || target.s > geometry.length) {
    return { error: 'Indica una estación física entre 0 y L de una barra existente.' } as const
  }
  if (target.s === 0 || target.s === geometry.length) {
    return { primary: input, nodeId: target.s === 0 ? member.startId : member.endId, sources }
  }
  if (input.definition.assignments.find(bar => bar.barId === member.id)?.kind !== 'frame2d') {
    return { error: 'Las secciones interiores requieren un elemento de pórtico. Para armaduras, selecciona un nudo.' } as const
  }
  const split = splitBar(input.model, member.id, target.s, { preservePointStations: true })
  if ('error' in split) return split
  const ids = split.item.bars.map(bar => bar.id)
  sources.set(ids[0]!, { barId: member.id, offset: 0 })
  sources.set(ids[1]!, { barId: member.id, offset: target.s })
  const assignments = input.definition.assignments.flatMap(bar => bar.barId === member.id
    ? ids.map(barId => ({ ...bar, barId })) : [bar])
  return { primary: { ...input, model: split.model, definition: { ...input.definition, assignments } },
    nodeId: split.item.node.id, sources }
}

export function solveVirtualWork(input: AnalysisInput, objective: VirtualObjective):
  MethodFailure | { readonly ok: true; readonly result: Solved; readonly detail: VirtualWorkDetail } {
  const original = solveAnalysis({ ...input, includeTrace: false })
  if (!original.ok) return { ok: false, result: original }
  const { target } = objective
  let { motion } = objective
  if (motion.kind === 'translation') {
    const { x, y } = motion.direction
    const length = Math.hypot(x, y)
    if (!Number.isFinite(length) || length === 0) return methodFailure(input, 'La dirección de consulta debe ser finita y no nula.')
    motion = { kind: 'translation', direction: { x: x / length, y: y / length } }
  }
  const setup = prepareTarget(modelCase(input, activeLoads(input)), target)
  if ('error' in setup) return methodFailure(input, setup.error!)
  const { primary, nodeId, sources } = setup
  const real = sources.size ? solveAnalysis(primary) : original
  if (!real.ok) return methodFailure(input, 'El corte temporal no admite una solución fiable.', 'NUMERICAL_FAILURE', real.diagnostics)
  const atNode = real.displacements.find(item => item.nodeId === nodeId)
  if (!atNode || (motion.kind === 'rotation' && atNode.rotation === undefined)) {
    return methodFailure(input, 'El objetivo no existe o carece de un grado de giro activo.')
  }
  const virtual = solveAnalysis(modelCase(primary, [action(nodeId, motion)], 'carga-unitaria'))
  if (!virtual.ok) return methodFailure(input, 'El sistema unitario no pudo resolverse.', 'NUMERICAL_FAILURE', virtual.diagnostics)
  let reference = conjugate(atNode, motion)
  if (sources.size && target.kind === 'section') {
    const bar = original.bars.find(item => item.barId === target.id)!
    if (bar.kind !== 'frame2d') throw new Error('Falta el resultado del pórtico original.')
    const section = evaluateFrameSection(bar, target.s)
    const direction = globalLoadVector({ x: section.u, y: section.v }, 'local', loadBarGeometry(input.model, bar.barId)!.angle)
    reference = conjugate({ ...direction, rotation: section.rotation }, motion)
  }
  try {
    const work = integrateWork(primary.model, primary.definition, real, virtual, sources)
    const absoluteError = Math.abs(work.total - reference)
    const relativeError = reference === 0 ? null : absoluteError / Math.abs(reference)
    const agrees = absoluteError <= 1e-9 + 1e-7 * Math.max(Math.abs(work.total), Math.abs(reference))
    return { ok: true, result: original, detail: { kind: 'virtual', objective: { target, motion },
      work, reference, absoluteError, relativeError, agrees } }
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause
    return methodFailure(input, cause.message, 'NUMERICAL_FAILURE')
  }
}
