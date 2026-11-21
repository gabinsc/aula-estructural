import { describe, expect, it } from 'vitest'
import { EMPTY_STRUCTURE } from '../domain/structure'
import type { Structure } from '../domain/structure'
import type { Point } from '../geometry/coordinates'
import { prepareTruss, solveTruss, trussStiffness } from './index'
import type { AnalysisInput, AnalysisResult } from './index'

const E = 200e9
const A = .001
const ROLL_HORIZONTAL = { kind: 'roller', surfaceAngle: 0, nodeId: 'N2' } as const
const PIN = { kind: 'pinned', nodeId: 'N1' } as const

function fixture(points: readonly (readonly [number, number])[], connections: readonly (readonly [number, number])[]): Structure {
  return {
    ...EMPTY_STRUCTURE,
    nodes: points.map(([x, y], i) => ({ id: `N${i + 1}`, label: `N${i + 1}`, x, y })),
    bars: connections.map(([start, end], i) => ({
      id: `B${i + 1}`, label: `B${i + 1}`, startId: `N${start}`, endId: `N${end}`,
    })),
    nextNode: points.length + 1, nextBar: connections.length + 1,
  }
}

function force(id: string, nodeId: string, x: number, y: number, moment = 0) {
  return { id, nodeId, kind: 'nodal', force: { x, y }, moment } as const
}

function beam(): Structure {
  return { ...fixture([[0, 0], [2, 0]], [[1, 2]]), supports: [PIN, ROLL_HORIZONTAL],
    loads: [force('C1', 'N2', 10_000, 0)], nextLoad: 2 }
}

function triangle(): Structure {
  return { ...fixture([[0, 0], [4, 0], [2, 3]], [[1, 2], [1, 3], [2, 3]]),
    supports: [PIN, ROLL_HORIZONTAL], loads: [force('C1', 'N3', 0, -12_000)], nextLoad: 2 }
}

function input(model: Structure): AnalysisInput {
  return { model, includeTrace: true, revision: 'fixture-r1', loadCase: { id: 'referencia' },
    definition: { version: 1, assignments: model.bars.map(bar => ({ barId: bar.id, kind: 'truss2d', E, A })) } }
}

function solved(model: Structure) {
  const result = solveTruss(input(model))
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return result
}

function noSolution(result: AnalysisResult, code: string) {
  expect(result.ok).toBe(false)
  expect(result).not.toHaveProperty('displacements')
  expect(result).not.toHaveProperty('reactions')
  expect(result).not.toHaveProperty('bars')
  expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code, severity: 'error' })]))
}

// T1 de la arquitectura. Oráculos de equilibrio, ley axial y trabajo virtual.
function expectSI(actual: number, reference: number, absTolerance = 1e-5) {
  expect(Math.abs(actual - reference)).toBeLessThanOrEqual(absTolerance + 1e-8 * Math.abs(reference))
}

function expectVector(actual: Point, x: number, y: number, absTolerance = 1e-5) {
  expectSI(actual.x, x, absTolerance)
  expectSI(actual.y, y, absTolerance)
}

function expectBalances(result: ReturnType<typeof solved>) {
  for (const check of result.checks) {
    expectVector(check.forceResidual, 0, 0)
    expectSI(check.momentResidual, 0)
    expectSI(check.freeResidual, 0)
    expectSI(check.rollerTangentialResidual, 0)
    expectSI(check.compatibilityResidual, 0, 1e-10)
    expect(check.backwardError).toBeLessThanOrEqual(1e-10)
  }
}

