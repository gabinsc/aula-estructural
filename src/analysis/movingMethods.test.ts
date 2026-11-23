import { describe, expect, it } from 'vitest'
import type { StructuralLoad } from '../domain/load'
import type { Structure } from '../domain/structure'
import { EMPTY_STRUCTURE } from '../domain/structure'
import { solveCross } from './cross'
import { solveVirtualWork } from './virtualWork'
import { solveForceMethod } from './forceMethod'
import { buildInfluencePath, solveInfluence } from './influence'
import type { InfluenceOptions, InfluenceTarget } from './influence'
import { curveAt, trainEnvelope, trainValue } from './influenceCurve'
import type { Train } from './influenceCurve'
import type { AnalysisInput } from './contracts'

const E = 200e9, A = .02, I = 8e-6, EI = E * I
const down = { x: 0, y: -1 }
const up = { x: 0, y: 1 }
const pin = { nodeId: 'N1', kind: 'pinned' } as const
const fixed = { nodeId: 'N1', kind: 'fixed' } as const
const roller = (nodeId: string, surfaceAngle = 0) => ({ nodeId, kind: 'roller', surfaceAngle } as const)
const uniform = (barId: string, length: number, q: number, id = 'C1'): StructuralLoad =>
  ({ id, barId, kind: 'distributed', frame: 'global', profile: 'uniform', s0: 0, s1: length, q0: { x: 0, y: -q }, q1: { x: 0, y: -q } })
function model(points: readonly (readonly [number, number])[], connections: readonly (readonly [number, number])[],
  supports: Structure['supports'], loads: Structure['loads'] = []): AnalysisInput {
  const nodes = points.map(([x, y], i) => ({ x, y, id: `N${i + 1}`, label: `N${i + 1}` }))
  const bars = connections.map(([i, j], k) => ({ startId: `N${i}`, endId: `N${j}`, label: `B${k + 1}`, id: `B${k + 1}` }))
  const definition: AnalysisInput['definition'] = { version: 1,
    assignments: bars.map(({ id: barId }) => ({ barId, kind: 'frame2d', E, A, I })) }
  return { model: { ...EMPTY_STRUCTURE, nodes, bars, supports, loads, mechanics: definition,
    nextNode: nodes.length + 1, nextBar: bars.length + 1, nextLoad: loads.length + 1 }, definition, loadCase: { id: 'prueba' } }
}
const beam = (length = 6, supports: Structure['supports'] = [pin, roller('N2')], loads?: Structure['loads']) =>
  model([[0, 0], [length, 0]], [[1, 2]], supports, loads)
const reaction = (nodeId: string): InfluenceTarget => ({ kind: 'reaction', nodeId, direction: up })
const section = (field: 'N' | 'V' | 'M', side: 'left' | 'right' = 'right'): InfluenceTarget =>
  ({ kind: 'effort', barId: 'B1', field, s: 3, side })

function influence(input: AnalysisInput, target: InfluenceTarget, options: Partial<InfluenceOptions> = {}) {
  const old = structuredClone(input)
  const solution = solveInfluence(input, { bars: ['B1'], reversed: false, target, direction: down, ...options })
  if (!solution.ok) throw new Error(JSON.stringify(solution.result.diagnostics))
  expect(old).toEqual(input)
  return { ...solution.detail, at: (s: number, side?: 'left' | 'right') => curveAt(solution.detail.pieces, solution.detail.knots, s, side) }
}
function close(a: number, b: number, abs = 1e-8) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(abs + 1e-8 * Math.abs(b))
}

it('la primaria conserva la liberación j y Cross usa factor 3EI/L sin transporte', () => {
  const length = 4, q = 5000
  const source = beam(length, [fixed, roller('N2')], [uniform('B1', length, q)])
  const input: AnalysisInput = { ...source, model: { ...source.model, bars: [{ ...source.model.bars[0]!, releaseJ: true }] } }
  const forces = solveForceMethod(input, ['N2:normal'])
  if (!forces.ok) throw new Error(JSON.stringify(forces.result.diagnostics))
  expect(forces.detail.primaryIndeterminacy).toBe(0)
  close(forces.result.reactions.find(item => item.nodeId === 'N2')!.y, 3 * q * length / 8)
  const output = solveCross(input)
  if (!output.ok) throw new Error(JSON.stringify(output.result.diagnostics))
  const end = output.detail.joints.find(joint => joint.nodeId === 'N1')?.ends[0]
  expect(end?.carry).toBe(0)
  close(end!.stiffness, 3 * EI / length)
  close(output.detail.final['B1:j']!, 0)
  close(Math.abs(output.detail.final['B1:i']!), q * length ** 2 / 8)
})

