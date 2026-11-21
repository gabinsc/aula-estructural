import { describe, expect, it } from 'vitest'
import { deleteLoad, distributedIntensity, globalLoadVector, saveLoad, toBaseUnits, toKiloUnits } from './load'
import type { LoadDefinition } from './load'
import { createBar, deleteSelection, EMPTY_STRUCTURE, moveNodes } from './structure'
import { editWithHistory, INITIAL_HISTORY } from '../modeler/tools/history'

const nodal: LoadDefinition = { kind: 'nodal', nodeId: 'N1', force: { x: -1200, y: 500 }, moment: -2500 }
const point: LoadDefinition = { kind: 'point', barId: 'B1', s: 4, frame: 'local', force: { x: 3000, y: -2000 } }
const distributed: LoadDefinition = {
  kind: 'distributed', barId: 'B1', s0: 2, s1: 8, frame: 'local', profile: 'linear',
  q0: { x: 1000, y: -4000 }, q1: { x: 2000, y: -8000 },
}

function fixture() {
  const result = createBar(EMPTY_STRUCTURE, { point: { x: 0, y: 0 } }, { point: { x: 10, y: 0 } })
  if ('error' in result) throw new Error(result.error)
  return result.model
}

function confirmed<T>(result: T | { readonly error: string }): T {
  if (typeof result === 'object' && result && 'error' in result) throw new Error(String(result.error))
  return result
}

describe('Cargas nodales', () => {
  it('convierte unidades con signo y conserva cargas múltiples con IDs independientes', () => {
    expect(toBaseUnits(-1.2)).toBe(-1200)
    expect(toKiloUnits(500)).toBe(0.5)
    expect(toBaseUnits(-2.5)).toBe(-2500)
    const first = confirmed(saveLoad(fixture(), nodal))
    const second = confirmed(saveLoad(first.model, { ...nodal, moment: 4000 }))
    expect(second.model.loads).toEqual([{ ...nodal, id: 'C1' }, { ...nodal, id: 'C2', moment: 4000 }])
    const repeated = confirmed(saveLoad(second.model, nodal, 'C1'))
    expect(repeated.model).toBe(second.model)
    expect(deleteLoad(second.model, 'C3')).toBe(second.model)
    expect(deleteLoad(second.model, 'C1').loads).toEqual([second.item])
  })

  it('rechaza referencias y magnitudes inválidas sin alterar el modelo', () => {
    const model = fixture()
    expect(saveLoad(model, { ...nodal, nodeId: 'N8' })).toHaveProperty('error')
    expect(saveLoad(model, { ...nodal, moment: Infinity })).toHaveProperty('error')
    expect(saveLoad(model, { ...nodal, force: { x: NaN, y: 0 } })).toHaveProperty('error')
    expect(saveLoad(model, nodal, 'C8')).toHaveProperty('error')
    expect(model.loads).toEqual([])
  })

  it('mueve y borra cargas por ID y restaura la conectividad mediante el historial', () => {
    const baseline = { ...INITIAL_HISTORY, editor: { ...INITIAL_HISTORY.editor, model: fixture() } }
    const added = editWithHistory(baseline, { type: 'save-load', definition: nodal })
    const moved = confirmed(moveNodes(added.editor.model, ['N1'], 'N1', { x: -2, y: 3 }))
    expect(moved.model.loads).toBe(added.editor.model.loads)
    expect(deleteSelection(moved.model, { kind: 'bar', id: 'B1' }).loads).toEqual(added.editor.model.loads)
    const selected = editWithHistory(added, { type: 'select', items: [{ kind: 'node', id: 'N1' }] })
    const deleted = editWithHistory(selected, { type: 'delete' })
    expect(deleted.editor.model.loads).toEqual([])
    expect(deleted.editor.model.bars).toEqual([])
    const restored = editWithHistory(deleted, { type: 'undo' })
    expect(restored.editor.model).toBe(added.editor.model)
    expect(editWithHistory(restored, { type: 'redo' }).editor.model).toBe(deleted.editor.model)
  })

  it('mantiene independientes las cargas de nudos que llegan al mismo punto', () => {
    const model = fixture()
    const extra = confirmed(createBar(model, { point: { x: 5, y: 0 } }, { point: { x: 5, y: 5 } })).model
    const a = confirmed(saveLoad(extra, nodal)).model
    const b = confirmed(saveLoad(a, { ...nodal, nodeId: 'N3' })).model
    const moved = confirmed(moveNodes(b, ['N3'], 'N3', { x: 0, y: 0 })).model
    expect(moved.loads).toBe(b.loads)
    expect(moved.bars).toBe(b.bars)
    expect(deleteSelection(moved, { kind: 'node', id: 'N1' }).loads).toMatchObject([{ id: 'C2', nodeId: 'N3' }])
  })
})

