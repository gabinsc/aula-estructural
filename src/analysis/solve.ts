import type { AnalysisDiagnostic, AnalysisInput, AnalysisResult, BarResult, ComponentChecks, ComponentTrace, ElementTrace, PreparedNodalLoad, PreparedTrussModel, SupportTrace, TrussAnalysisResult } from './contracts'
import { condensedFrameStiffness, frameTransformation, recoverFrame } from './frame'
import { CONDITION_WARNING, solvePositiveDefinite } from './linear'
import { prepareAnalysis, prepareTruss } from './prepare'
import type { Preparation } from './prepare'
import { checkComponent, checkFrameEnds, computeReactions } from './recover'
import { assembleModel, frameGlobalStiffness, reduceComponent, trussStiffness } from './assembly'

export const TRUSS_ENGINE_VERSION = '4.2.0'
export const ANALYSIS_ENGINE_VERSION = '4.3.0'

/** Resuelve una instantánea estructural sin modificarla. Un fallo devuelve solo diagnósticos. */
export function solveTruss(input: AnalysisInput): TrussAnalysisResult {
  return solve(input, prepareTruss(input), TRUSS_ENGINE_VERSION)
}

export function solveAnalysis(input: AnalysisInput): AnalysisResult {
  return solve(input, prepareAnalysis(input), ANALYSIS_ENGINE_VERSION)
}

