import { describe, expect, it } from 'vitest'
import { evaluateFrameSection, solveAnalysis } from '../../analysis'
import type { ElementAssignment, FrameResult } from '../../analysis'
import type { StructuralLoad } from '../../domain/load'
import { EMPTY_STRUCTURE } from '../../domain/structure'
import type { Structure } from '../../domain/structure'
import { buildFrameFields, isEffortJump } from './diagramFields'
import { developedSpan, developedStation, developedValue, localStation } from './developedSpan'
import { bezierControls, buildDiagramModel, deformationFactor, deformedPoint, diagramPoint, effortCurve, effortHeight,
  memberDisplacement, pickDiagram } from './diagramModel'

const E = 200e9, A = .02, I = 8e-6
const PIN = { kind: 'pinned', nodeId: 'N1' } as const
const ROLL = { kind: 'roller', nodeId: 'N2', surfaceAngle: 0 } as const
const FIX = { kind: 'fixed', nodeId: 'N1' } as const
const viewport = { width: 900, height: 600 }
const camera = { center: { x: 0, y: 0 }, scale: 50 }

function model(points: readonly (readonly [number, number])[], links: readonly (readonly [number, number])[],
  supports: Structure['supports'], loads: Structure['loads']): Structure {
  return { ...EMPTY_STRUCTURE, nodes: points.map(([x, y], i) => ({ id: `N${i + 1}`, label: `N${i + 1}`, x, y })),
    bars: links.map(([a, b], i) => ({ id: `B${i + 1}`, label: `B${i + 1}`, startId: `N${a}`, endId: `N${b}` })),
    supports, loads, nextNode: points.length + 1, nextBar: links.length + 1, nextLoad: loads.length + 1 }
}

function beam(L: number, supports: Structure['supports'], ...loads: StructuralLoad[]) {
  return model([[0, 0], [L, 0]], [[1, 2]], supports, loads)
}

function nodal(x: number, y: number, moment = 0, nodeId = 'N2', id = 'C1'): StructuralLoad {
  return { id, kind: 'nodal', nodeId, force: { x, y }, moment }
}

function point(s: number, x: number, y: number): StructuralLoad {
  return { id: 'C1', kind: 'point', barId: 'B1', frame: 'local', s, force: { x, y } }
}

function line(s0: number, s1: number, q0: {x: number; y: number}, q1 = q0): StructuralLoad {
  return { id: 'C1', kind: 'distributed', barId: 'B1', frame: 'local', s0, s1,
    profile: q0.x === q1.x && q0.y === q1.y ? 'uniform' : 'linear', q0, q1 }
}

function solve(structure: Structure, kind: 'truss2d' | 'frame2d' = 'frame2d', inertia = I) {
  const assignments = structure.bars.map(({ id }): ElementAssignment => kind === 'frame2d'
    ? { barId: id, kind, E, A, I: inertia } : { barId: id, kind, E, A })
  const result = solveAnalysis({ model: structure, definition: { version: 1, assignments }, loadCase: { id: 'todos' } })
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return result
}

function frame(structure: Structure, inertia = I): FrameResult {
  const candidate = solve(structure, 'frame2d', inertia).bars[0]
  if (candidate?.kind !== 'frame2d') throw new Error('Barra B1 sin resultados de pórtico')
  return candidate
}

