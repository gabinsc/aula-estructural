import { describe, expect, it } from 'vitest'
import type { StructuralLoad } from '../domain/load'
import type { NodalSupport } from '../domain/support'
import { ACADEMIC_EXAMPLES } from '../projects/academicExamples'
import { ALL_LOADS, makeAnalysisRequest } from '../projects/analysisInput'
import type { AnalysisInput } from './contracts'
import { solveForceMethod } from './forceMethod'
import { solveVirtualWork } from './virtualWork'
import type { Target, Motion } from './virtualWork'
import { effortAt } from './workIntegral'

const horizontal: Motion = { kind: 'translation', direction: { x: 1, y: 0 } }
const vertical: Motion = { kind: 'translation', direction: { x: 0, y: 1 } }
const angular: Motion = { kind: 'rotation' }
const node = (id: string): Target => ({ kind: 'node', id })
const section = (s: number): Target => ({ kind: 'section', id: 'B1', s })
const x = (id: string): AnalysisInput => {
  const example = ACADEMIC_EXAMPLES.find(item => item.id === id)!
  const request = makeAnalysisRequest(example.model, ALL_LOADS, 'referencia')
  if (request.status !== 'ready') throw new Error(JSON.stringify(request.diagnostics))
  return request.input
}
function close(actual: number, expected: number, floor = 1e-10) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(floor + 1e-8 * Math.abs(expected))
}

describe('Trabajo virtual y carga unitaria', () => {
  it.each([
    ['axial', node('N2'), horizontal, 10_000 * 2 / (200e9 * .001)],
    ['triangular', node('N3'), vertical, -12_000 / (200e9 * .001) * (4 / 9 + 13 * Math.sqrt(13) / 18)],
    ['voladizo', node('N2'), vertical, -8000 * 3 ** 3 / (3 * 200e9 * 1e-5)],
    ['voladizo', node('N2'), angular, -8000 * 3 ** 2 / (2 * 200e9 * 1e-5)],
    ['puntual', section(3), vertical, -12_000 * 6 ** 3 / (48 * 200e9 * 8e-6)],
    ['uniforme', section(2), vertical, -5 * 5000 * 4 ** 4 / (384 * 200e9 * 8e-6)],
    ['portico', node('N2'), horizontal, .00238462270435],
    ['voladizo', node('N1'), angular, 0],
    ['puntual', section(3), angular, 0],
    ['voladizo', node('N2'), { kind: 'translation', direction: { x: 3, y: 4 } } as const, -.036 * .8],
    ['voladizo', section(1), angular, -8000 * (3 - .5) / (200e9 * 1e-5)],
  ] as const)('resuelve %s con respuesta %o', (id, target, motion, expected) => {
    const input = x(id)
    const before = structuredClone(input)
    const computed = solveVirtualWork(input, { target, motion })
    if (!computed.ok) throw new Error(JSON.stringify(computed.result.diagnostics))
    const { work } = computed.detail
    close(work.total, expected)
    close(work.total, work.members.reduce((total, bar) => total + bar.axial + bar.flexural, 0))
    expect(computed.detail.agrees).toBe(true)
    expect(input).toEqual(before)
    if (id === 'axial') {
      close(work.members.find(item => item.barId === 'B1')!.axial, expected)
      close(work.members.find(item => item.barId === 'B2')!.axial, 0)
    }
    if (id === 'puntual' && target.kind === 'section') {
      expect(work.members.map(item => item.barId)).toEqual(['B1'])
      expect(work.members[0]!.intervals.map(item => [item.from, item.to])).toEqual([[0, 3], [3, 6]])
      close(work.members[0]!.intervals[0]!.samples.at(-1)!.real.V, 6000, 1e-6)
      close(work.members[0]!.intervals[1]!.samples[0]!.real.V, -6000, 1e-6)
    }
  })

  it('separa límites distribuidos y no incorpora cargas fuera del caso', () => {
    const input = x('voladizo')
    const load: StructuralLoad = { id: 'C2', kind: 'distributed', barId: 'B1', s0: 0, s1: 3,
      frame: 'global', profile: 'linear', q0: { x: 0, y: 0 }, q1: { x: 0, y: -5000 } }
    const model = { ...input.model, loads: [...input.model.loads, load], nextLoad: 3 }
    const computed = solveVirtualWork({ ...input, model, loadCase: { id: 'triangular', loadIds: ['C2'] } },
      { target: node('N2'), motion: vertical })
    if (!computed.ok) throw new Error(JSON.stringify(computed.result.diagnostics))
    close(computed.detail.work.total, -11 * 5000 * 3 ** 4 / (120 * 200e9 * 1e-5))
    const partial = solveVirtualWork({ ...input, model: { ...model, loads: [input.model.loads[0]!, { ...load, s0: .5, s1: 2 }] } },
      { target: node('N2'), motion: vertical })
    if (!partial.ok) throw new Error(JSON.stringify(partial.result.diagnostics))
    expect(partial.detail.work.members[0]!.intervals.map(item => item.to)).toEqual([.5, 2, 3])
    expect(partial.detail.agrees).toBe(true)
  })

  it('diagnostica giros inactivos y secciones axiales interiores', () => {
    for (const target of [node('N2'), section(1)]) {
      expect(solveVirtualWork(x('axial'), { target, motion: angular }).ok).toBe(false)
    }
  })

  it('mantiene distintas una sección y una carga puntual separadas por menos del snap geométrico', () => {
    const s = 3 + 5e-9
    const computed = solveVirtualWork(x('puntual'), { target: section(s), motion: vertical })
    if (!computed.ok) throw new Error(JSON.stringify(computed.result.diagnostics))
    const intervals = computed.detail.work.members[0]!.intervals
    expect(intervals.map(item => [item.from, item.to])).toEqual([[0, 3], [3, s], [s, 6]])
    close(intervals[0]!.samples.at(-1)!.real.V, 6000, 1e-6)
    close(intervals[1]!.samples[0]!.real.V, -6000, 1e-6)
    expect(computed.detail.agrees).toBe(true)
  })
})

