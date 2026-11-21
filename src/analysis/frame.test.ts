import { describe, expect, it } from 'vitest'
import type { StructuralLoad } from '../domain/load'
import { EMPTY_STRUCTURE } from '../domain/structure'
import type { Structure } from '../domain/structure'
import { evaluateFrameSection, frameEquivalentLoad, frameGlobalStiffness, frameLocalStiffness,
  frameTransformation, prepareAnalysis, solveAnalysis, solveTruss } from './index'
import type { AnalysisInput, AnalysisResult, FrameInteriorLoad, FrameResult } from './index'

const E = 200e9
const A = .02
const I = 8e-6
const FIX = { kind: 'fixed', nodeId: 'N1' } as const
const PIN = { kind: 'pinned', nodeId: 'N1' } as const
const ROLL = { kind: 'roller', surfaceAngle: 0, nodeId: 'N2' } as const

function structure(points: readonly (readonly [number, number])[], connections: readonly (readonly [number, number])[]): Structure {
  return {
    ...EMPTY_STRUCTURE,
    nodes: points.map(([x, y], i) => ({ id: `N${i + 1}`, label: `N${i + 1}`, x, y })),
    bars: connections.map(([start, end], i) => ({
      id: `B${i + 1}`, label: `B${i + 1}`, startId: `N${start}`, endId: `N${end}`,
    })),
    nextNode: points.length + 1, nextBar: connections.length + 1,
  }
}

function point(s: number, x: number, y: number, frame: 'local' | 'global' = 'local'): StructuralLoad {
  return { id: 'C1', kind: 'point', barId: 'B1', s, frame, force: { x, y } }
}

function nodal(id: string, nodeId: string, x: number, y: number, moment = 0): StructuralLoad {
  return { id, kind: 'nodal', nodeId, force: { x, y }, moment }
}

function request(model: Structure, inertia = I): AnalysisInput {
  return { model, includeTrace: true, loadCase: { id: 'referencia' }, revision: 'prueba',
    definition: { version: 1, assignments: model.bars.map(bar => ({ barId: bar.id, kind: 'frame2d', E, A, I: inertia })) } }
}

function beam(length: number, supports: Structure['supports'], ...loads: StructuralLoad[]): Structure {
  return { ...structure([[0, 0], [length, 0]], [[1, 2]]), supports, loads, nextLoad: loads.length + 1 }
}

function solved(input: AnalysisInput) {
  const result = solveAnalysis(input)
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return result
}

function frame(result: ReturnType<typeof solved>): FrameResult {
  const bar = result.bars[0]
  if (bar?.kind !== 'frame2d') throw new Error('Falta el pórtico B1')
  return bar
}

function si(actual: number, expected: number, atol = 1e-5, rtol = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(atol + rtol * Math.abs(expected))
}

function balanced(result: ReturnType<typeof solved>) {
  for (const check of result.checks) {
    for (const residual of [check.forceResidual.x, check.forceResidual.y, check.momentResidual,
      check.freeResidual, check.freeMomentResidual, check.rollerTangentialResidual]) si(residual, 0)
    si(check.compatibilityResidual, 0, 1e-10)
    si(check.rotationCompatibilityResidual, 0, 1e-10)
    expect(check.backwardError).toBeLessThanOrEqual(1e-10)
  }
}

function failed(result: AnalysisResult, code: string, evidence: Record<string, unknown> = {}) {
  expect(result.ok).toBe(false)
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, severity: 'error', ...evidence }))
  expect(result).not.toHaveProperty('bars')
  expect(result).not.toHaveProperty('displacements')
  expect(result).not.toHaveProperty('reactions')
}