describe('Líneas de influencia y ejes móviles', () => {
  it('Gerber: las ordenadas de reacción reproducen el equilibrio del tramo suspendido', () => {
    const input = model([[0, 0], [4, 0], [6, 0], [10, 0]], [[1, 2], [2, 3], [3, 4]], [pin, roller('N2'), roller('N4')])
    const gerber: AnalysisInput = { ...input, model: { ...input.model, bars: input.model.bars.map((bar, i) => ({
      ...bar, ...(i === 1 && { releaseJ: true }), ...(i === 2 && { releaseI: true }),
    })) } }
    for (const [node, atSix, atEight] of [['N1', -.5, -.25], ['N2', 1.5, .75], ['N4', 0, .5]] as const) {
      const line = influence(gerber, reaction(node), { bars: ['B1', 'B2', 'B3'] })
      close(line.at(8), atEight)
      close(line.at(6), atSix)
    }
  })

  it('usa la flecha de la unión en trabajo virtual y diagnostica la consulta de giro en su cara', () => {
    const initial = model([[0, 0], [4, 0], [8, 0]], [[1, 2], [2, 3]], [fixed, { ...fixed, nodeId: 'N3' }],
      [{ id: 'C1', kind: 'nodal', nodeId: 'N2', force: { x: 0, y: -12000 }, moment: 0 }])
    const input: AnalysisInput = { ...initial, model: { ...initial.model, bars: [
      { ...initial.model.bars[0]!, releaseJ: true }, { ...initial.model.bars[1]!, releaseI: true },
    ] } }
    const translation = solveVirtualWork(input, { target: { kind: 'node', id: 'N2' }, motion: { kind: 'translation', direction: down } })
    if (!translation.ok) throw new Error(JSON.stringify(translation.result.diagnostics))
    expect(translation.detail.agrees).toBe(true)
    close(translation.detail.reference, 6000 * 4 ** 3 / (3 * EI))
    const rotation = solveVirtualWork(input, { target: { kind: 'section', id: 'B1', s: 4 }, motion: { kind: 'rotation' } })
    expect(rotation.ok).toBe(false)
  })
  it('reacciones en ambos apoyos y superposición entre barras invertidas', () => {
    const original = beam()
    for (const s of [0, .27, 1.83, 3, 4.792, 6]) {
      close(influence(original, reaction('N1')).at(s), 1 - s / 6)
      close(influence(original, reaction('N2')).at(s), s / 6)
    }
    const flipped = { ...original, model: { ...original.model,
      bars: original.model.bars.map(bar => ({ ...bar, startId: bar.endId, endId: bar.startId })) } }
    close(influence(flipped, reaction('N1'), { reversed: true }).at(2.7), .55)
  })

  it('cortante: conserva ambos límites y evalúa el valor exacto según el lado del corte', () => {
    const right = influence(beam(), section('V', 'right'))
    close(right.at(3, 'left'), -.5)
    close(right.at(3, 'right'), .5)
    close(right.at(3), -.5)
    close(influence(beam(), section('V', 'left')).at(3), .5)
    close(right.at(1.2), -.2)
    close(right.at(4.8), .2)
    const reverse = influence(beam(), section('V'), { reversed: true })
    close(reverse.at(3, 'left'), .5)
    close(reverse.at(3, 'right'), -.5)
  })

  it('momento máximo en el corte y desplazamiento extremo dentro de un tramo', () => {
    const moment = influence(beam(), section('M'))
    close(moment.max.s, 3)
    close(moment.max.value, 1.5)
    expect(moment.zeros).toEqual([0, 6])
    // El nodo intermedio pertenece a una viga de dos elementos sin apoyo central.
    const input = model([[0, 0], [3, 0], [6, 0]], [[1, 2], [2, 3]], [pin, roller('N3')])
    const mid = influence(input, { kind: 'displacement', nodeId: 'N2', motion: { kind: 'translation', direction: up } }, { bars: ['B1', 'B2'] })
    close(mid.min.value, -(6 ** 3) / (48 * EI))
    // Flecha de extremo de un voladizo bajo una unidad a la distancia a.
    const flex = influence(beam(6, [fixed]), { kind: 'displacement', nodeId: 'N2', motion: { kind: 'translation', direction: up } })
    close(flex.at(2.3), -(2.3 ** 2) * (18 - 2.3) / (6 * EI))
    const rotation = influence(beam(6, [fixed]), { kind: 'displacement', nodeId: 'N2', motion: { kind: 'rotation' } })
    close(rotation.at(2.3), -(2.3 ** 2) / (2 * EI))
    close(influence(beam(6, [fixed]), section('N'), { direction: { x: 1, y: 0 } }).at(4), 1)
  })

  it('reacción intermedia de dos vanos y continuidad topológica por ID', () => {
    const input = model([[0, 0], [4, 0], [8, 0]], [[1, 2], [3, 2]], [pin, roller('N2'), roller('N3')])
    const line = influence(input, reaction('N2'), { bars: ['B1', 'B2'] })
    close(line.at(1.7), 1.7 * (3 * 4 ** 2 - 1.7 ** 2) / (2 * 4 ** 3))
    close(line.at(6.3), line.at(1.7))
    close(line.at(4), 1)
    const disconnected = model([[0, 0], [4, 0], [4, 0], [8, 0]], [[1, 2], [3, 4]], [pin])
    expect(() => buildInfluencePath(disconnected.model, ['B1', 'B2'])).toThrow(/discontinuo/)
    const fork = model([[0, 0], [4, 0], [8, 0], [4, 2]], [[1, 2], [2, 3], [2, 4]], [pin])
    expect(() => buildInfluencePath(fork.model, ['B1', 'B2', 'B3'])).toThrow(/discontinuo/)
    expect(buildInfluencePath(fork.model, ['B1', 'B3'])).toHaveLength(2)
  })

  it('dos y tres ejes, signos, sentido, extremos y entrada o salida parcial', () => {
    const id = 'ensayo'
    const two: Train = { id, name: 'dos', sense: 1,
      axles: [{ id: 'a', force: 10, offset: 0 }, { id: 'b', force: 20, offset: 2 }] }
    const a = influence(beam(), section('M'), { train: two })
    close(a.train!.envelope.max.s, 5)
    close(a.train!.envelope.max.value, 35)
    close(a.train!.verification.direct, a.train!.verification.ordinate)
    close(trainValue(a.pieces, a.knots, two, .5), 2.5)
    close(trainValue(a.pieces, a.knots, two, 7), 10)
    close(trainValue(a.pieces, a.knots, two, 8.1), 0)
    const three: Train = { ...two, sense: -1, axles: [
      { id: 'a', force: 10, offset: 0 }, { id: 'b', force: 20, offset: 1 }, { id: 'c', force: 30, offset: 3 },
    ] }
    const b = influence(beam(), section('M'), { train: three })
    close(b.train!.envelope.max.value, 55)
    close(b.train!.verification.direct, b.train!.verification.ordinate)
  })

  it('comprueba máximos de raíz interior y rechaza una ruta de armadura', () => {
    const input = beam(6, [pin, roller('N2')])
    const line = influence(input, { kind: 'displacement', nodeId: 'N1', motion: { kind: 'rotation' } })
    const a = 6 * (1 - 1 / Math.sqrt(3))
    close(line.min.s, a)
    close(line.min.value, -a * (6 - a) * (12 - a) / (36 * EI))
    const assignments = [{ kind: 'truss2d' as const, barId: 'B1', E, A }]
    expect(() => buildInfluencePath(input.model, ['B1'], false, assignments)).toThrow(/pórtico/)
  })

  it('incluye la respuesta nula fuera de un camino con ordenada constante no nula', () => {
    const train = { id: 'T1', name: 'Eje opuesto', sense: 1 as const, axles: [{ id: 'E1', force: -2000, offset: 0 }] }
    const line = influence(beam(6, [fixed]), reaction('N1'), { train })
    close(line.train!.envelope.min.value, -2000)
    close(line.train!.envelope.max.value, 0)
    expect(line.train!.envelope.max.side).toBe('left')
    close(trainValue(line.pieces, line.knots, train, 0), -2000)
    close(trainValue(line.pieces, line.knots, train, 0, 'left'), 0)
  })

  it('rechaza un tren cuyo desplazamiento colapsa estaciones físicamente distintas', () => {
    const piece = { from: 0, to: 1e-8, coefficients: [1, 0, 0, 0] as const }
    const knots = [{ s: piece.from, exact: 1, right: 1 }, { s: piece.to, exact: 1, left: 1 }]
    expect(() => trainEnvelope([piece], knots, { id: 'T1', name: 'Resolución', sense: 1,
      axles: [{ id: 'E1', force: 1, offset: 0 }, { id: 'E2', force: 2, offset: 1e9 }] })).toThrow(/distinguir sus estaciones/)
  })
})