describe('Oráculos analíticos de armadura plana', () => {
  it('A · barra axial reproduce PL/EA y el equilibrio', () => {
    const request = beam()
    const before = structuredClone(request)
    const result = solved(request)
    expectVector(result.displacements[1]!, .0001, 0, 1e-10)
    expectSI(result.bars[0]!.axialForce, 10_000)
    expectSI(result.bars[0]!.elongation, .0001, 1e-10)
    expectVector(result.reactions[0]!, -10_000, 0)
    expect(result.reactions[1]!.nodeId).toBe('N2')
    expectVector(result.reactions[1]!, 0, 0)
    expect(result).toMatchObject({ caseId: 'referencia', revision: 'fixture-r1',
      loads: [{ id: 'C1', nodeId: 'N2' }], bars: [{ barId: 'B1' }] })
    expect([...result.trace!.F]).toEqual([0, 0, 10_000, 0])
    expect([...result.trace!.components[0]!.Q]).toEqual([0, 0, 1, 0])
    expect(request).toEqual(before)
    expectBalances(result)
  })

  it('B · armadura triangular concuerda con método de nudos y carga unitaria', () => {
    const result = solved(triangle())
    expectVector(result.reactions[0]!, 0, 6000)
    expectVector(result.reactions[1]!, 0, 6000)
    const diagonalForce = -2000 * Math.sqrt(13)
    for (const [i, value] of [4000, diagonalForce, diagonalForce].entries()) expectSI(result.bars[i]!.axialForce, value)
    const byVirtualWork = -12_000 / (E * A) * (4 / 9 + 13 * Math.sqrt(13) / 18)
    expectSI(result.displacements[2]!.y, byVirtualWork, 1e-10)
    expectSI(result.displacements[2]!.y, -.000182907221937, 1e-10)
    expectBalances(result)
  })

  it('C · rodillo inclinado restringe la normal y conserva la reacción oblicua', () => {
    const result = solved({ ...beam(), supports: [PIN, { ...ROLL_HORIZONTAL, surfaceAngle: Math.PI / 4 }],
      loads: [force('C1', 'N2', 0, -10_000)] })
    expectVector(result.displacements[1]!, -.0001, -.0001, 1e-10)
    expectVector(result.reactions[0]!, 10_000, 0)
    expectVector(result.reactions[1]!, -10_000, 10_000)
    expectSI(result.bars[0]!.axialForce, -10_000)
    const { Q, Kr, Fr, reducedDofs } = result.trace!.components[0]!
    expect(reducedDofs[0]).toMatchObject({ nodeId: 'N2', axis: 'tangent' })
    expectSI(Q[2]!, Math.SQRT1_2, 1e-12)
    expectSI(Q[3]!, Math.SQRT1_2, 1e-12)
    expectSI(Kr[0]!, (E * A / 2) / 2)
    expectSI(Fr[0]!, -10_000 * Math.SQRT1_2)
    expectBalances(result)
  })

  it.each([false, true])('D · informa el grado libre transversal, con carga transversal=%s', loaded => {
    const result = solveTruss(input({ ...beam(), supports: [PIN],
      loads: loaded ? [force('C1', 'N2', 0, -1000)] : [] }))
    noSolution(result, 'UNSTABLE_OR_SINGULAR')
    expect(result.diagnostics[0]).toMatchObject({ direction: { nodeId: 'N2', axis: 'uy' }, barIds: ['B1'] })
  })
})

