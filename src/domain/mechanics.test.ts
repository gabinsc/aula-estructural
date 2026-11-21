import { describe, expect, it } from 'vitest'
import { editMechanicalValues, fromMechanicalDisplay, toMechanicalDisplay } from './mechanics'
import { createBar, EMPTY_STRUCTURE } from './structure'
import type { Edit } from './structure'
import { editWithHistory, INITIAL_HISTORY } from '../modeler/tools/history'
import type { WorkspaceAction } from '../modeler/tools/history'

const assignment = { kind: 'frame2d', E: 200e9, A: .02, I: 8e-6 } as const
function model<T>(edit: Edit<T>) {
  if ('error' in edit) throw new Error(edit.error)
  return edit.model
}

function jointBars() {
  return model(createBar(model(createBar(EMPTY_STRUCTURE, { point: { x: 0, y: 0 } }, { point: { x: 6, y: 0 } })),
    { point: { x: 6, y: 0 } }, { point: { x: 8, y: 1 } }))
}

describe('Propiedades mecánicas e historial', () => {
  it('convierte GPa, cm² y cm⁴ a SI y de vuelta dentro de la precisión de Float64', () => {
    for (const [field, display, si] of [['E', 200, 2e11], ['A', 200, .02], ['I', 800, 8e-6]] as const) {
      const actual = fromMechanicalDisplay(field, display)
      expect(Math.abs(actual - si) / si).toBeLessThanOrEqual(Number.EPSILON)
      expect(Math.abs(toMechanicalDisplay(field, actual) - display) / display).toBeLessThanOrEqual(Number.EPSILON)
    }
  })

  it('admite pendientes, conserva diferencias sin editar y aplica el lote atómicamente', () => {
    const base = jointBars()
    const first = model(editMechanicalValues(base, ['B1'], assignment))
    const second = model(editMechanicalValues(first, ['B2'], { kind: 'truss2d', A: .01 }))
    expect(second.mechanics.assignments[1]).toEqual({ barId: 'B2', kind: 'truss2d', A: .01 })
    const wrong = editMechanicalValues(second, ['B1', 'B2'], { I: 1 })
    expect(wrong).toHaveProperty('error')
    expect(second.mechanics.assignments[0]!.I).toBe(8e-6)
    const changed = model(editMechanicalValues(second, ['B1', 'B2'], { E: 210e9 }))
    expect(changed.mechanics.assignments).toEqual([
      { ...assignment, barId: 'B1', E: 210e9 }, { barId: 'B2', kind: 'truss2d', A: .01, E: 210e9 },
    ])
    const truss = model(editMechanicalValues(changed, ['B1'], { kind: 'truss2d' }))
    expect(truss.mechanics.assignments[0]).toEqual({ barId: 'B1', kind: 'truss2d', E: 210e9, A: .02 })
    expect(editMechanicalValues(truss, ['B1', 'B999'], { A: .1 })).toHaveProperty('error')
  })

  it('registra exactamente una transacción por asignación, copia, división, inversión y borrado', () => {
    const start = { ...INITIAL_HISTORY, editor: { ...INITIAL_HISTORY.editor, model: jointBars() } }
    function step(state: typeof start, action: WorkspaceAction) {
      const next = editWithHistory(state, action)
      expect(next.past.length).toBe(state.past.length + 1)
      const undone = editWithHistory(next, { type: 'undo' })
      expect(undone.editor.model).toBe(state.editor.model)
      expect(editWithHistory(undone, { type: 'redo' }).editor.model).toBe(next.editor.model)
      return next
    }
    const assigned = step(start, { type: 'mechanics', barIds: ['B1', 'B2'], patch: assignment })
    for (const patch of [{ A: -1 }, { A: Infinity }, { E: 200e9 }]) {
      const rejected = editWithHistory(assigned, { type: 'mechanics', barIds: ['B1', 'B2'], patch })
      expect(rejected.past).toBe(assigned.past)
      expect(rejected.editor.model).toBe(assigned.editor.model)
    }
    const copied = editWithHistory(assigned, { type: 'copy', items: [{ kind: 'bar', id: 'B1' }] })
    const pasting = editWithHistory(copied, { type: 'paste-start' })
    expect(editWithHistory(pasting, { type: 'cancel' }).editor.model).toBe(assigned.editor.model)
    const pasted = step(pasting, { type: 'point', end: { point: { x: 0, y: 8 } } })
    expect(pasted.editor.model.mechanics.assignments).toContainEqual({ ...assignment, barId: 'B3' })
    const divided = step(pasted, { type: 'split-bar', barId: 'B1', s: 3 })
    const assignments = divided.editor.model.mechanics.assignments
    expect(assignments).toEqual(['B4', 'B5', 'B2', 'B3'].map(barId => ({ ...assignment, barId })))
    const reversed = step(divided, { type: 'reverse-bar', barId: 'B4' })
    expect(reversed.editor.model.mechanics.assignments).toBe(assignments)
    const removed = step(reversed, { type: 'delete', items: [{ kind: 'bar', id: 'B4' }] })
    const cleared = step(removed, { type: 'mechanics', barIds: ['B5'], patch: null })
    expect(cleared.editor.model.mechanics.assignments.map(item => item.barId)).toEqual(['B2', 'B3'])
  })
})