const fixed: NodalSupport = { nodeId: 'N1', kind: 'fixed' }
const roller: NodalSupport = { nodeId: 'N2', kind: 'roller', surfaceAngle: 0 }
function supports(input: AnalysisInput, ...items: readonly NodalSupport[]): AnalysisInput {
  return { ...input, model: { ...input.model, supports: items } }
}
function forces(input: AnalysisInput, ids: readonly string[]) {
  const before = structuredClone(input)
  const computed = solveForceMethod(input, ids)
  if (!computed.ok) throw new Error(JSON.stringify(computed.result.diagnostics))
  expect(computed.detail.comparison.agrees).toBe(true)
  for (const value of computed.detail.compatibility) close(value, 0)
  expect(computed.result.loads.every(load => !load.id.startsWith('@'))).toBe(true)
  expect(input).toEqual(before)
  return computed
}

describe('Método de las fuerzas', () => {
  it('viga empotrada-apoyada: 3qL/8, f=L³/(3EI), Δ₀=−qL⁴/(8EI)', () => {
    const input = supports(x('uniforme'), fixed, roller)
    const { detail, result } = forces(input, ['N2:normal'])
    close(detail.values[0]!, 7500, 1e-6)
    close(detail.delta[0]!.total, -.1)
    close(detail.flexibility[0]![0]!.total, 4 ** 3 / (3 * 200e9 * 8e-6))
    close(result.reactions[0]!.moment!, 10_000, 1e-6)
  })

  it('dos vanos iguales: reacción intermedia 5qL/4 y momento continuo −qL²/8', () => {
    const input = x('uniforme')
    const q = input.model.loads[0]!
    if (q.kind !== 'distributed') throw new Error('Falta carga distribuida')
    const model = { ...input.model, nodes: [...input.model.nodes, { id: 'N3', label: 'N3', x: 8, y: 0 }],
      bars: [...input.model.bars, { id: 'B2', label: 'B2', startId: 'N2', endId: 'N3' }],
      supports: [...input.model.supports, { ...roller, nodeId: 'N3' }],
      loads: [q, { ...q, id: 'C2', barId: 'B2' }], nextNode: 4, nextBar: 3, nextLoad: 3 }
    const assignments = [...input.definition.assignments, { ...input.definition.assignments[0]!, barId: 'B2' }]
    const { result, detail } = forces({ ...input, model, definition: { version: 1, assignments } }, ['N2:normal'])
    close(detail.values[0]!, 25_000, 1e-6)
    close(result.reactions[0]!.y, 7500, 1e-6)
    close(effortAt(result.bars[0]!, 4, 'left').M, -10_000, 1e-6)
    close(effortAt(result.bars[1]!, 0).M, -10_000, 1e-6)
  })

  it.each([['N1:rotation'], ['N1:rotation', 'N4:rotation']])('pórtico con %j y referencia de pendiente–deflexión', (...ids) => {
    const { detail, result } = forces(x('portico'), ids)
    for (const value of detail.values) close(value, 11435.91207536, 1e-6)
    close(result.displacements[1]!.x, .00238462270435)
    if (ids.length === 2) expect(detail.flexibility[0]![1]!.total).toBe(detail.flexibility[1]![0]!.total)
  })

  it('conserva la normal del rodillo inclinado y su rigidez axial más flexional', () => {
    const input = supports(x('voladizo'), fixed, { ...roller, surfaceAngle: Math.PI / 4 })
    const { detail, result } = forces(input, ['N2:normal'])
    const fb = 3 ** 3 / (3 * 200e9 * 1e-5)
    const expected = 8000 * Math.SQRT1_2 * fb / ((fb + 3 / (200e9 * .02)) / 2)
    close(detail.values[0]!, expected, 1e-6)
    close(result.reactions[1]!.x, -Math.SQRT1_2 * expected, 1e-6)
    close(result.reactions[1]!.y, Math.SQRT1_2 * expected, 1e-6)
  })

  it('retiene el giro de un empotramiento al liberar sus dos traslaciones', () => {
    const input = supports(x('uniforme'), fixed, { ...fixed, nodeId: 'N2' })
    const { result, detail } = forces(input, ['N1:x', 'N1:y'])
    expect(detail.primary.rotationLocks).toEqual(['N1'])
    close(result.reactions[0]!.moment!, 5000 * 4 ** 2 / 12, 1e-6)
    close(detail.values[1]!, 10_000, 1e-6)
  })

  it('diagnostica mecanismo, dependencia y ausencia de selección', () => {
    for (const [ids, message] of [
      [['N1:rotation'], /primaria liberada/], [['N1:y', 'N1:y'], /linealmente dependientes/],
      [[], /Sin liberaciones/], [['N2:normal'], /ya no está activa/],
    ] as const) {
      const outcome = solveForceMethod(x('voladizo'), ids)
      expect(outcome.ok).toBe(false)
      expect(outcome.result.diagnostics[0]?.message).toMatch(message)
    }
  })
})
