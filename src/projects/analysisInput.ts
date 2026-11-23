import type { AnalysisCase, AnalysisDiagnostic, AnalysisInput, ElementAssignment } from '../analysis'
import type { Structure } from '../domain/structure'
import { catalogOf } from '../domain/library'
import { parseModel } from './document'

export const ALL_LOADS: AnalysisCase = { id: 'todas' }

function ordered<T>(items: readonly T[], id: (item: T) => string) {
  return [...items].sort((a, b) => id(a).localeCompare(id(b), 'en', { numeric: true }))
}

/** Clave exacta del estado físico. Las etiquetas, contadores y elementos de vista no intervienen. */
export function analysisRevision(model: Structure, loadCase: AnalysisCase): string {
  const library = catalogOf(model)
  const materials = new Map(library.materials.map(entry => [entry.id, entry]))
  const sections = new Map(library.sections.map(entry => [entry.id, entry]))
  return JSON.stringify([
    ordered(model.nodes, item => item.id).map(({ id, x, y }) => [id, x, y]),
    ordered(model.bars, item => item.id).map(({ id, startId, endId, releaseI, releaseJ }) =>
      [id, startId, endId, releaseI === true, releaseJ === true]),
    ordered(model.supports, item => item.nodeId).map(item =>
      [item.nodeId, item.kind, item.kind === 'roller' ? item.surfaceAngle : null]),
    ordered(model.loads, item => item.id).map(load => {
      if (load.kind === 'nodal') return [load.id, load.kind, load.nodeId, load.force.x, load.force.y, load.moment]
      if (load.kind === 'point') return [load.id, load.kind, load.barId, load.frame, load.s, load.force.x, load.force.y]
      return [load.id, load.kind, load.barId, load.frame, load.profile, load.s0, load.s1, load.q0.x, load.q0.y, load.q1.x, load.q1.y]
    }),
    ordered(model.mechanics.assignments, item => item.barId).map(({ barId, kind, E, A, I, materialId, sectionId, sectionAxis }) => {
      const material = materialId ? materials.get(materialId) : undefined
      const section = sectionId ? sections.get(sectionId) : undefined
      return [barId, kind, E, A, I, materialId, material?.nu, material?.density, sectionId, sectionAxis, section?.geometry]
    }),
    loadCase.id, loadCase.loadIds ? [...loadCase.loadIds].sort() : null,
  ])
}

export function missingMechanics(model: Structure): readonly AnalysisDiagnostic[] {
  const assignments = new Map(model.mechanics.assignments.map(item => [item.barId, item]))
  return model.bars.flatMap(({ id }): AnalysisDiagnostic[] => {
    const values = assignments.get(id)
    const missing = !values ? ['tipo resistente', 'E', 'A'] : (['E', 'A', ...(values.kind === 'frame2d' ? ['I'] as const : [])] as const)
      .filter(field => values[field] === undefined)
    return missing.length ? [{
      code: 'INVALID_ASSIGNMENT', severity: 'error', barIds: [id], message: `Falta configurar ${missing.join(', ')}.`,
    }] : []
  })
}

export type AnalysisRequest =
  | { readonly status: 'ready'; readonly input: AnalysisInput }
  | { readonly status: 'incomplete' | 'failed'; readonly diagnostics: readonly AnalysisDiagnostic[] }

export function makeAnalysisRequest(model: Structure, loadCase: AnalysisCase, revision: string): AnalysisRequest {
  let snapshot: Structure
  try { snapshot = parseModel(model) }
  catch (cause) {
    return { status: 'failed', diagnostics: [{
      code: 'INVALID_MODEL', severity: 'error',
      message: cause instanceof Error ? cause.message : 'El documento estructural no es válido.',
    }] }
  }
  const diagnostics = missingMechanics(snapshot)
  if (diagnostics.length) return { status: 'incomplete', diagnostics }
  const assignments = snapshot.mechanics.assignments.map(({ barId, kind, E, A, I }): ElementAssignment =>
    kind === 'frame2d' ? { barId, kind, E: E!, A: A!, I: I! } : { barId, kind, E: E!, A: A! })
  return { status: 'ready', input: { model: snapshot, definition: { version: 1, assignments },
    loadCase: { id: loadCase.id, loadIds: loadCase.loadIds && [...loadCase.loadIds] }, revision, includeTrace: true } }
}
