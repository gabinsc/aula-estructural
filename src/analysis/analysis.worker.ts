import { solveAnalysis } from './solve'
import type { AnalysisInput, AnalysisResult } from './contracts'

export type WorkerRequest = { readonly id: number; readonly input: AnalysisInput }
export type WorkerResponse = { readonly id: number; readonly result: AnalysisResult }

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, input } = event.data
  const result = solveAnalysis(input)
  self.postMessage({ id, result } satisfies WorkerResponse)
}