describe('Oráculos analíticos de pórtico plano', () => {
  it('E · viga con carga central: flecha exacta y salto de cortante', () => {
    const result = solved(request(beam(6, [PIN, ROLL], point(3, 0, -12_000))))
    for (const reaction of result.reactions) si(reaction.y, 6000)
    si(result.displacements[0]!.rotation!, -.016875, 1e-10)
    si(result.displacements[1]!.rotation!, .016875, 1e-10)
    const bar = frame(result)
    const left = evaluateFrameSection(bar, 3, 'left')
    const right = evaluateFrameSection(bar, 3, 'right')
    si(left.v, -.03375, 1e-9, 1e-7)
    si(left.rotation, 0, 1e-10)
    si(left.M, 18_000)
    si(right.M, left.M)
    si(left.V, 6000)
    si(right.V, -6000)
    si(right.v, left.v, 1e-10)
    expect(bar.sections.map(({ s, side }) => [s, side])).toEqual([[0, 'right'], [3, 'left'], [3, 'right'], [6, 'left']])
    expect(() => evaluateFrameSection(bar, -1)).toThrow(RangeError)
    expect(() => evaluateFrameSection(bar, NaN)).toThrow(RangeError)
    balanced(result)
  })

  it('F · viga con carga uniforme: solución cuártica de Euler–Bernoulli', () => {
    const q = { x: 0, y: -5000 }
    const result = solved(request(beam(4, [PIN, ROLL],
      { id: 'C1', kind: 'distributed', barId: 'B1', s0: 0, s1: 4, frame: 'global', profile: 'uniform', q0: q, q1: q })))
    for (const reaction of result.reactions) si(reaction.y, 10_000)
    si(result.displacements[0]!.rotation!, -.008333333333, 1e-10)
    si(result.displacements[1]!.rotation!, .008333333333, 1e-10)
    const section = evaluateFrameSection(frame(result), 2)
    si(section.v, -.010416666667, 1e-9, 1e-7)
    si(section.M, 10_000)
    si(section.rotation, 0, 1e-10)
    balanced(result)
  })

  it('G · voladizo: fuerza nodal, carga de extremo y signo del momento de corte', () => {
    const nodalResult = solved(request(beam(3, [FIX], nodal('C1', 'N2', 0, -8000)), 1e-5))
    const endpoint = solved(request(beam(3, [FIX], point(3, 0, -8000)), 1e-5))
    expect(endpoint.loads[0]).toMatchObject({ id: 'C1', kind: 'nodal', nodeId: 'N2', barId: 'B1' })
    expect(endpoint.trace!.F).toEqual(nodalResult.trace!.F)
    expect(frame(endpoint).equivalentLocal).toEqual([0, 0, 0, 0, 0, 0])
    si(endpoint.displacements[1]!.y, -.036, 1e-10)
    si(endpoint.displacements[1]!.rotation!, -.018, 1e-10)
    si(endpoint.reactions[0]!.y, 8000)
    si(endpoint.reactions[0]!.moment!, 24_000)
    si(frame(endpoint).sections[0]!.M, -24_000)
    balanced(endpoint)
    const atFixed = solved(request(beam(3, [FIX], point(0, 30, -50))))
    si(atFixed.reactions[0]!.x, -30)
    si(atFixed.reactions[0]!.y, 50)
    si(atFixed.reactions[0]!.moment!, 0)
    si(frame(atFixed).sections[0]!.V, 0)
  })

  it('H · pórtico simétrico: referencia de pendiente–deflexión con axial de columnas', () => {
    const model = { ...structure([[0, 0], [0, 2], [2, 2], [2, 0]], [[1, 2], [2, 3], [4, 3]]),
      supports: [FIX, { ...FIX, nodeId: 'N4' }], loads: [nodal('C1', 'N2', 10_000, 0), nodal('C2', 'N3', 10_000, 0)] }
    const result = solved(request(model, 2e-5))
    for (const [i, sign] of [[0, 1], [1, -1]] as const) {
      const d = result.displacements[i + 1]!
      const r = result.reactions[i]!
      si(d.x, 2.38462270435e-3, 1e-10)
      si(d.y, sign * 4.28204396232e-6, 1e-10)
      si(d.rotation!, -7.17956037682e-4, 1e-10)
      si(r.x, -10_000)
      si(r.y, -sign * 8564.08792464)
      si(r.moment!, 11435.91207536)
    }
    balanced(result)
    expect(result.trace!.components[0]!.reducedDofs.map(d => d.axis)).toEqual(['ux', 'uy', 'rz', 'ux', 'uy', 'rz'])
    expect(result).toEqual(solved(request({ ...model, nodes: [...model.nodes].reverse(),
      bars: [...model.bars].reverse(), loads: [...model.loads].reverse() }, 2e-5)))
  })
})