describe('Cargas puntuales sobre barras', () => {
  it('valida los extremos inclusivos, la posición interior y la barra de referencia', () => {
    const model = fixture()
    for (const s of [0, 4, 10]) expect(saveLoad(model, { ...point, s })).toHaveProperty('item.s', s)
    for (const s of [-0.1, 10.1, Infinity]) expect(saveLoad(model, { ...point, s })).toHaveProperty('error')
    expect(saveLoad(model, { ...point, barId: 'B8' })).toHaveProperty('error')
  })

  it('gira el vector local con la barra y conserva el vector global', () => {
    const angle = Math.PI / 2
    const local = globalLoadVector(point.force, 'local', angle)
    expect(local.x).toBeCloseTo(2000)
    expect(local.y).toBeCloseTo(3000)
    expect(globalLoadVector(point.force, 'global', angle)).toBe(point.force)
  })

  it('conserva s al acortar o girar y rechaza atómicamente un destino que deja la carga fuera', () => {
    const saved = confirmed(saveLoad(fixture(), point)).model
    const shortened = confirmed(moveNodes(saved, ['N2'], 'N2', { x: 6, y: 0 })).model
    expect(shortened.loads).toBe(saved.loads)
    const rotated = confirmed(moveNodes(shortened, ['N2'], 'N2', { x: 0, y: 6 })).model
    expect(rotated.loads).toBe(saved.loads)
    expect(moveNodes(rotated, ['N2'], 'N2', { x: 0, y: 3 })).toHaveProperty('error', expect.stringContaining('C1'))
    expect(rotated.nodes[1]).toMatchObject({ x: 0, y: 6 })
    expect(deleteSelection(rotated, { kind: 'bar', id: 'B1' }).loads).toEqual([])
    expect(deleteSelection(rotated, { kind: 'node', id: 'N2' }).loads).toEqual([])
  })
})

