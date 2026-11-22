import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AnalysisCase, AnalysisDiagnostic, AnalysisResult } from '../../analysis'
import type { WorkerRequest, WorkerResponse } from '../../analysis/analysis.worker'
import type { MethodDetail, MethodRequest } from '../../analysis/methods'
import type { Structure } from '../../domain/structure'
import { analysisRevision, makeAnalysisRequest, missingMechanics } from '../../projects/analysisInput'

type Success = Extract<AnalysisResult, { ok: true }>
export type AnalysisState =
  | { readonly status: 'idle' }
  | { readonly status: 'incomplete' | 'failed'; readonly diagnostics: readonly AnalysisDiagnostic[] }
  | { readonly status: 'pending' | 'stale'; readonly revision: string }
  | { readonly status: 'current'; readonly result: Success; readonly detail?: MethodDetail }

export const ANALYSIS_STATUS: Record<AnalysisState['status'], string> = {
  idle: 'Sin análisis', incomplete: 'Datos incompletos', pending: 'Analizando…',
  current: 'Resultado vigente', stale: 'Resultado desactualizado', failed: 'Análisis fallido',
}

export function useAnalysis(model: Structure, loadCase: AnalysisCase, method?: MethodRequest) {
  const physicalRevision = useMemo(() => analysisRevision(model, loadCase), [model, loadCase])
  const revision = method ? JSON.stringify([physicalRevision, method]) : physicalRevision
  const missing = useMemo(() => missingMechanics(model), [model])
  const [stored, setStored] = useState<{ revision: string; state: AnalysisState }>()
  const running = useRef<{ id: number; revision: string; worker: Worker } | undefined>(undefined)
  const serial = useRef(0)

  function stop() {
    const task = running.current
    running.current = undefined
    task?.worker.terminate()
  }

  useLayoutEffect(() => {
    if (running.current?.revision !== revision) stop()
    setStored(previous => previous && previous.revision !== revision &&
      (previous.state.status === 'current' || previous.state.status === 'pending')
      ? { ...previous, state: { status: 'stale', revision: previous.revision } } : previous)
  }, [revision])
  useLayoutEffect(() => stop, [])

  function run() {
    stop()
    const request = makeAnalysisRequest(model, loadCase, revision)
    const update = (state: AnalysisState) => setStored({ revision, state })
    if (request.status !== 'ready') {
      update({ status: request.status, diagnostics: request.diagnostics })
      return
    }
    const id = ++serial.current
    const fail = () => update({ status: 'failed', diagnostics: [{
      code: 'NUMERICAL_FAILURE', severity: 'error', message: 'El proceso de análisis se interrumpió. Vuelve a ejecutar el cálculo.',
    }] })
    try {
      const worker = new Worker(new URL('../../analysis/analysis.worker.ts', import.meta.url), { type: 'module' })
      running.current = { id, revision, worker }
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (running.current?.id !== id || data.id !== id || data.result.revision !== revision) return
        stop()
        const result = data.result
        update(result.ok ? { status: 'current', result, detail: data.detail } : { status: 'failed', diagnostics: result.diagnostics })
      }
      worker.onerror = worker.onmessageerror = () => {
        if (running.current?.id !== id) return
        stop()
        fail()
      }
      update({ status: 'pending', revision })
      worker.postMessage({ id, input: request.input, ...(method && { method }) } satisfies WorkerRequest)
    } catch {
      stop()
      fail()
    }
  }
  const state: AnalysisState = stored?.revision === revision ? stored.state
    : stored && (stored.state.status === 'current' || stored.state.status === 'pending' || stored.state.status === 'stale')
      ? { status: 'stale', revision: stored.revision }
      : missing.length ? { status: 'incomplete', diagnostics: missing } : { status: 'idle' }
  return { state, run, missing, physicalRevision, revision }
}