describe('Estaciones numéricas de AVM', () => {
  it.each([10_000, -10_000])('conserva el axial constante y su signo %d en una armadura', load => {
    const structure = beam(2, [PIN, ROLL], nodal(load, 0))
    const result = solve(structure, 'truss2d')
    const diagram = buildDiagramModel(structure, result)
    const [member] = diagram.members
    expect(member!.bar.axialForce).toBeCloseTo(load, 7)
    expect(diagram.maxima).toEqual({ N: Math.abs(member!.bar.axialForce), V: 0, M: 0 })
    expect(memberDisplacement(member!, 1).x).toBeCloseTo(load / (E * A), 13)
    expect(member!.fields).toBeUndefined()
  })

  it('mantiene el signo axial de pórtico y captura ambos lados de una fuerza interior', () => {
    const free = frame(beam(6, [FIX], nodal(10_000, 0)))
    expect(evaluateFrameSection(free, 2).N).toBeCloseTo(10_000, 7)
    const fixed = frame(beam(6, [FIX, { ...FIX, nodeId: 'N2' }], point(3, 12_000, 0)))
    const fields = buildFrameFields(fixed)
    expect(fields.marks.N.filter(mark => mark.kind === 'jump').map(({ section }) => section.side)).toEqual(['left', 'right'])
    expect(fields.intervals[0]!.end.N).toBeCloseTo(6000, 7)
    expect(fields.intervals[1]!.start.N).toBeCloseTo(-6000, 7)
    const distributed = buildFrameFields(frame(beam(4, [FIX, { ...FIX, nodeId: 'N2' }], line(0, 4, { x: 3000, y: 0 }))))
    const zero = distributed.marks.N.find(item => item.kind === 'zero')!.section
    expect(zero.s).toBeCloseTo(2, 11)
    expect(zero.N).toBeCloseTo(0, 8)
  })

  it('preserva el salto de cortante y la continuidad del momento de una carga central', () => {
    const structure = beam(6, [PIN, ROLL], point(3, 0, -12_000))
    const result = solve(structure)
    const diagram = buildDiagramModel(structure, result)
    const member = diagram.members[0]!
    const left = member.fields!.intervals[0]!.end
    const right = member.fields!.intervals[1]!.start
    expect(left.V).toBeCloseTo(6000, 7)
    expect(right.V).toBeCloseTo(-6000, 7)
    expect(left.M).toBeCloseTo(18_000, 7)
    expect(right.M).toBe(left.M)
    expect(diagram.maxima.M).toBeCloseTo(18_000, 7)
    const cut = diagramPoint(member, 3, 14, camera, viewport)
    expect(pickDiagram(diagram, ['V'], 1, cut, camera, viewport)).toMatchObject({ barId: 'B1', s: 3, side: 'right' })
    expect(pickDiagram(diagram, ['V'], 1, { x: 50, y: 50 }, camera, viewport)).toBeUndefined()
  })

  it.each([
    { L: 4, start: 0, end: 4, q0: -5000, q1: -5000, s: 2, M: 10_000 },
    { L: 6, start: 0, end: 6, q0: 0, q1: -6000, s: Math.sqrt(12), M: 4000 * Math.sqrt(12) },
    { L: 5, start: 1, end: 3, q0: -2000, q1: -2000, s: 2.2, M: 3840 },
  ])('localiza V=0 y el máximo interior de M con q₀=$q0 y tramo [$start,$end]', ({ L, start, end, q0, q1, s, M }) => {
    const fields = buildFrameFields(frame(beam(L, [PIN, ROLL], line(start, end, { x: 0, y: q0 }, { x: 0, y: q1 }))))
    expect(fields.stations).toEqual(expect.arrayContaining([0, start, end, L]))
    const zero = fields.marks.V.find(item => item.kind === 'zero')!.section
    const maximum = fields.marks.M.find(item => item.kind === 'critical')!.section
    expect(zero.s).toBeCloseTo(s, 11)
    expect(zero.V).toBeCloseTo(0, 8)
    expect(maximum.s).toBeCloseTo(s, 11)
    expect(maximum.M).toBeCloseTo(M, 7)
  })

  it('encuentra los extremos de N y V por las intensidades lineales y el cruce de M de un voladizo', () => {
    const fields = buildFrameFields(frame(beam(4, [FIX], line(0, 4, { x: -1000, y: -1000 }, { x: 1000, y: 1000 }))))
    expect(fields.marks.N.find(item => item.kind === 'critical')!.section).toMatchObject({ s: 2 })
    expect(fields.marks.N.find(item => item.kind === 'critical')!.section.N).toBeCloseTo(1000, 8)
    expect(fields.marks.V.find(item => item.kind === 'critical')!.section.V).toBeCloseTo(-1000, 8)
    const cantilever = buildFrameFields(frame(beam(3, [FIX], nodal(0, -8000, 12_000))))
    expect(cantilever.marks.M.find(item => item.kind === 'zero')!.section.s).toBeCloseTo(1.5, 11)
    expect(cantilever.intervals[0]!.start.M).toBeCloseTo(-12_000, 7)
    expect(cantilever.intervals.at(-1)!.end.M).toBeCloseTo(12_000, 7)
  })

  it('recupera el cambio de signo de momento en la columna del pórtico de referencia', () => {
    const structure = model([[0, 0], [0, 2], [2, 2], [2, 0]], [[1, 2], [2, 3], [4, 3]],
      [FIX, { ...FIX, nodeId: 'N4' }], [nodal(10_000, 0), nodal(10_000, 0, 0, 'N3', 'C2')])
    const f = buildFrameFields(frame(structure, 2e-5))
    expect(f.marks.M.find(item => item.kind === 'zero')!.section.s).toBeCloseTo(1.143591207536, 9)
    expect(f.intervals[0]!.start.M).toBeCloseTo(-11435.91207536, 5)
    expect(f.intervals.at(-1)!.end.M).toBeCloseTo(8564.08792464, 5)
  })
})