describe('Cargas distribuidas', () => {
  it('interpola perfiles uniformes, triangulares y trapezoidales en N/m', () => {
    const uniform = { ...distributed, profile: 'uniform', q1: distributed.q0 } as const
    const triangle = { ...distributed, q0: { x: 0, y: 0 } }
    expect(saveLoad(fixture(), uniform)).toHaveProperty('item.q1', uniform.q0)
    expect(saveLoad(fixture(), triangle)).toHaveProperty('item.profile', 'linear')
    expect(distributedIntensity(uniform, .25)).toEqual(uniform.q0)
    expect(distributedIntensity(triangle, .5)).toEqual({ x: 1000, y: -4000 })
    expect(distributedIntensity(distributed, .5)).toEqual({ x: 1500, y: -6000 })
    expect(distributedIntensity(distributed, 0)).toEqual(distributed.q0)
    expect(distributedIntensity(distributed, 1)).toEqual(distributed.q1)
    expect(toBaseUnits(-4)).toBe(distributed.q0.y)
    expect(toKiloUnits(distributed.q1.y)).toBe(-8)
  })

  it('valida intervalos, perfiles, extremos no finitos y referencias de barra', () => {
    const model = fixture()
    expect(saveLoad(model, { ...distributed, s0: 0, s1: 10 })).toHaveProperty('item.s1', 10)
    for (const [s0, s1] of [[-1, 2], [2, 2], [3, 2], [0, 10.01], [NaN, 3], [2, Infinity]] as const) {
      expect(saveLoad(model, { ...distributed, s0, s1 })).toHaveProperty('error', expect.stringContaining('intervalo'))
    }
    expect(saveLoad(model, { ...distributed, barId: 'B8' })).toHaveProperty('error')
    expect(saveLoad(model, { ...distributed, profile: 'uniform' })).toHaveProperty('error')
    expect(saveLoad(model, { ...distributed, q1: distributed.q0 })).toHaveProperty('error')
    expect(saveLoad(model, { ...distributed, q1: { x: 0, y: NaN } })).toHaveProperty('error')
  })

  it('conserva el intervalo físico y rechaza el traslado conjunto que lo dejaría fuera', () => {
    const model = confirmed(saveLoad(fixture(), distributed)).model
    const extra = confirmed(createBar(model, { point: { x: 10, y: 0 } }, { point: { x: 12, y: 4 } })).model
    const valid = confirmed(moveNodes(extra, ['N2', 'N3'], 'N2', { x: 8, y: 0 })).model
    expect(valid.loads).toBe(extra.loads)
    expect(moveNodes(valid, ['N2', 'N3'], 'N2', { x: 7.5, y: 0 })).toHaveProperty('error', expect.stringContaining('C1'))
    expect(valid.nodes[2]).toMatchObject({ x: 10, y: 4 })
    const lengthened = confirmed(moveNodes(valid, ['N2', 'N3'], 'N2', { x: 15, y: 0 })).model
    expect(lengthened.loads).toMatchObject([{ s0: 2, s1: 8 }])
  })

  it('restaura intensidad, sistema e intervalo, e invalida Redo solo tras una edición efectiva', () => {
    const baseline = { ...INITIAL_HISTORY, editor: { ...INITIAL_HISTORY.editor, model: fixture() } }
    const created = editWithHistory(baseline, { type: 'save-load', definition: distributed })
    const modified = editWithHistory(created, {
      type: 'save-load', id: 'C1', definition: { ...distributed, frame: 'global', s1: 9, q0: { x: -1000, y: 4000 } },
    })
    const removed = editWithHistory(modified, { type: 'delete-load', id: 'C1' })
    expect(removed.editor.model.loads).toEqual([])
    const undoRemoval = editWithHistory(removed, { type: 'undo' })
    const undoEdit = editWithHistory(undoRemoval, { type: 'undo' })
    const undoCreation = editWithHistory(undoEdit, { type: 'undo' })
    expect(undoRemoval.editor.model).toBe(modified.editor.model)
    expect(undoEdit.editor.model).toBe(created.editor.model)
    expect(undoCreation.editor.model).toBe(baseline.editor.model)
    expect(editWithHistory(undoCreation, { type: 'redo' }).editor.model).toBe(created.editor.model)
    expect(editWithHistory(undoEdit, { type: 'redo' }).editor.model).toBe(modified.editor.model)
    expect(editWithHistory(undoRemoval, { type: 'redo' }).editor.model).toBe(removed.editor.model)
    const repeated = editWithHistory(undoEdit, { type: 'save-load', id: 'C1', definition: distributed })
    const invalid = editWithHistory(repeated, { type: 'save-load', id: 'C1', definition: { ...distributed, s1: 11 } })
    expect(invalid.editor.model).toBe(created.editor.model)
    expect(invalid.past).toBe(undoEdit.past)
    expect(invalid.future).toBe(undoEdit.future)
    const branched = editWithHistory(invalid, { type: 'save-load', id: 'C1', definition: { ...distributed, s1: 7 } })
    expect(branched.future).toEqual([])
    expect(branched.editor.model.loads).toMatchObject([{ id: 'C1', s1: 7 }])
  })
})

it('borra juntos una carga y la selección geométrica sin duplicar efectos ni registrar vistas previas', () => {
  const baseline = { ...INITIAL_HISTORY, editor: { ...INITIAL_HISTORY.editor, model: fixture() } }
  const draft = editWithHistory(baseline, { type: 'preview-load', definition: point })
  expect(draft.past).toBe(baseline.past)
  expect(draft.editor.model).toBe(baseline.editor.model)
  const a = editWithHistory(draft, { type: 'save-load', definition: point })
  const b = editWithHistory(a, { type: 'save-load', definition: nodal })
  const selected = editWithHistory(b, { type: 'select', items: [{ kind: 'load', id: 'C1' }, { kind: 'node', id: 'N1' }] })
  expect(selected.editor.selection).toHaveLength(2)
  expect(selected.editor.loadDraft).toBeNull()
  const deleted = editWithHistory(selected, { type: 'delete' })
  expect(deleted.past).toHaveLength(b.past.length + 1)
  expect(deleted.editor.model.loads).toHaveLength(0)
  expect(deleted.editor.model.nodes).toHaveLength(1)
  const restored = editWithHistory(deleted, { type: 'undo' })
  expect(restored.editor.model).toBe(b.editor.model)
  expect(editWithHistory(restored, { type: 'redo' }).editor.model).toBe(deleted.editor.model)
})
