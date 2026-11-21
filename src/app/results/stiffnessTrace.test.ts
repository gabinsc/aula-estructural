import { expect, it } from 'vitest'
import { solveAnalysis } from '../../analysis'
import { EMPTY_STRUCTURE } from '../../domain/structure'
import type { StructuralLoad } from '../../domain/load'
import type { Structure } from '../../domain/structure'
import { forceTerms, stiffnessTerms, stiffnessUnit } from './stiffnessTrace'

const E = 200e9, A = .02, I = 8e-6
const frames = [{ barId: 'B1', kind: 'frame2d', E, A, I }, { barId: 'B2', kind: 'frame2d', E, A, I }] as const
const point: StructuralLoad = { id: 'C1', kind: 'point', frame: 'local', s: 1, barId: 'B2', force: { x: 0, y: -12000 } }
const nodal: StructuralLoad = { id: 'C2', kind: 'nodal', nodeId: 'N2', force: { x: 0, y: -1000 }, moment: 0 }
const model: Structure = { ...EMPTY_STRUCTURE, nodes: [0, 2, 4].map((x, i) => ({ id: `N${i + 1}`, label: `N${i + 1}`, x, y: 0 })),
  bars: frames.map(({ barId }, i) => ({ id: barId, label: barId, startId: `N${i + 1}`, endId: `N${i + 2}` })),
  supports: [{ kind: 'fixed', nodeId: 'N1' }, { kind: 'roller', nodeId: 'N3', surfaceAngle: Math.PI / 4 }],
  loads: [point, nodal],
}
function solve(shape = model) {
  const result = solveAnalysis({ model: shape, definition: { version: 1, assignments: frames }, loadCase: { id: 'referencia' }, includeTrace: true })
  if (!result.ok || !result.trace) throw new Error(JSON.stringify(result.diagnostics))
  return { result, trace: result.trace }
}

it('expone dos aportes de rigidez al mismo giro y reproduce K con unidades conjugadas', () => {
  const { result, trace } = solve()
  const r = result.dofs.find(dof => dof.nodeId === 'N2' && dof.axis === 'rz')!
  const entry = stiffnessTerms(trace, r.index, r.index)
  expect(entry.terms.map(item => item.barId)).toEqual(['B1', 'B2'])
  expect(entry.terms[0]!.value).toBeCloseTo(4 * E * I / 2, 7)
  expect(entry.terms[1]!.value).toBeCloseTo(4 * E * I / 2, 7)
  expect(entry).toMatchObject({ sum: 6400000, assembled: 6400000, agrees: true })
  expect(stiffnessUnit('rz', 'rz')).toBe('N·m/rad')
  expect(stiffnessUnit('uy', 'rz')).toBe('N/rad')
})

it('entrega acción equivalente exacta, transformación, apoyo inclinado y desplazamientos recuperados', () => {
  const { result, trace } = solve()
  const n2y = result.dofs.find(dof => dof.nodeId === 'N2' && dof.axis === 'uy')!
  const b2 = trace.elements[1]!
  expect(b2).toMatchObject({ startId: 'N2', endId: 'N3', E, A, I, length: 2, unit: { x: 1, y: 0 } })
  expect(b2.equivalentLoads).toMatchObject([{ loadId: 'C1', local: [0, -6000, -3000, 0, -6000, 3000] }])
  expect(forceTerms(trace, result, n2y)).toEqual({ nodal: [{ id: 'C2', value: -1000 }],
    equivalent: [{ id: 'B2', value: -6000 }], total: -7000 })
  const support = trace.supports[1]!
  expect(support.normal!.x).toBeCloseTo(-Math.SQRT1_2, 14)
  expect(support.normal!.y).toBeCloseTo(Math.SQRT1_2, 14)
  expect(support.tangent!.x).toBeCloseTo(Math.SQRT1_2, 14)
  expect(support.tangent!.y).toBeCloseTo(Math.SQRT1_2, 14)
  expect(trace.u[n2y.index]).toEqual(result.displacements[1]!.y)
  const component = trace.components[0]!
  expect(component.Kr.length).toBe(component.reducedDofs.length ** 2)
  for (const [i, load] of component.Fr.entries()) {
    const recovered = component.z.reduce((sum, z, j) => sum + component.Kr[i * component.z.length + j]! * z, 0)
    expect(Math.abs(recovered - load)).toBeLessThan(1e-6)
  }
  expect(trace.R[0]).toEqual(result.reactions[0]!.x)
  const rotated = solve({ ...model, nodes: model.nodes.map(node => ({ ...node, y: node.x * .75 })) }).trace
  expect(rotated.elements[0]!.T[0]).toBeCloseTo(.8, 13)
  expect(rotated.elements[0]!.T[1]).toBeCloseTo(.6, 13)
})
