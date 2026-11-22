import type { AnalysisInput, AnalysisResult } from './contracts'
import { runMethod } from './methods'
import type { MethodDetail, MethodRequest } from './methods'

export type WorkerRequest = { readonly id: number; readonly input: AnalysisInput; readonly method?: MethodRequest }
export type WorkerResponse = { readonly id: number; readonly result: AnalysisResult; readonly detail?: MethodDetail }

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, input, method } = event.data
  self.postMessage({ id, ...runMethod(input, method) } satisfies WorkerResponse)
}
