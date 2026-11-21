import { expect, it } from 'vitest'
import { solveAnalysis } from '../analysis'
import { analysisRevision, makeAnalysisRequest, ALL_LOADS } from '../projects/analysisInput'
import { buildDiagramModel, effortCurve } from '../modeler/results/diagramModel'
import { editWithHistory, INITIAL_HISTORY } from '../modeler/tools/history'
import { catalogOf, DEFAULT_LIBRARY, editLibrary, materialIssue, makeSection } from './library'
import { createBar, EMPTY_STRUCTURE } from './structure'
import type { Edit, Structure } from './structure'
import { editMechanicalValues } from './mechanics'
import { copyEntities, pasteGeometry } from './clipboard'
import { reverseBar, splitBar } from './barEdition'

function confirmed<T>(result: Edit<T>) {
  if ('error' in result) throw new Error(result.error)
  return result.model
}

const shape = { kind: 'rectangle', dimensions: { b: .2, h: .4 } } as const
const section = makeSection('recta', 'Rectangular', shape)

function specimen() {
  const created = confirmed(createBar(EMPTY_STRUCTURE, { point: { x: 0, y: 0 } }, { point: { x: 4, y: 0 } }))
  const loaded: Structure = { ...created, supports: [{ kind: 'fixed', nodeId: 'N1' }],
    loads: [{ id: 'C1', kind: 'nodal', nodeId: 'N2', force: { x: 0, y: -12000 }, moment: 0 }], nextLoad: 2 }
  return confirmed(editMechanicalValues(loaded, ['B1'], { kind: 'frame2d', E: 200e9, A: section.values.A, I: section.values.Iyy }))
}

it('valida materiales, crea y duplica entradas y protege los predeterminados en uso', () => {
  const acero = DEFAULT_LIBRARY.materials[0]!
  expect(DEFAULT_LIBRARY.materials).toHaveLength(4)
  for (const fields of [{ E: 0 }, { nu: -.99, density: 0 }, { nu: .5 }, { E: Infinity }, { density: NaN }]) {
    expect(materialIssue({ ...acero, ...fields })).toBeTruthy()
  }
  expect(materialIssue({ ...acero, nu: -.99 })).toBeUndefined()
  const added = confirmed(editLibrary(EMPTY_STRUCTURE, { type: 'save-material', material: { ...acero, id: 'copia' }, updateLinked: false }))
  const defaulted = confirmed(editLibrary(added, { type: 'default', category: 'material', id: 'copia' }))
  expect(catalogOf(defaulted).defaultMaterialId).toBe('copia')
  expect(editLibrary(defaulted, { type: 'delete', category: 'material', id: 'copia' })).toHaveProperty('error')
  const cleared = confirmed(editLibrary(defaulted, { type: 'default', category: 'material' }))
  expect(catalogOf(confirmed(editLibrary(cleared, { type: 'delete', category: 'material', id: 'copia' }))).materials).toHaveLength(4)
})

it('asigna un eje explícito, protege vínculos, respeta edición manual y restaura lote con historial', () => {
  const base = specimen()
  const withSection = confirmed(editLibrary(base, { type: 'save-section', id: section.id, name: section.name, geometry: shape, updateLinked: false }))
  expect(editLibrary(withSection, { type: 'assign', barIds: ['B1'], sectionId: section.id })).toHaveProperty('error')
  const history = { ...INITIAL_HISTORY, editor: { ...INITIAL_HISTORY.editor, model: withSection } }
  const assigned = editWithHistory(history, { type: 'library', change: { type: 'assign', barIds: ['B1'],
    materialId: 'acero', sectionId: section.id, axis: 'y' } })
  const model = assigned.editor.model
  expect(model.mechanics.assignments[0]).toMatchObject({ materialId: 'acero', sectionId: 'recta', sectionAxis: 'y', I: section.values.Iyy })
  expect(editLibrary(model, { type: 'delete', category: 'section', id: section.id })).toHaveProperty('error')
  const change = { type: 'save-section', id: section.id, name: section.name, geometry: { ...shape, dimensions: { b: .3, h: .4 } } } as const
  expect(editLibrary(model, { ...change, updateLinked: false })).toHaveProperty('error')
  const updated = confirmed(editLibrary(model, { ...change, updateLinked: true }))
  expect(updated.mechanics.assignments[0]!.I).toBeCloseTo(.4 * .3 ** 3 / 12, 12)
  const manual = confirmed(editMechanicalValues(updated, ['B1'], { E: 210e9 }))
  expect(manual.mechanics.assignments[0]).not.toHaveProperty('materialId')
  expect(manual.mechanics.assignments[0]).toHaveProperty('sectionId', 'recta')
  expect(editWithHistory(assigned, { type: 'undo' }).editor.model).toBe(withSection)
  expect(editWithHistory(editWithHistory(assigned, { type: 'undo' }), { type: 'redo' }).editor.model).toBe(model)
})