describe('Formulación y cargas consistentes', () => {
  it.each([[2, 0], [0, 2], [3, 4]])('conserva simetría, matriz local y energía bajo orientación (%d, %d)', (x, y) => {
    const prepared = prepareAnalysis(request(structure([[0, 0], [x, y]], [[1, 2]])))
    if (!prepared.ok || prepared.model.bars[0]?.kind !== 'frame2d') throw new Error('Falta el modelo preparado')
    const bar = prepared.model.bars[0]
    const local = frameLocalStiffness(bar)
    const global = frameGlobalStiffness(bar)
    const T = frameTransformation(bar.unit)
    const L = Math.hypot(x, y)
    si(local[0]!, E * A / L)
    si(local[7]!, 12 * E * I / L ** 3)
    si(local[8]!, 6 * E * I / L ** 2)
    si(local[14]!, 4 * E * I / L)
    si(local[17]!, 2 * E * I / L)
    const dofs = [.001, -.003, .008, .004, -.005, -.007]
    const localDofs = dofs.map((_, row) => dofs.reduce((sum, d, col) => sum + T[row * 6 + col]! * d, 0))
    const energy = (matrix: Float64Array, d: number[]) => matrix.reduce((sum, k, i) => sum + d[Math.floor(i / 6)]! * k * d[i % 6]!, 0)
    si(energy(global, dofs), energy(local, localDofs), 1e-10)
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      expect(global[i * 6 + j]).toBe(global[j * 6 + i])
      let expected = 0
      for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
        expected += T[a * 6 + i]! * local[a * 6 + b]! * T[b * 6 + j]!
      }
      si(global[i * 6 + j]!, expected)
    }
  })

  it.each([
    ['uniforme parcial', 5, -7, 5, -7],
    ['triangular', 0, 0, 11, -15],
    ['trapezoidal', 2, -7, 5, -9],
  ] as const)('integra el caso %s frente a antiderivadas y conserva resultantes', (_, x0, y0, x1, y1) => {
    const L = 8
    const s0 = 2
    const s1 = 5
    const load: FrameInteriorLoad = { id: 'C1', barId: 'B1', kind: 'distributed', s0, s1,
      q0: { x: x0, y: y0 }, q1: { x: x1, y: y1 } }
    const f = frameEquivalentLoad(L, load)
    const span = s1 - s0
    function analytic(coefficients: number[], start: number, end: number) {
      const slope = (end - start) / span
      const intercept = start - slope * s0
      const intPower = (power: number) => (s1 ** (power + 1) - s0 ** (power + 1)) / (power + 1)
      return coefficients.reduce((sum, coef, p) => sum + coef * (intercept * intPower(p) + slope * intPower(p + 1)), 0)
    }
    const exact = [
      analytic([1, -1 / L], x0, x1), analytic([1, 0, -3 / L ** 2, 2 / L ** 3], y0, y1),
      analytic([0, 1, -2 / L, 1 / L ** 2], y0, y1), analytic([0, 1 / L], x0, x1),
      analytic([0, 0, 3 / L ** 2, -2 / L ** 3], y0, y1), analytic([0, 0, -1 / L, 1 / L ** 2], y0, y1),
    ]
    for (const [i, value] of f.entries()) si(value, exact[i]!, 1e-11)
    si(f[0] + f[3], span * (x0 + x1) / 2, 1e-10)
    si(f[1] + f[4], span * (y0 + y1) / 2, 1e-10)
    si(f[2] + f[5] + L * f[4], analytic([0, 1], y0, y1), 1e-10)
    const profile = x0 === x1 && y0 === y1 ? 'uniform' : 'linear'
    const result = solved(request(beam(L, [FIX], { ...load, profile, frame: 'local' })))
    si(result.reactions[0]!.x, -analytic([1], x0, x1))
    si(result.reactions[0]!.y, -analytic([1], y0, y1))
    si(result.reactions[0]!.moment!, -analytic([0, 1], y0, y1))
    const section = evaluateFrameSection(frame(result), 6)
    si(section.N, 0)
    si(section.V, 0)
    si(section.M, 0)
    si(section.v, analytic([0, 0, 6 / 2, -1 / 6], y0, y1) / (E * I), 1e-10)
    balanced(result)
  })

  it('transforma una carga oblicua, suma fuerzas y pares y preserva el trabajo virtual', () => {
    const model = { ...structure([[0, 0], [3, 4]], [[1, 2]]), supports: [FIX],
      loads: [point(2.5, 3000, -4000, 'global'), nodal('C2', 'N2', 0, 0, 900), nodal('C3', 'N2', 0, 0, -200)] }
    const result = solved(request(model))
    const bar = frame(result)
    const localX = .6 * 3000 - .8 * 4000
    const localY = -.8 * 3000 - .6 * 4000
    const actual = bar.equivalentLocal
    expect(actual).toEqual([localX / 2, localY / 2, 5 / 8 * localY, localX / 2, localY / 2, -5 / 8 * localY])
    const virtual = [3, 6, .03, -2, -4, .11]
    const equivalentWork = actual.reduce((sum, f, i) => sum + f * virtual[i]!, 0)
    si(equivalentWork, localX * .5 + localY * (1 + 5 / 8 * (.03 - .11)))
    si(result.reactions[0]!.moment!, 11300)
    si(result.trace!.F[5]!, 700 + actual[5])
    const left = evaluateFrameSection(bar, 2.5, 'left')
    const right = evaluateFrameSection(bar, 2.5, 'right')
    si(right.N - left.N, -localX)
    si(right.V - left.V, localY)
    si(right.M, left.M)
    const ds = .01
    si((left.M - evaluateFrameSection(bar, 2.5 - ds).M) / ds, left.V)
    balanced(result)
  })

  it('invierte una barra inclinada con cargas solapadas sin alterar su efecto físico', () => {
    const loadA = point(1, 120, -420)
    const loadB = { id: 'C2', kind: 'distributed', barId: 'B1', s0: 1.25, s1: 3, frame: 'local', profile: 'linear',
      q0: { x: 1500, y: -600 }, q1: { x: 230, y: -800 } } as const
    const loadC = { ...loadB, id: 'C3', frame: 'global', s0: 1, s1: 4 } as const
    const model = { ...structure([[0, 0], [3, 4]], [[1, 2]]), supports: [FIX], loads: [loadA, loadB, loadC] }
    const reversed = { ...model, bars: [{ ...model.bars[0]!, startId: 'N2', endId: 'N1' }],
      loads: [point(4, -120, 420), { ...loadB, s0: 2, s1: 3.75, q0: { x: -230, y: 800 }, q1: { x: -1500, y: 600 } },
        { ...loadC, q0: loadC.q1, q1: loadC.q0 }] }
    const original = solved(request(model))
    const after = solved(request(reversed))
    for (const key of ['x', 'y', 'rotation'] as const) si(after.displacements[1]![key]!, original.displacements[1]![key]!, 1e-10)
    for (const key of ['x', 'y', 'moment'] as const) si(after.reactions[0]![key]!, original.reactions[0]![key]!)
    const a = evaluateFrameSection(frame(original), 1, 'left')
    const b = evaluateFrameSection(frame(after), 4, 'right')
    si(b.N, a.N)
    si(b.V, a.V)
    si(b.M, -a.M)
    si(b.u, -a.u, 1e-10)
    si(b.v, -a.v, 1e-10)
    si(b.rotation, a.rotation, 1e-10)
    balanced(original)
    balanced(after)
  })

  it('recupera la carga pequeña cuando hay fuerzas opuestas superpuestas en la misma estación', () => {
    const loads = [1e16, -16, -1e16].map((y, i) => ({ ...point(2, 0, y), id: `C${i + 1}` }))
    const result = solved(request(beam(4, [PIN, ROLL], ...loads)))
    const section = frame(result)
    si(result.reactions[0]!.y, 8)
    si(evaluateFrameSection(section, 2, 'left').V, 8)
    si(evaluateFrameSection(section, 2, 'right').V, -8)
    si(evaluateFrameSection(section, 2).M, 16)
    balanced(result)
  })
})