describe('Invariantes del núcleo y del modelo', () => {
  it('construye la matriz de 3–4–5 y conserva su simetría e inversión', () => {
    const unit = { x: .6, y: .8 }
    const k = trussStiffness({ unit, axialStiffness: 100 })
    const expected = [36, 48, -36, -48, 48, 64, -48, -64, -36, -48, 36, 48, -48, -64, 48, 64]
    expected.forEach((value, index) => expectSI(k[index]!, value, 1e-12))
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) expect(k[i * 4 + j]).toBe(k[j * 4 + i])
    expect(k).toEqual(trussStiffness({ unit: { x: -.6, y: -.8 }, axialStiffness: 100 }))
  })

  it('la inversión de una barra conserva el axial y el alargamiento físicos', () => {
    const model = triangle()
    const reversed = { ...model, bars: model.bars.map(bar => bar.id === 'B2'
      ? { ...bar, startId: bar.endId, endId: bar.startId } : bar) }
    const original = solved(model)
    const result = solved(reversed)
    expectSI(result.bars[1]!.axialForce, -2000 * Math.sqrt(13))
    expectSI(result.bars[1]!.elongation, -2000 * 13 / (E * A), 1e-10)
    expect(result.displacements).toEqual(original.displacements)
    expect(result.trace!.K).toEqual(original.trace!.K)
  })

  it('trasladar el origen y permutar arrays preserva los valores y el mapa de grados', () => {
    const original = triangle()
    const altered = { ...original,
      nodes: [...original.nodes].reverse().map(node => ({ ...node, x: node.x + 10000, y: node.y - 5400 })),
      bars: [...original.bars].reverse(), supports: [...original.supports].reverse(),
    }
    const result = solveTruss({ ...input(altered), definition: {
      version: 1, assignments: [...input(altered).definition.assignments].reverse(),
    } })
    expect(result).toEqual(solved(original))
    const renamed = { ...triangle(), nodes: triangle().nodes.map((node, i) =>
      i === 2 ? { ...node, id: 'N10' } : node),
      loads: [force('C1', 'N10', 0, -12_000)],
      bars: triangle().bars.map(bar => ({ ...bar, endId: bar.endId === 'N3' ? 'N10' : bar.endId })),
    }
    const prepared = prepareTruss(input(renamed))
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.diagnostics))
    expect(prepared.model.dofs.map(({ nodeId, axis }) => `${nodeId}.${axis}`))
      .toEqual(['N1.ux', 'N1.uy', 'N2.ux', 'N2.uy', 'N10.ux', 'N10.uy'])
    expect(prepared.model.dofByNode.get('N10')).toEqual([4, 5])
  })

  it('gira rígidamente geometría, cargas y apoyo manteniendo axiales y rotando desplazamientos y reacciones', () => {
    // Giro racional con cos=3/5 y sen=4/5. No usa transformaciones del motor para el oráculo.
    const rotate = (x: number, y: number) => ({ x: (3 * x - 4 * y) / 5, y: (4 * x + 3 * y) / 5 })
    const model = beam()
    const result = solved({ ...model, nodes: model.nodes.map(node => ({ ...node, ...rotate(node.x, node.y) })),
      supports: [PIN, { ...ROLL_HORIZONTAL, surfaceAngle: Math.atan2(4, 3) }], loads: [force('C1', 'N2', 6000, 8000)] })
    expectVector(result.displacements[1]!, .00006, .00008, 1e-10)
    expectVector(result.reactions[0]!, -6000, -8000)
    expectSI(result.bars[0]!.axialForce, 10_000)
    expectBalances(result)
  })

  it('mantiene independientes dos componentes con nudos coincidentes y aplica sus cargas por ID', () => {
    const model = { ...fixture([[0, 0], [2, 0], [2, 0], [4, 0]], [[1, 2], [3, 4]]),
      supports: [PIN, ROLL_HORIZONTAL, { ...PIN, nodeId: 'N3' }, { ...ROLL_HORIZONTAL, nodeId: 'N4' }],
      loads: [force('C1', 'N2', 10_000, 0), force('C2', 'N4', -20_000, 0)],
    }
    const result = solved(model)
    expect(result.checks.map(check => check.nodeIds)).toEqual([['N1', 'N2'], ['N3', 'N4']])
    expectVector(result.displacements[1]!, .0001, 0, 1e-10)
    expectVector(result.displacements[2]!, 0, 0, 1e-10)
    expectVector(result.displacements[3]!, -.0002, 0, 1e-10)
    expectSI(result.bars[0]!.axialForce, 10_000)
    expectSI(result.bars[1]!.axialForce, -20_000)
    expectBalances(result)
    const rejected = solveTruss(input({ ...model, supports: model.supports.slice(0, 3) }))
    noSolution(rejected, 'UNSTABLE_OR_SINGULAR')
    expect(rejected.diagnostics[0]).toMatchObject({ nodeIds: ['N3', 'N4'] })
  })

  it('no ensambla conexión en el cruce entre dos barras', () => {
    const result = prepareTruss(input(fixture([[0, 0], [2, 0], [1, -1], [1, 1]], [[1, 2], [3, 4]])))
    expect(result.ok && result.model.components.map(group => group.nodeIds)).toEqual([['N1', 'N2'], ['N3', 'N4']])
  })

  it('suma varias cargas con cancelación, conserva IDs y permite seleccionar un caso explícito', () => {
    const model = { ...beam(), loads: [force('C1', 'N2', 1e16, 0), force('C2', 'N2', 1, 0), force('C3', 'N2', -1e16, 0)] }
    const result = solved(model)
    expect(result.loads.map(load => load.id)).toEqual(['C1', 'C2', 'C3'])
    expect(result.trace!.F[2]).toBe(1)
    expectSI(result.bars[0]!.axialForce, 1)
    const partial = solveTruss({ ...input(model), loadCase: { id: 'solo C2', loadIds: ['C2'] } })
    expect(partial.ok && partial.loads.map(load => load.id)).toEqual(['C2'])
    noSolution(solveTruss({ ...input(model), loadCase: { id: 'error', loadIds: ['C20'] } }), 'INVALID_CASE')
  })

  it('resuelve sin grados libres y explica la ausencia de giro del empotramiento', () => {
    const result = solved({ ...beam(), supports: [PIN, { kind: 'fixed', nodeId: 'N2' }] })
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'INACTIVE_FIXED_ROTATION', nodeIds: ['N2'] })])
    expect(result.trace!.components[0]!.Kr).toHaveLength(0)
    expect(result.checks[0]!.scaledRcondEstimate).toBeNull()
    expectVector(result.displacements[1]!, 0, 0, 1e-10)
    expectVector(result.reactions[1]!, -10_000, 0)
    expectSI(result.bars[0]!.axialForce, 0)
    expectBalances(result)
  })
})

