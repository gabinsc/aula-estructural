import { solveForceMethod } from './forceMethod'
import type { ForceMethodDetail } from './forceMethod'
import { methodFailure, solveVirtualWork } from './virtualWork'
import type { VirtualObjective, VirtualWorkDetail } from './virtualWork'
import { solveAnalysis } from './solve'
import type { AnalysisInput, AnalysisResult } from './contracts'
import { solveCross } from './cross'
import type { CrossDetail } from './cross'
import { solveInfluence } from './influence'
import type { InfluenceDetail, InfluenceOptions, InfluenceTarget } from './influence'

export type InfluenceQueryTarget = { readonly id: string; readonly target: InfluenceTarget }
export type InfluenceResultDetail = InfluenceDetail & {
  readonly lines?: readonly ({ readonly id: string; readonly detail: InfluenceDetail } | { readonly id: string; readonly error: string })[]
}

export type MethodRequest = { readonly kind: 'virtual'; readonly objective: VirtualObjective | null }
  | { readonly kind: 'forces'; readonly ids: readonly string[] }
  | { readonly kind: 'influence'; readonly options: InfluenceOptions | null; readonly targets?: readonly InfluenceQueryTarget[] }
  | { readonly kind: 'cross' }

export type MethodDetail = VirtualWorkDetail | ForceMethodDetail | InfluenceResultDetail | CrossDetail

export function runMethod(input: AnalysisInput, method?: MethodRequest):
  { readonly result: AnalysisResult; readonly detail?: MethodDetail } {
  if (!method) return { result: solveAnalysis(input) }
  if (method.kind === 'cross') {
    const solution = solveCross(input)
    return { result: solution.result, detail: solution.ok ? solution.detail : undefined }
  }
  if (method.kind === 'influence') {
    if (!method.options) return methodFailure(input, 'Completa el recorrido, el objetivo, las direcciones y los datos del tren.')
    const cache = new Map<string, AnalysisResult>()
    const solution = solveInfluence(input, method.options, cache)
    if (!solution.ok) return { result: solution.result }
    const lines = method.targets?.map(({ id, target }) => {
      if (JSON.stringify(target) === JSON.stringify(solution.detail.target)) return { id, detail: solution.detail }
      const additional = solveInfluence(input, { ...method.options!, target }, cache)
      return additional.ok ? { id, detail: additional.detail }
        : { id, error: additional.result.diagnostics.map(item => item.message).join(' ') }
    })
    return { result: solution.result, detail: { ...solution.detail, ...(lines?.length && { lines }) } }
  }
  if (method.kind === 'forces') {
    const solution = solveForceMethod(input, method.ids)
    return { result: solution.result, detail: solution.ok ? solution.detail : undefined }
  }
  if (!method.objective) return methodFailure(input, 'Selecciona un nudo o barra, una estación válida y la dirección de la respuesta.')
  const solution = solveVirtualWork(input, method.objective)
  return { result: solution.result, detail: solution.ok ? solution.detail : undefined }
}
