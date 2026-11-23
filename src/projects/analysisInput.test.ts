import { expect, it } from 'vitest'
import { solveAnalysis } from '../analysis'
import { EMPTY_STRUCTURE } from '../domain/structure'
import type { Structure } from '../domain/structure'
import { ALL_LOADS, analysisRevision, makeAnalysisRequest } from './analysisInput'

const base: Structure = { ...EMPTY_STRUCTURE,
  nodes: [{ id: 'N1', label: 'A', x: 0, y: 0 }, { id: 'N2', label: 'B', x: 2, y: 0 }],
  bars: [{ id: 'B1', label: 'Viga', startId: 'N1', endId: 'N2' }],
  supports: [{ kind: 'fixed', nodeId: 'N1' }],
  loads: [{ id: 'C1', kind: 'nodal', nodeId: 'N2', force: { x: 0, y: -8000 }, moment: 0 }],
  mechanics: { version: 1, assignments: [{ barId: 'B1', kind: 'frame2d', E: 200e9, A: .02, I: 8e-6 }] },
  nextBar: 2, nextNode: 3, nextLoad: 2,
}

it('prepara una instantánea independiente y solo resuelve las cargas del caso activo', () => {
  const picked = { id: 'vacío', loadIds: [] }
  const key = analysisRevision(base, picked)
  const request = makeAnalysisRequest(base, picked, key)
  if (request.status !== 'ready') throw new Error('Se esperaba modelo listo')
  expect(request.input.model).not.toBe(base)
  expect(request.input.model.nodes[0]).not.toBe(base.nodes[0])
  expect(request.input.loadCase.loadIds).not.toBe(picked.loadIds)
  const result = solveAnalysis(request.input)
  expect(result).toMatchObject({ ok: true, caseId: picked.id, revision: key,
    displacements: [{ y: 0 }, { y: 0 }] })
})

it('diagnostica propiedades incompletas y errores de documento antes de pedir un cálculo', () => {
  const partial = { ...base, mechanics: { version: 1 as const, assignments: [{ barId: 'B1', kind: 'frame2d' as const }] } }
  expect(makeAnalysisRequest(partial, ALL_LOADS, '')).toMatchObject({
    status: 'incomplete', diagnostics: [{ barIds: ['B1'], message: 'Falta configurar E, A, I.' }],
  })
  const broken = { ...base, bars: [{ ...base.bars[0]!, endId: 'N7' }] }
  expect(makeAnalysisRequest(broken, ALL_LOADS, '')).toMatchObject({ status: 'failed' })
})

it('distingue geometría, conectividad, apoyos, cargas, propiedades y caso, y descarta etiquetas y orden', () => {
  const key = analysisRevision(base, ALL_LOADS)
  const annotated = { ...base, nextBar: 7,
    nodes: [...base.nodes].reverse().map(node => ({ ...node, label: 'Nueva' })),
    bars: base.bars.map(bar => ({ ...bar, label: 'Otra' })) }
  expect(analysisRevision(annotated, ALL_LOADS)).toBe(key)
  const changed: Structure[] = [
    { ...base, nodes: base.nodes.map(node => ({ ...node, x: node.x + 1 })) },
    { ...base, bars: [{ ...base.bars[0]!, startId: 'N2', endId: 'N1' }] },
    { ...base, bars: [{ ...base.bars[0]!, releaseI: true }] },
    { ...base, supports: [{ kind: 'pinned', nodeId: 'N1' }] },
    { ...base, loads: [] },
    { ...base, mechanics: { ...base.mechanics, assignments: [{ ...base.mechanics.assignments[0]!, I: 9e-6 }] } },
  ]
  for (const model of changed) expect(analysisRevision(model, ALL_LOADS)).not.toBe(key)
  expect(analysisRevision(base, { id: 'seleccion', loadIds: ['C1'] })).not.toBe(key)
})
