import { describe, expect, it } from 'vitest'
import type { StructuralLoad } from '../domain/load'
import { EMPTY_STRUCTURE } from '../domain/structure'
import type { Structure } from '../domain/structure'
import { ACADEMIC_EXAMPLES } from '../projects/academicExamples'
import { ALL_LOADS, makeAnalysisRequest } from '../projects/analysisInput'
import type { AnalysisInput } from './contracts'
import { solveCross } from './cross'
import { solveForceMethod } from './forceMethod'
import { evaluateFrameSection } from './frame'
import { solveInfluence } from './influence'
import { curveAt, curveZeros, extrema, trainEnvelope } from './influenceCurve'
import { solveAnalysis } from './solve'
import { solveVirtualWork } from './virtualWork'

const E = 200e9, A = .02, I = 8e-6, EI = E * I
const up = { x: 0, y: 1 }
const down = { x: 0, y: -1 }
const pin = { kind: 'pinned', nodeId: 'N1' } as const
const fixed = { kind: 'fixed', nodeId: 'N1' } as const
const roller = (nodeId: string, surfaceAngle = 0) => ({ kind: 'roller', nodeId, surfaceAngle } as const)

function fixture(points: readonly (readonly [number, number])[], pairs: readonly (readonly [number, number])[],
  supports: Structure['supports'], loads: Structure['loads'] = []): AnalysisInput {
  const nodes = points.map(([x, y], i) => ({ id: `N${i + 1}`, label: `N${i + 1}`, x, y }))
  const bars = pairs.map(([from, to], i) => ({ id: `B${i + 1}`, label: `B${i + 1}`, startId: `N${from}`, endId: `N${to}` }))
  const definition: AnalysisInput['definition'] = { version: 1, assignments: bars.map(({ id: barId }) => ({ barId, kind: 'frame2d', E, A, I })) }
  return { model: { ...EMPTY_STRUCTURE, nodes, bars, supports, loads, mechanics: definition, nextLoad: loads.length + 1,
    nextNode: nodes.length + 1, nextBar: bars.length + 1 }, definition, loadCase: { id: 'auditoria' } }
}

function close(actual: number, expected: number, floor: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(floor + 1e-8 * Math.abs(expected))
}

function successful<T extends { readonly ok: boolean; readonly diagnostics?: unknown }>(result: T): Extract<T, { ok: true }> {
  expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true)
  return result as Extract<T, { ok: true }>
}

function span(q = 5000, L = 4) {
  return { kind: 'distributed', frame: 'global', profile: 'uniform', s0: 0, s1: L, q0: { x: 0, y: -q }, q1: { x: 0, y: -q } } as const
}