describe('Proyección física y deformada', () => {
  it('conserva el punto físico y el gráfico de M al invertir una barra inclinada', () => {
    const original = model([[0, 0], [3, 4]], [[1, 2]], [FIX], [point(2, 0, -5000)])
    const reverse = model([[0, 0], [3, 4]], [[2, 1]], [FIX], [point(3, 0, 5000)])
    const first = buildDiagramModel(original, solve(original))
    const second = buildDiagramModel(reverse, solve(reverse))
    const a = first.members[0]!, b = second.members[0]!
    if (a.bar.kind !== 'frame2d' || b.bar.kind !== 'frame2d') throw new Error('Falta el pórtico')
    const m = evaluateFrameSection(a.bar, 1).M
    const n = evaluateFrameSection(b.bar, 4).M
    expect(n).toBeCloseTo(-m, 7)
    const p = diagramPoint(a, 1, effortHeight('M', m, first.maxima.M, 1), camera, viewport)
    const q = diagramPoint(b, 4, effortHeight('M', n, second.maxima.M, 1), camera, viewport)
    expect(p.x).toBeCloseTo(q.x, 10)
    expect(p.y).toBeCloseTo(q.y, 10)
    const axis = diagramPoint(a, 1, 0, camera, viewport)
    const positive = diagramPoint(a, 1, 10, camera, viewport)
    expect(positive.x - axis.x).toBeCloseTo(-8)
    expect(positive.y - axis.y).toBeCloseTo(-6)
  })

  it('proyecta un polinomio cúbico mediante Bézier sin suavizarlo por muestreo grueso', () => {
    const f = (x: number) => 2 - 4 * x + 12 * x * x - 18 * x ** 3
    const [p, q] = bezierControls(f(0), f(1 / 3), f(2 / 3), f(1))
    const t = .27, w = 1 - t
    expect(w ** 3 * f(0) + 3 * w * w * t * p + 3 * w * t * t * q + t ** 3 * f(1)).toBeCloseTo(f(t), 12)
  })

  it('usa la deformada de sección del voladizo y la viga sin alterar coordenadas ni desplazamientos', () => {
    const structure = beam(3, [FIX], nodal(0, -8000))
    const result = solve(structure, 'frame2d', 1e-5)
    const saved = structuredClone(result)
    const plot = buildDiagramModel(structure, result)
    const member = plot.members[0]!
    const s = 1.5
    const expected = -8000 * s ** 2 * (9 - s) / (6 * E * 1e-5)
    expect(deformedPoint(member, s, 1).y).toBeCloseTo(expected, 13)
    expect(deformedPoint(member, s, 20).y).toBeCloseTo(20 * expected, 13)
    expect(deformedPoint(member, 0, 20)).toEqual({ x: 0, y: 0 })
    expect(deformedPoint(member, 3, 20).y).toBeCloseTo(-.72, 13)
    const supported = beam(6, [PIN, ROLL], point(3, 0, -12_000))
    const other = buildDiagramModel(supported, solve(supported))
    expect(memberDisplacement(other.members[0]!, 3).y).toBeCloseTo(-.03375, 13)
    expect(deformationFactor(other, null)).toBeCloseTo(.18 * 6 / .03375, 10)
    expect(deformationFactor(buildDiagramModel(structure, solve({ ...structure, loads: [] })), 123)).toBe(0)
    expect(result).toEqual(saved)
    expect(structure.nodes[1]).toMatchObject({ x: 3, y: 0 })
  })

  it('usa una referencia global por magnitud preservando la comparación entre barras', () => {
    const structure = model([[0, 0], [2, 0], [0, 3], [2, 3]], [[1, 2], [3, 4]],
      [PIN, ROLL, { ...PIN, nodeId: 'N3' }, { ...ROLL, nodeId: 'N4' }],
      [nodal(10_000, 0), nodal(-5000, 0, 0, 'N4', 'C2')])
    const data = buildDiagramModel(structure, solve(structure, 'truss2d'))
    expect(effortHeight('N', data.members[0]!.bar.axialForce, data.maxima.N, 1)).toBeCloseTo(54)
    expect(effortHeight('N', data.members[1]!.bar.axialForce, data.maxima.N, 1)).toBeCloseTo(-27)
  })

  it('desarrolla una cadena colineal por conectividad con orientación estable y coordenadas reversibles', () => {
    const structure = model([[0, 0], [2, 0], [4, 0], [6, 0]], [[1, 2], [3, 2], [3, 4]], [
      PIN, { ...ROLL, nodeId: 'N4' },
    ], [nodal(0, -8000)])
    const { members } = buildDiagramModel(structure, solve(structure))
    const steps = developedSpan(members[0]!, members)
    expect(developedSpan(members[1]!, members)).toEqual(steps)
    expect(steps.map(({ member, from, to, reversed }) => [member.id, from, to, reversed]))
      .toEqual([['B1', 0, 2, false], ['B2', 2, 4, true], ['B3', 4, 6, false]])
    expect(developedStation(steps[1]!, .5)).toBe(3.5)
    expect(localStation(steps[1]!, 3.5)).toBe(.5)
    expect(developedValue(steps[1]!, 'M', -5000)).toBe(5000)
    expect(developedValue(steps[1]!, 'V', -5000)).toBe(-5000)
  })

  it('mantiene una vista local en pórticos inclinados, conexiones ramificadas y extremos coincidentes de distinto ID', () => {
    const bent = model([[0, 0], [3, 4], [5, 4], [7, 4], [5, 6], [7, 4], [9, 4]],
      [[1, 2], [2, 3], [3, 4], [3, 5], [6, 7]], [FIX, { ...FIX, nodeId: 'N6' }], [nodal(0, -8000)])
    const { members } = buildDiagramModel(bent, solve(bent))
    for (const member of members) {
      expect(developedSpan(member, members).map(step => step.member.id)).toEqual([member.id])
    }
  })

  it('enlaza el salto de reacción de una viga con barra invertida y deja continuo el mismo nudo libre', () => {
    const loads = [point(1, 0, -6000), { ...point(1, 0, -6000), id: 'C2' }]
    const outer = [PIN, { ...ROLL, nodeId: 'N3' }]
    const structure = model([[0, 0], [2, 0], [4, 0]], [[1, 2], [3, 2]], [...outer, ROLL], loads)
    const result = solve(structure)
    const diagram = buildDiagramModel(structure, result)
    const [jump] = diagram.joints.V
    expect(diagram.joints.V).toHaveLength(1)
    expect(jump).toMatchObject({ nodeId: 'N2', S: 2, leftS: 2, rightS: 2, right: { reversed: true } })
    expect(jump!.after - jump!.before).toBeCloseTo(result.reactions.find(row => row.nodeId === 'N2')!.y, 8)
    expect(diagram.joints.M).toHaveLength(0)
    const member = diagram.members[0]!
    const path = effortCurve(member, 'V', value => value, (s, h) => ({ x: s, y: h }), diagram.maxima.V)!
    const jumpSegment = /C [^C]+ 1 (-?[\d.]+)\s+L 1 (-?[\d.]+)\s+C/.exec(path)
    expect(jumpSegment).not.toBeNull()
    expect(Number(jumpSegment![2]) - Number(jumpSegment![1])).toBeCloseTo(-12000, 8)
    const free = { ...structure, supports: outer, loads: [line(0, 2, { x: 0, y: -5000 })] }
    const continuous = buildDiagramModel(free, solve(free))
    expect(continuous.joints.V).toHaveLength(0)
    expect(continuous.joints.M).toHaveLength(0)
    expect(isEffortJump(1e8, 1e8 + 1e-6, 1e8)).toBe(false)
    expect(isEffortJump(1e8, 1e8 + .1, 1e8)).toBe(true)
  })

  it('no enlaza dos barras colineales con extremos coincidentes de distinto ID', () => {
    const structure = model([[0, 0], [2, 0], [2, 0], [4, 0]], [[1, 2], [3, 4]],
      [FIX, { ...FIX, nodeId: 'N4' }], [nodal(0, -1000), nodal(0, 3000, 0, 'N3', 'C2')])
    const diagram = buildDiagramModel(structure, solve(structure))
    expect(diagram.joints.V).toHaveLength(0)
  })
})