function solve(input: AnalysisInput, prepared: Preparation<PreparedTrussModel>, engineVersion: typeof TRUSS_ENGINE_VERSION): TrussAnalysisResult
function solve(input: AnalysisInput, prepared: Preparation, engineVersion: typeof ANALYSIS_ENGINE_VERSION): AnalysisResult
function solve(input: AnalysisInput, prepared: Preparation, engineVersion: string): AnalysisResult {
  const provenance = { engineVersion, caseId: input.loadCase.id, revision: input.revision }
  if (!prepared.ok) return { ...provenance, ok: false, diagnostics: prepared.diagnostics }
  const { model } = prepared
  const diagnostics = [...prepared.diagnostics]
  const fail = (diagnostic: Omit<AnalysisDiagnostic, 'severity'>): AnalysisResult => ({
    ...provenance, ok: false, diagnostics: [...diagnostics, { ...diagnostic, severity: 'error' }],
  })
  const { K, F, equivalentLocal, condensedLocal, equivalentGlobal, equivalentLoads, memberLoads } = assembleModel(model, input.includeTrace)
  if (!K.every(Number.isFinite) || !F.every(Number.isFinite)) {
    return fail({ code: 'NUMERICAL_FAILURE', message: 'El ensamblaje global supera el rango de Float64.' })
  }
  const u = new Float64Array(F.length)
  const bars = new Map(model.bars.map(bar => [bar.barId, bar]))
  const solved = model.components.map(component => {
    const reduced = reduceComponent(model, component, bars, F)
    return { component, reduced, solution: solvePositiveDefinite(reduced.Kr, reduced.Fr, reduced.incidentStiffness) }
  })
  for (const { component, reduced, solution } of solved) {
    if (!solution.ok) return fail({
      code: solution.code, message: solution.message, nodeIds: component.nodeIds, barIds: component.barIds,
      direction: solution.index === undefined ? undefined : reduced.reducedDofs[solution.index],
    })
    if (solution.rcond !== null && solution.rcond < CONDITION_WARNING) diagnostics.push({
      code: 'ILL_CONDITIONED', severity: 'warning', nodeIds: component.nodeIds, barIds: component.barIds,
      message: 'El sistema equilibrado está mal condicionado. Revisa la geometría y las rigideces.',
    })
    for (const [index, { nodeId, direction, axis }] of reduced.reducedDofs.entries()) {
      const [x, y, rz] = model.dofByNode.get(nodeId)!
      if (axis === 'rz') u[rz!] = solution.z[index]!
      else {
        u[x] = u[x]! + direction.x * solution.z[index]!
        u[y] = u[y]! + direction.y * solution.z[index]!
      }
    }
  }
  const R = computeReactions(K, u, F)
  if (!u.every(Number.isFinite) || !R.every(Number.isFinite)) {
    return fail({ code: 'NUMERICAL_FAILURE', message: 'Desplazamientos o reacciones no representables.' })
  }
  const loadsByNode = new Map<string, PreparedNodalLoad[]>()
  for (const load of model.loads) {
    if (load.kind !== 'nodal') continue
    const list = loadsByNode.get(load.nodeId)
    if (list) list.push(load)
    else loadsByNode.set(load.nodeId, [load])
  }
  const checks: ComponentChecks[] = []
  const components: ComponentTrace[] = []
  const supports: SupportTrace[] = []
  for (const { component, reduced, solution } of solved) {
    if (!solution.ok) continue
    const checked = checkComponent(model, component, reduced, u, R, loadsByNode, bars, memberLoads, solution.backwardError, solution.rcond)
    if (!checked.valid) return fail({
      code: 'EQUILIBRIUM_FAILURE', nodeIds: component.nodeIds, barIds: component.barIds,
      message: 'La solución no satisface equilibrio y compatibilidad dentro de las tolerancias.',
    })
    checks.push(checked.checks)
    if (input.includeTrace) {
      const { dofIndices, reducedDofs, Kr, Fr } = reduced
      for (const nodeId of component.nodeIds) {
        const support = model.supports.get(nodeId)
        if (support) supports.push({ support, normal: reduced.normals.get(nodeId),
          tangent: reducedDofs.find(dof => dof.nodeId === nodeId && dof.axis === 'tangent')?.direction })
      }
      const Q = new Float64Array(dofIndices.length * reducedDofs.length)
      const localDof = new Map(dofIndices.map((index, row) => [index, row]))
      for (const [col, { nodeId, direction, axis }] of reducedDofs.entries()) {
        const [x, y, rz] = model.dofByNode.get(nodeId)!
        if (axis === 'rz') Q[localDof.get(rz!)! * reducedDofs.length + col] = 1
        else {
          Q[localDof.get(x)! * reducedDofs.length + col] = direction.x
          Q[localDof.get(y)! * reducedDofs.length + col] = direction.y
        }
      }
      components.push({ nodeIds: component.nodeIds, dofIndices, reducedDofs, Q, Kr, Fr, scaling: solution.scaling, z: solution.z })
    }
  }
  const nodalValues = (nodeId: string, vector: Float64Array, angular: 'rotation' | 'moment') => {
    const [x, y, rz] = model.dofByNode.get(nodeId)!
    const hasTranslationSupport = angular === 'rotation' || model.supports.has(nodeId)
    const translation = { nodeId, x: hasTranslationSupport ? vector[x]! : 0, y: hasTranslationSupport ? vector[y]! : 0 }
    if (rz === undefined || (angular === 'moment' && !model.rotationLocks.has(nodeId))) return translation
    return { ...translation, [angular]: vector[rz]! }
  }
  const elements: BarResult[] = []
  for (const bar of model.bars) {
    if (bar.kind === 'frame2d') {
      try {
        const result = recoverFrame(bar, u, memberLoads.get(bar.barId) ?? [], equivalentLocal.get(bar.barId)!)
        if (!checkFrameEnds(result)) return fail({
          code: 'EQUILIBRIUM_FAILURE', barIds: [bar.barId],
          message: 'Los campos de sección no satisfacen el equilibrio o las condiciones de extremo.',
        })
        elements.push(result)
      } catch (error) {
        if (!(error instanceof RangeError)) throw error
        return fail({ code: 'NUMERICAL_FAILURE', barIds: [bar.barId], message: error.message })
      }
      continue
    }
    const [xi, yi, xj, yj] = bar.dofIndices
    const elongation = bar.unit.x * (u[xj]! - u[xi]!) + bar.unit.y * (u[yj]! - u[yi]!)
    elements.push({ barId: bar.barId, elongation, axialForce: bar.axialStiffness * elongation })
  }
  const invalidBar = elements.find(bar => !Number.isFinite(bar.elongation) || !Number.isFinite(bar.axialForce))
  if (invalidBar) return fail({ code: 'NUMERICAL_FAILURE', barIds: [invalidBar.barId], message: 'Esfuerzo axial no representable.' })
  const origin = model.nodes[0]!
  const trace = input.includeTrace ? { K, F, u, R, supports, components,
    nodes: model.nodes.map(node => ({ ...node, x: node.x - origin.x, y: node.y - origin.y })),
    elements: model.bars.map((bar): ElementTrace => {
    const { barId, startId, endId, dofIndices, E, A, kind, length, unit, axialStiffness } = bar
    const id = { barId, startId, endId, dofIndices, E, A, kind, length, unit, axialStiffness,
      equivalentLoads: equivalentLoads.get(barId) ?? [] }
    if (bar.kind === 'truss2d') {
      const a = bar.axialStiffness
      const { x: c, y: s } = bar.unit
      return { ...id, K: trussStiffness(bar), localK: Float64Array.of(a, -a, -a, a),
        T: Float64Array.of(c, s, 0, 0, 0, 0, c, s) }
    }
    return {
      ...id, I: bar.I, EI: bar.EI, K: frameGlobalStiffness(bar), localK: condensedFrameStiffness(bar), T: frameTransformation(bar.unit),
      equivalentLocal: condensedLocal.get(barId), equivalentGlobal: equivalentGlobal.get(barId),
    }
  }) } : undefined
  return { ...provenance, ok: true, diagnostics, dofs: model.dofs, loads: model.loads, checks,
    displacements: model.nodes.map(node => nodalValues(node.id, u, 'rotation')),
    reactions: model.nodes.filter(node => model.supports.has(node.id) || model.rotationLocks.has(node.id))
      .map(node => nodalValues(node.id, R, 'moment')),
    bars: elements, trace }
}