function cross(input: AnalysisInput) {
  const original = structuredClone(input)
  const output = solveCross(input)
  if (!output.ok) throw new Error(JSON.stringify(output.result.diagnostics))
  expect(input).toEqual(original)
  expect(output.detail.residual).toBeLessThanOrEqual(output.detail.tolerance)
  expect(output.detail.maxMomentError).toBeLessThan(1e-5)
  for (const joint of output.detail.joints) close(joint.ends.reduce((sum, end) => sum + end.factor, 0), joint.fixed ? 0 : 1)
  for (const iteration of output.detail.iterations) for (const balance of iteration.balances) {
    close(balance.ends.reduce((sum, end) => sum + end.distributed, 0), -balance.imbalance)
    for (const end of balance.ends) close(end.carried, end.distributed / 2)
  }
  return output
}

describe('Distribución de momentos de Hardy Cross', () => {
  it.each([[2, 8], [3, 10]])('viga de %i vanos, M de apoyo interior −qL²/%i', (spans, divisor) => {
    const L = 4, q = 5000
    const nodes = Array.from({ length: spans + 1 }, (_, i) => [i * L, 0] as const)
    const joins = nodes.slice(1).map((_, i) => [i + 1, i + 2] as const)
    const output = cross(model(nodes, joins, [pin, ...nodes.slice(1).map((_, i) => roller(`N${i + 2}`))],
      joins.map((_, i) => uniform(`B${i + 1}`, L, q, `C${i + 1}`))))
    close(output.detail.final['B1:j']!, -q * L ** 2 / divisor, 1e-6)
    close(output.detail.final['B2:i']!, q * L ** 2 / divisor, 1e-6)
    close(output.result.reactions[0]!.y, q * L * (.5 - 1 / divisor), 1e-6)
    expect(output.detail.iterations.length).toBeGreaterThan(1)
  })

  it('pórtico simétrico sin desplazamiento lateral, bases empotradas y traslación X impedida arriba', () => {
    const q = 5000, L = 2
    const output = cross(model([[0, 0], [0, L], [L, L], [L, 0]], [[1, 2], [2, 3], [4, 3]],
      [fixed, { ...fixed, nodeId: 'N4' }, roller('N2', -Math.PI / 2), roller('N3', -Math.PI / 2)], [uniform('B2', L, q)]))
    close(output.detail.final['B1:i']!, -q * L ** 2 / 36, 1e-6)
    close(output.detail.final['B3:i']!, q * L ** 2 / 36, 1e-6)
  })

  it('empotramiento perfecto bajo carga puntual excéntrica', () => {
    const P = 12000, L = 6, s = 2
    const { detail } = cross(beam(L, [fixed, { ...fixed, nodeId: 'N2' }],
      [{ id: 'C1', kind: 'point', barId: 'B1', frame: 'global', s, force: { x: 0, y: -P } }]))
    close(detail.final['B1:i']!, P * s * (1 - s / L) ** 2, 1e-6)
    close(detail.final['B1:j']!, -P * s ** 2 * (1 - s / L) / L, 1e-6)
    expect(detail.iterations).toHaveLength(0)
  })

  it.each([[5000, 5000], [1200, 7000]])('carga parcial con intensidades %i y %i', (q0, q1) => {
    const L = 6, a = 1, b = 4
    const slope = (q1 - q0) / (b - a), constant = q0 - slope * a
    const moment = (p: number) => constant * (b ** (p + 1) - a ** (p + 1)) / (p + 1) +
      slope * (b ** (p + 2) - a ** (p + 2)) / (p + 2)
    const { detail } = cross(beam(L, [fixed, { ...fixed, nodeId: 'N2' }], [
      { id: 'C1', kind: 'distributed', barId: 'B1', frame: 'global', profile: q0 === q1 ? 'uniform' : 'linear',
        s0: a, s1: b, q0: { x: 0, y: -q0 }, q1: { x: 0, y: -q1 } },
    ]))
    close(detail.final['B1:i']!, moment(1) - 2 * moment(2) / L + moment(3) / L ** 2, 1e-6)
    close(detail.final['B1:j']!, -moment(2) / L + moment(3) / L ** 2, 1e-6)
  })

  it('rechaza mecanismo y traslación lateral sin estabilizar artificialmente', () => {
    expect(solveCross(beam(6, [pin])).ok).toBe(false)
    const load: StructuralLoad = { kind: 'nodal', id: 'C1', nodeId: 'N2', force: { x: 0, y: -1000 }, moment: 0 }
    const output = solveCross(beam(6, [fixed], [load]))
    expect(output.ok).toBe(false)
    expect(output.result.diagnostics[0]!.message).toMatch(/momentos de cuerda/)
  })
})