describe('Auditoría transversal con referencias analíticas', () => {
  it.each(['axial', 'triangular'])('diagnostica los procedimientos incompatibles sobre %s', id => {
    const model = ACADEMIC_EXAMPLES.find(example => example.id === id)!.model
    const request = makeAnalysisRequest(model, ALL_LOADS, 'auditoria')
    if (request.status !== 'ready') throw new Error('Falta la definición de análisis del ejemplo')
    const { input } = request
    const cross = solveCross(input)
    const forces = solveForceMethod(input, ['N1:y'])
    const influence = solveInfluence(input, { bars: ['B1'], reversed: false, direction: down,
      target: { kind: 'reaction', nodeId: 'N1', direction: up } })
    for (const [result, diagnostic] of [[cross, /contiene elementos de armadura/],
      [forces, /primaria liberada.*no es estable/], [influence, /elemento de pórtico/]] as const) {
      if (result.ok) throw new Error('Se esperaba un diagnóstico de alcance')
      expect(result.result.diagnostics[0]!.message).toMatch(diagnostic)
    }
  })

  it('viga simple puntual: Cross y rigideces conservan reacciones, salto y flecha de la referencia', () => {
    const L = 6, P = 12000
    const input = fixture([[0, 0], [L, 0]], [[1, 2]], [pin, roller('N2')],
      [{ kind: 'point', id: 'C1', barId: 'B1', frame: 'global', s: L / 2, force: { x: 0, y: -P } }])
    for (const result of [successful(solveAnalysis(input)), successful(solveCross(input)).result]) {
      result.reactions.forEach(reaction => close(reaction.y, P / 2, 1e-6))
      const member = result.bars[0]!
      if (member.kind !== 'frame2d') throw new Error('Falta el campo de pórtico')
      const left = evaluateFrameSection(member, L / 2, 'left')
      const right = evaluateFrameSection(member, L / 2, 'right')
      close(left.V, P / 2, 1e-6)
      close(right.V, -P / 2, 1e-6)
      close(right.M, P * L / 4, 1e-6)
      close(right.v, -P * L ** 3 / (48 * EI), 1e-10)
    }
  })

  it('tres vanos iguales: tres momentos, coeficientes de flexibilidad y giro interior', () => {
    const L = 4, q = 5000
    const input = fixture([[0, 0], [L, 0], [2 * L, 0], [3 * L, 0]], [[1, 2], [2, 3], [3, 4]],
      [pin, roller('N2'), roller('N3'), roller('N4')],
      [1, 2, 3].map(i => ({ ...span(q, L), id: `C${i}`, barId: `B${i}` })))
    const stiffness = successful(solveAnalysis(input))
    const force = successful(solveForceMethod(input, ['N2:normal', 'N3:normal']))
    const cross = successful(solveCross(input))
    const virtual = successful(solveVirtualWork(input, { target: { kind: 'node', id: 'N2' }, motion: { kind: 'rotation' } }))
    // Teorema de los tres momentos con EI constante y cargas iguales.
    const supportMoment = -q * L ** 2 / 10
    const exterior = q * L * .4
    const interior = q * L * 1.1
    for (const result of [stiffness, force.result, cross.result]) {
      result.reactions.forEach(({ y }, i) => close(y, [exterior, interior, interior, exterior][i]!, 1e-6))
      const first = result.bars[0]!
      if (first.kind !== 'frame2d') throw new Error('Falta el campo de pórtico')
      close(evaluateFrameSection(first, L, 'left').M, supportMoment, 1e-6)
      close(evaluateFrameSection(first, L / 2).V, -q * L / 10, 1e-6)
      close(result.displacements[1]!.rotation!, q * L ** 3 / (120 * EI), 1e-10)
      close(result.checks[0]!.momentResidual, 0, 1e-6)
    }
    close(virtual.detail.work.total, q * L ** 3 / (120 * EI), 1e-10)
    // Green para la viga primaria simplemente apoyada de longitud 3L.
    close(force.detail.flexibility[0]![0]!.total, 4 * L ** 3 / (9 * EI), 1e-12)
    close(force.detail.flexibility[0]![1]!.total, 7 * L ** 3 / (18 * EI), 1e-12)
    close(force.detail.flexibility[1]![0]!.total, 7 * L ** 3 / (18 * EI), 1e-12)
    close(force.detail.reciprocalCondition, 1 / 15, 1e-9)
    expect(force.detail.symmetryError).toBeLessThan(1e-8)
    expect(force.detail.backwardError).toBeLessThan(1e-10)
    for (const value of force.detail.compatibility) close(value, 0, 1e-10)
    const partial = successful(solveForceMethod(input, ['N2:normal']))
    expect(force.detail.primaryIndeterminacy).toBe(0)
    expect(partial.detail.primaryIndeterminacy).toBe(1)
    close(partial.detail.values[0]!, interior, 1e-6)
    expect(partial.detail.primary.supports.map(support => support.nodeId)).toEqual(['N1', 'N3', 'N4'])
    // Carga unitaria en L/2. Green en L y 2L da [19/72, 31/144]·L³/EI.
    for (const [nodeId, expected] of [['N2', 29 / 40], ['N3', -3 / 20]] as const) {
      const { detail } = successful(solveInfluence(input, { bars: ['B1', 'B2', 'B3'], reversed: false,
        direction: down, target: { kind: 'reaction', nodeId, direction: up } }))
      close(curveAt(detail.pieces, detail.knots, L / 2), expected, 1e-8)
    }
  })

  it('dos vanos iguales: compara el giro exterior de curvatura con trabajo virtual', () => {
    const L = 4, q = 5000
    const input = fixture([[0, 0], [L, 0], [2 * L, 0]], [[1, 2], [2, 3]],
      [pin, roller('N2'), roller('N3')], [1, 2].map(i => ({ ...span(q, L), id: `C${i}`, barId: `B${i}` })))
    const virtual = successful(solveVirtualWork(input, { target: { kind: 'node', id: 'N1' }, motion: { kind: 'rotation' } }))
    const stiffness = successful(solveAnalysis(input))
    close(virtual.detail.work.total, -q * L ** 3 / (48 * EI), 1e-10)
    close(stiffness.displacements[0]!.rotation!, virtual.detail.work.total, 1e-10)
  })

  it('pórtico arriostrado: contraste de Cross, la liberación de apoyo y el giro unitario', () => {
    const L = 2, q = 5000
    const input = fixture([[0, 0], [0, L], [L, L], [L, 0]], [[1, 2], [2, 3], [4, 3]],
      [fixed, { ...fixed, nodeId: 'N4' }, roller('N2', -Math.PI / 2), roller('N3', -Math.PI / 2)],
      [{ ...span(q, L), id: 'C1', barId: 'B2' }])
    const cross = successful(solveCross(input))
    const forces = successful(solveForceMethod(input, ['N1:rotation']))
    const virtual = successful(solveVirtualWork(input, { target: { kind: 'node', id: 'N2' }, motion: { kind: 'rotation' } }))
    const baseMoment = -q * L ** 2 / 36
    // En la columna izquierda sin cuerda, M de base = (2EI/L)·giro del nudo superior.
    const rotation = baseMoment * L / (2 * EI)
    for (const result of [successful(solveAnalysis(input)), forces.result, cross.result]) {
      close(result.reactions[0]!.moment!, baseMoment, 1e-6)
      close(result.displacements[1]!.rotation!, rotation, 1e-10)
    }
    close(virtual.detail.work.total, rotation, 1e-10)
    close(forces.detail.values[0]!, baseMoment, 1e-6)
  })

  it('empotrada-apoyada: compatibilidad, reacciones y giro a partir de la primaria y de pendiente–deflexión', () => {
    const q = 5000, L = 4, input = fixture([[0, 0], [L, 0]], [[1, 2]], [fixed, roller('N2')],
      [{ ...span(q, L), id: 'C1', barId: 'B1' }])
    const force = successful(solveForceMethod(input, ['N2:normal']))
    const cross = successful(solveCross(input))
    const virtual = successful(solveVirtualWork(input, { target: { kind: 'node', id: 'N2' }, motion: { kind: 'rotation' } }))
    for (const result of [successful(solveAnalysis(input)), force.result, cross.result]) {
      close(result.reactions[0]!.moment!, q * L ** 2 / 8, 1e-6)
      close(result.reactions[1]!.y, 3 * q * L / 8, 1e-6)
      close(result.displacements[1]!.rotation!, q * L ** 3 / (48 * EI), 1e-10)
    }
    close(virtual.detail.work.total, q * L ** 3 / (48 * EI), 1e-10)
    expect(force.detail.primaryIndeterminacy).toBe(0)
    close(cross.detail.joints[0]!.ends[0]!.initial, q * L ** 2 / 12, 1e-6)
    close(cross.detail.iterations[0]!.balances[0]!.ends[0]!.carried, q * L ** 2 / 24, 1e-6)
    close(force.detail.delta[0]!.total, -q * L ** 4 / (8 * EI), 1e-10)
    close(force.detail.flexibility[0]![0]!.total, L ** 3 / (3 * EI), 1e-12)
  })

  it('rodillo inclinado: flexibilidad conjugada y energía axial y flexional', () => {
    const L = 3, P = 8000, a = L / (E * A), b = L ** 3 / (3 * EI)
    const input = fixture([[0, 0], [L, 0]], [[1, 2]], [fixed, roller('N2', Math.PI / 4)],
      [{ kind: 'nodal', id: 'C1', nodeId: 'N2', force: { x: 0, y: -P }, moment: 0 }])
    const force = successful(solveForceMethod(input, ['N2:normal']))
    const stiffness = successful(solveAnalysis(input))
    const virtual = successful(solveVirtualWork(input, { target: { kind: 'node', id: 'N2' }, motion: { kind: 'translation', direction: up } }))
    const flex = a * b / (a + b)
    close(force.detail.flexibility[0]![0]!.total, (a + b) / 2, 1e-12)
    close(force.detail.values[0]!, P * Math.SQRT2 * b / (a + b), 1e-6)
    close(stiffness.displacements[1]!.x, -P * flex, 1e-10)
    close(stiffness.displacements[1]!.y, -P * flex, 1e-10)
    close(virtual.detail.work.total, -P * flex, 1e-10)
    close(virtual.detail.work.members[0]!.axial, -P * a * (b / (a + b)) ** 2, 1e-10)
    close(virtual.detail.work.members[0]!.flexural, -P * b * (a / (a + b)) ** 2, 1e-10)
    close(stiffness.reactions[1]!.x + stiffness.reactions[1]!.y, 0, 1e-6)
    expect(solveCross(input).ok).toBe(false)
  })

  it('compara el tren a ambos lados del corte con equilibrio y casos directos independientes', () => {
    const L = 6, cut = .2, offset = 100
    const input = fixture([[0, 0], [L, 0]], [[1, 2]], [pin, roller('N2')])
    const target = { kind: 'effort', barId: 'B1', field: 'V', s: cut, side: 'right' } as const
    const train = { id: 'T', name: 'Ejes separados', sense: 1 as const,
      axles: [{ id: 'E1', force: 1, offset: 0 }, { id: 'E2', force: 20, offset }] }
    const { detail } = successful(solveInfluence(input, { bars: ['B1'], reversed: false, target, direction: down, train }))
    const { pieces, knots } = detail.train!.envelope
    for (const s of [.11, cut, .44]) {
      const loads: StructuralLoad[] = [{ id: 'C1', kind: 'point', barId: 'B1', frame: 'global', s, force: { x: 0, y: -20 } }]
      const solved = successful(solveAnalysis({ ...input, model: { ...input.model, loads } })).bars[0]!
      if (solved.kind !== 'frame2d') throw new Error('Falta el campo de pórtico')
      const expected = 20 * (s > cut ? 1 - s / L : -s / L)
      close(evaluateFrameSection(solved, cut, 'right').V, expected, 1e-8)
      close(curveAt(pieces, knots, offset + s), expected, 1e-8)
    }
    close(curveAt(pieces, knots, offset + cut, 'right'), 20 * (1 - cut / L), 1e-8)
    expect(detail.train!.envelope.max.side).toBe('right')
    expect(detail.zeros).toEqual([0, L])
  })

  it('encuentra un cero interior por cancelación de dos ejes con fuerzas de signo opuesto', () => {
    const L = 6
    const input = fixture([[0, 0], [L, 0]], [[1, 2]], [pin, roller('N2')])
    const train = { id: 'T', name: 'Ejes de signo opuesto', sense: 1 as const,
      axles: [{ id: 'E1', force: 10, offset: 0 }, { id: 'E2', force: -20, offset: 2 }] }
    const { detail } = successful(solveInfluence(input, { bars: ['B1'], reversed: false, direction: down,
      target: { kind: 'effort', barId: 'B1', field: 'M', s: L / 2, side: 'right' }, train }))
    const { pieces, knots } = detail.train!.envelope
    // En 3 < S < 5, el momento por equilibrio es (100 − 30S)/2.
    const root = curveZeros(pieces, knots).find(s => s > 3 && s < 5)
    expect(root).toBeDefined()
    close(root!, 10 / 3, 1e-8)
    close(curveAt(pieces, knots, root!), 0, 1e-8)
  })

  it('conserva ambos valores exactos en los bordes decimales trasladados de una línea constante', () => {
    const pieces = [{ from: 0, to: .2, coefficients: [1, 0, 0, 0] as const }]
    const knots = [{ s: 0, exact: 1, right: 1 }, { s: .2, exact: 1, left: 1 }]
    const train = { id: 'T', name: 'Separación decimal', sense: 1 as const,
      axles: [{ id: 'E1', force: 1, offset: 0 }, { id: 'E2', force: 2, offset: 100 }] }
    const result = trainEnvelope(pieces, knots, train)
    expect(curveAt(result.pieces, result.knots, 100)).toBe(2)
    expect(curveAt(result.pieces, result.knots, 100.2)).toBe(2)
    expect(curveAt(result.pieces, result.knots, 100.2, 'right')).toBe(0)
  })

  it('clasifica como alcanzado el extremo de una meseta cuyos dos bordes son saltos', () => {
    const flat = [{ from: 0, to: 1, coefficients: [4, 0, 0, 0] as const }]
    const knots = [{ s: 0, exact: 0, right: 4 }, { s: 1, exact: 0, left: 4 }]
    const { max } = extrema(flat, knots)
    expect(max).toEqual({ s: .5, value: 4, side: 'exact' })
    expect(curveAt(flat, knots, max.s)).toBe(max.value)
  })

  it('mantiene distintos el corte y la llegada al nudo si Float64 separa las estaciones de prueba', () => {
    const L = 6, s = L - 32 * Number.EPSILON
    const input = fixture([[0, 0], [L, 0]], [[1, 2]], [pin, roller('N2')])
    const { detail } = successful(solveInfluence(input, {
      bars: ['B1'], reversed: false, direction: down, target: { kind: 'effort', barId: 'B1', s, field: 'V', side: 'right' },
    }))
    close(curveAt(detail.pieces, detail.knots, s), -s / L, 1e-8)
    close(curveAt(detail.pieces, detail.knots, s, 'right'), 1 - s / L, 1e-8)
  })
})