describe('Validación y rechazo numérico', () => {
  it.each([-1, 0, Infinity, NaN])('rechaza E o A inválidos (%s)', bad => {
    const base = input(beam())
    for (const invalid of [{ E: bad }, { A: bad }]) noSolution(solveTruss({ ...base, definition: {
      version: 1, assignments: [{ ...base.definition.assignments[0]!, ...invalid }],
    } }), 'INVALID_ASSIGNMENT')
  })

  it('rechaza asignaciones ausentes o incompletas, conectividad inválida y nudos aislados', () => {
    const base = input(beam())
    noSolution(solveTruss({ ...base, definition: { version: 1, assignments: [] } }), 'INVALID_ASSIGNMENT')
    for (const missing of ['E', 'A'] as const) {
      const bad = { ...base.definition.assignments[0]! }
      Reflect.deleteProperty(bad, missing)
      noSolution(solveTruss({ ...base, definition: { version: 1, assignments: [bad] } }), 'INVALID_ASSIGNMENT')
    }
    const invalid = { ...beam(), bars: [{ ...beam().bars[0]!, endId: 'N3' }] }
    noSolution(solveTruss(input(invalid)), 'INVALID_MODEL')
    const coincident = { ...beam(), nodes: [beam().nodes[0]!, { ...beam().nodes[1]!, x: 0 }] }
    noSolution(solveTruss(input(coincident)), 'INVALID_MODEL')
    const isolated = { ...beam(), nodes: [...beam().nodes, { id: 'N3', label: 'N3', x: 5, y: 5 }] }
    noSolution(solveTruss(input(isolated)), 'ISOLATED_NODE')
  })

  it('rechaza momentos y toda fuerza de barra incluida en el caso, informando sus IDs', () => {
    const model = { ...beam(), loads: [
      force('C1', 'N2', 0, 0, 5),
      { kind: 'point', id: 'C2', barId: 'B1', s: 1, frame: 'local', force: { x: 0, y: -1 } },
      { kind: 'distributed', id: 'C3', barId: 'B1', s0: 0, s1: 2, frame: 'global', profile: 'uniform',
        q0: { x: 0, y: -1 }, q1: { x: 0, y: -1 } },
      { kind: 'point', id: 'C4', barId: 'B1', s: 0, frame: 'local', force: { x: 1, y: 0 } },
    ] } satisfies Structure
    const result = solveTruss(input(model))
    noSolution(result, 'UNSUPPORTED_LOAD')
    expect(result.diagnostics.map(({ code, loadIds }) => [code, loadIds])).toEqual([
      ['INACTIVE_ROTATION', ['C1']], ['UNSUPPORTED_LOAD', ['C2']], ['UNSUPPORTED_LOAD', ['C3']], ['UNSUPPORTED_LOAD', ['C4']],
    ])
  })

  it('detecta pérdida de rango acoplada sin afirmar la causa del mecanismo', () => {
    // Ambas diagonales reducidas son positivas, pero la barra libre transversal es oblicua.
    const model = { ...fixture([[0, 0], [2, 3]], [[1, 2]]), supports: [PIN] }
    const result = solveTruss(input(model))
    noSolution(result, 'UNSTABLE_OR_SINGULAR')
    expect(result.diagnostics[0]!.message).toContain('Cholesky')
  })

  it('no crea rigidez espuria en un rodillo vertical ni oculta un casi mecanismo con el escalado', () => {
    const request = (surfaceAngle: number) => input({
      ...beam(), supports: [PIN, { ...ROLL_HORIZONTAL, surfaceAngle }], loads: [],
    })
    noSolution(solveTruss(request(Math.PI / 2)), 'UNSTABLE_OR_SINGULAR')
    noSolution(solveTruss(request(Math.PI / 2 - 1e-8)), 'ILL_CONDITIONED')
  })

  it('estima condición aun si el modo débil es perpendicular al vector uniforme inicial', () => {
    // El nudo libre tiene K proporcional a [[1+r,1],[1,1]], con r el aporte axial horizontal.
    // Para r pequeño, rcond es aproximadamente r/4.
    const model = { ...fixture([[0, 0], [1, 1], [0, 1]], [[1, 2], [3, 2]]),
      supports: [PIN, { ...PIN, nodeId: 'N3' }] }
    const request = (r: number): AnalysisInput => ({
      ...input(model), definition: { version: 1, assignments: [
        { kind: 'truss2d', barId: 'B1', E, A },
        { kind: 'truss2d', barId: 'B2', E, A: A / Math.SQRT2 / 2 * r },
      ] },
    })
    const warning = solveTruss(request(1e-9))
    expect(warning.ok).toBe(true)
    expect(warning.diagnostics).toEqual([expect.objectContaining({ code: 'ILL_CONDITIONED', severity: 'warning' })])
    noSolution(solveTruss(request(1e-13)), 'ILL_CONDITIONED')
  })

  it('rechaza resultados cuando las magnitudes finitas de entrada desbordan al ensamblar', () => {
    const model = { ...beam(), loads: [force('C1', 'N2', 1e308, 0), force('C2', 'N2', 1e308, 0)] }
    noSolution(solveTruss(input(model)), 'NUMERICAL_FAILURE')
  })
})
