import { solveForceMethod } from './forceMethod'
import type { ForceMethodDetail } from './forceMethod'
import { methodFailure, solveVirtualWork } from './virtualWork'
import type { VirtualObjective, VirtualWorkDetail } from './virtualWork'
import { solveAnalysis } from './solve'
import type { AnalysisInput, AnalysisResult } from './contracts'
import { solveCross } from './cross'
import type { CrossDetail } from './cross'
import { solveInfluence } from './influence'
import type { InfluenceDetail, InfluenceOptions } from './influence'

export type MethodRequest = { readonly kind: 'virtual'; readonly objective: VirtualObjective | null }
  | { readonly kind: 'forces'; readonly ids: readonly string[] }
  | { readonly kind: 'influence'; readonly options: InfluenceOptions | null }
  | { readonly kind: 'cross' }

export type MethodDetail = VirtualWorkDetail | ForceMethodDetail | InfluenceDetail | CrossDetail

export function runMethod(input: AnalysisInput, method?: MethodRequest):
  { readonly result: AnalysisResult; readonly detail?: MethodDetail } {
  if (!method) return { result: solveAnalysis(input) }
  if (method.kind === 'cross') {
    const solution = solveCross(input)
    return { result: solution.result, detail: solution.ok ? solution.detail : undefined }
  }
  if (method.kind === 'influence') {
    if (!method.options) return methodFailure(input, 'Completa el recorrido, el objetivo, las direcciones y los datos del tren.')
    const solution = solveInfluence(input, method.options)
    return { result: solution.result, detail: solution.ok ? solution.detail : undefined }
  }
  if (method.kind === 'forces') {
    const solution = solveForceMethod(input, method.ids)
    return { result: solution.result, detail: solution.ok ? solution.detail : undefined }
  }
  if (!method.objective) return methodFailure(input, 'Selecciona un nudo o barra, una estación válida y la dirección de la respuesta.')
  const solution = solveVirtualWork(input, method.objective)
  return { result: solution.result, detail: solution.ok ? solution.detail : undefined }
}