describe('Integración de restricciones y armaduras', () => {
  it('comparte la traslación en la unión y solo activa giro en los nodos incidentes a pórticos', () => {
    const model = { ...structure([[0, 0], [2, 0], [5, 0]], [[1, 2], [2, 3]]), supports: [FIX, { ...ROLL, nodeId: 'N3' }],
      loads: [nodal('C1', 'N3', 10_000, 0)] }
    const base = request(model)
    const input: AnalysisInput = { ...base, definition: { version: 1,
      assignments: [base.definition.assignments[0]!, { kind: 'truss2d', barId: 'B2', E, A }] } }
    const result = solved(input)
    expect(result.dofs.map(d => `${d.nodeId}.${d.axis}`)).toEqual(['N1.ux', 'N1.uy', 'N1.rz',
      'N2.ux', 'N2.uy', 'N2.rz', 'N3.ux', 'N3.uy'])
    si(result.displacements[1]!.x, 20_000 / (E * A), 1e-10)
    si(result.displacements[2]!.x, 50_000 / (E * A), 1e-10)
    si(result.bars[1]!.axialForce, 10_000)
    expect(result.displacements[2]).not.toHaveProperty('rotation')
    expect(result.trace!.elements[1]!.dofIndices).toEqual([3, 4, 6, 7])
    balanced(result)
    failed(solveAnalysis({ ...input, model: { ...model, loads: [nodal('C1', 'N3', 0, 0, 1)] } }), 'INACTIVE_ROTATION',
      { nodeIds: ['N3'] })
  })

  it('el rodillo inclinado restringe solo la normal y conserva el giro', () => {
    const angle = Math.PI / 4
    const result = solved(request(beam(2, [PIN, { ...ROLL, surfaceAngle: angle }], nodal('C1', 'N2', 0, -10_000))))
    const d = result.displacements[1]!
    si(d.x, -20_000 / (E * A), 1e-10)
    si(d.y, d.x, 1e-10)
    si(d.rotation!, d.y / 2, 1e-10)
    si(result.reactions[1]!.x, -10_000)
    si(result.reactions[1]!.y, 10_000)
    expect(result.reactions[1]).not.toHaveProperty('moment')
    expect(result.trace!.components[0]!.reducedDofs.map(dof => dof.axis)).toEqual(['rz', 'tangent', 'rz'])
    balanced(result)
  })

  it('rechaza I omitida, rigideces no representables y mecanismos de cuerpo rígido', () => {
    const base = request(beam(2, [FIX]))
    for (const inertia of [NaN, 0, -1, Infinity, Number.MAX_VALUE]) {
      failed(solveAnalysis(request(base.model, inertia)), 'INVALID_ASSIGNMENT', { barIds: ['B1'] })
    }
    const missing = { ...base, definition: { version: 1, assignments: [{ kind: 'frame2d', barId: 'B1', E, A }] } } as unknown as AnalysisInput
    failed(solveAnalysis(missing), 'INVALID_ASSIGNMENT', { barIds: ['B1'] })
    failed(solveAnalysis(request(beam(2, [PIN]))), 'UNSTABLE_OR_SINGULAR', {
      direction: expect.objectContaining({ nodeId: expect.stringMatching(/^N[12]$/), axis: expect.stringMatching(/^(uy|rz)$/) }),
    })
  })

  it('mantiene las soluciones de armaduras y distingue su API estricta de la API mixta', () => {
    const model = beam(2, [PIN, ROLL], nodal('C1', 'N2', 10_000, 0))
    const input: AnalysisInput = { ...request(model), definition: {
      version: 1, assignments: [{ kind: 'truss2d', barId: 'B1', E, A }],
    } }
    const result = solved(input)
    const legacy = solveTruss(input)
    if (!legacy.ok) throw new Error('Falló el caso de armadura anterior')
    expect(result.bars).toEqual(legacy.bars)
    expect(result.trace).toEqual(legacy.trace)
    expect(result.displacements).toEqual(legacy.displacements)
    const end = { ...input, model: { ...model, loads: [point(2, 10_000, 0)] } }
    expect(solved(end).trace!.F).toEqual(result.trace!.F)
    failed(solveTruss(end), 'UNSUPPORTED_LOAD')
    for (const load of [point(1, 1000, 0), point(1, 0, 1000)]) {
      failed(solveAnalysis({ ...input, model: { ...model, loads: [load] } }), 'UNSUPPORTED_LOAD', { loadIds: ['C1'] })
    }
  })
})