it('conserva referencias al copiar, dividir e invertir y rechaza pegado con una biblioteca incompatible', () => {
  const saved = confirmed(editLibrary(specimen(), { type: 'save-section', id: section.id, name: section.name, geometry: shape, updateLinked: false }))
  const assigned = confirmed(editLibrary(saved, { type: 'assign', barIds: ['B1'], materialId: 'acero', sectionId: section.id, axis: 'x' }))
  const copied = copyEntities(assigned, [{ kind: 'bar', id: 'B1' }])
  if ('error' in copied || copied.kind !== 'geometry') throw new Error('Se esperaba una barra copiada')
  const pasted = confirmed(pasteGeometry(assigned, copied, { x: 0, y: 3 }))
  const divided = confirmed(splitBar(pasted, 'B1', 2))
  expect(divided.mechanics.assignments.map(item => item.barId)).toEqual(['B3', 'B4', 'B2'])
  expect(divided.mechanics.assignments.every(item => item.materialId === 'acero' && item.sectionId === section.id)).toBe(true)
  expect(confirmed(reverseBar(divided, 'B3')).mechanics).toBe(divided.mechanics)
  expect(pasteGeometry(specimen(), copied, { x: 0, y: 3 })).toHaveProperty('error')
})

it('la asignación equivalente reproduce desplazamientos, reacciones, esfuerzos y AVM', () => {
  const manual = specimen()
  const saved = confirmed(editLibrary(manual, { type: 'save-section', id: section.id, name: section.name, geometry: shape, updateLinked: false }))
  const linked = confirmed(editLibrary(saved, { type: 'assign', barIds: ['B1'], materialId: 'acero', sectionId: section.id, axis: 'y' }))
  const solve = (model: Structure) => {
    const request = makeAnalysisRequest(model, ALL_LOADS, analysisRevision(model, ALL_LOADS))
    if (request.status !== 'ready') throw new Error(JSON.stringify(request.diagnostics))
    const result = solveAnalysis(request.input)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    const diagram = buildDiagramModel(model, result)
    return { displacements: result.displacements, reactions: result.reactions, bars: result.bars,
      M: effortCurve(diagram.members[0]!, 'M', x => x, (x, y) => ({ x, y }), diagram.maxima.M) }
  }
  expect(solve(linked)).toEqual(solve(manual))
  expect(analysisRevision(linked, ALL_LOADS)).not.toBe(analysisRevision(manual, ALL_LOADS))
  const renamed = confirmed(editLibrary(linked, { type: 'save-section', id: section.id, name: 'Otro nombre', geometry: shape, updateLinked: false }))
  expect(analysisRevision(renamed, ALL_LOADS)).toBe(analysisRevision(linked, ALL_LOADS))
  const steel = catalogOf(renamed).materials[0]!
  const material = { ...steel, E: 210e9, density: 8000 }
  expect(editLibrary(renamed, { type: 'save-material', material, updateLinked: false })).toHaveProperty('error')
  const updated = confirmed(editLibrary(renamed, { type: 'save-material', material, updateLinked: true }))
  expect(updated.mechanics.assignments[0]!.E).toBe(210e9)
  expect(analysisRevision(updated, ALL_LOADS)).not.toBe(analysisRevision(renamed, ALL_LOADS))
  expect(updated.loads).toBe(renamed.loads)
})
