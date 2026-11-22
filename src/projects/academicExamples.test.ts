import { expect, it } from 'vitest'
import { evaluateFrameSection, solveAnalysis } from '../analysis'
import type { AnalysisResult } from '../analysis'
import { ACADEMIC_EXAMPLES, copyAcademicExample } from './academicExamples'
import type { AcademicReference } from './academicExamples'
import { ALL_LOADS, makeAnalysisRequest } from './analysisInput'
import { importProject } from './document'

function value(result: Extract<AnalysisResult, { ok: true }>, check: AcademicReference) {
  const displacement = result.displacements.find(item => item.nodeId === check.id)
  const reaction = result.reactions.find(item => item.nodeId === check.id)
  switch (check.quantity) {
    case 'ux': return displacement?.x
    case 'uy': return displacement?.y
    case 'rotation': return displacement?.rotation
    case 'rx': return reaction?.x
    case 'ry': return reaction?.y
    case 'moment': return reaction?.moment
  }
  const bar = result.bars.find(item => item.barId === check.id)
  if (check.quantity === 'N') return bar?.axialForce
  if (bar?.kind === 'frame2d' && check.station) {
    return evaluateFrameSection(bar, check.station.s, check.station.side)[check.quantity]
  }
}

it.each(ACADEMIC_EXAMPLES)('$title coincide con las referencias y conserva el modelo en JSON', example => {
  const first = copyAcademicExample(example)
  const second = copyAcademicExample(example)
  expect(first.id).not.toBe(second.id)
  expect(first.model.nodes).not.toBe(second.model.nodes)
  expect(first.model.loads).not.toBe(example.model.loads)
  const restored = importProject(JSON.stringify(first))
  expect(restored).toEqual(first)
  const request = makeAnalysisRequest(restored.model, ALL_LOADS, 'oráculo')
  if (request.status !== 'ready') throw new Error(JSON.stringify(request.diagnostics))
  const result = solveAnalysis(request.input)
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  for (const check of example.references) {
    const actual = value(result, check)
    const isKinematic = ['ux', 'uy', 'v', 'rotation'].includes(check.quantity)
    expect(actual, check.label).toBeDefined()
    expect(Math.abs(actual! - check.si), check.label)
      .toBeLessThanOrEqual((isKinematic ? 1e-9 : 1e-5) + 1e-8 * Math.abs(check.si))
  }
})
