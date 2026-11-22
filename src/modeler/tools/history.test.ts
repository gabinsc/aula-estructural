import { describe, expect, it } from 'vitest'
import { getNodeSupport } from '../../domain/support'
import { editWithHistory, HISTORY_LIMIT, INITIAL_HISTORY } from './history'
import type { WorkspaceAction } from './history'

const go = (...actions: WorkspaceAction[]) => actions.reduce(editWithHistory, INITIAL_HISTORY)
const barStart = { type: 'tool', tool: 'bar' } as const
const start = { type: 'point', end: { point: { x: 1, y: 0 } } } as const
const end = { type: 'point', end: { point: { x: 4, y: 0 } } } as const

describe('Subtipos de herramientas', () => {
  const node = { kind: 'node', id: 'N1' } as const
  const bar = { kind: 'bar', id: 'B1' } as const

  it.each([
    [{ type: 'support-preset', preset: 'pinned' }, 'support', node, bar],
    [{ type: 'support-preset', preset: 'roller' }, 'support', node, bar],
    [{ type: 'support-preset', preset: 'fixed' }, 'support', node, bar],
    [{ type: 'load-preset', preset: 'nodal' }, 'load', node, bar],
    [{ type: 'load-preset', preset: 'moment' }, 'load', node, bar],
    [{ type: 'load-preset', preset: 'point' }, 'load', bar, node],
    [{ type: 'load-preset', preset: 'uniform' }, 'load', bar, node],
    [{ type: 'load-preset', preset: 'linear' }, 'load', bar, node],
  ] as const)('activa %o con el propietario correcto y sin crear historial', (action, tool, valid, invalid) => {
    const selected = go(barStart, start, end, { type: 'select', items: [valid] })
    const activated = editWithHistory(selected, action)
    expect(activated.editor.interaction).toEqual({ tool, preset: action.preset })
    expect(activated.editor.selection).toEqual([valid])
    expect(activated.editor.model).toBe(selected.editor.model)
    expect(activated.past).toBe(selected.past)
    const wrong = editWithHistory(selected, { type: 'select', items: [invalid] })
    expect(editWithHistory(wrong, action).editor.selection).toEqual([])
    const cancelled = editWithHistory(activated, { type: 'cancel' })
    expect(cancelled.editor.interaction).toEqual({ tool: 'select' })
    expect(cancelled.past).toBe(selected.past)
  })
})

describe('Historial de ediciones estructurales', () => {
  it('inserta una rótula como cambio único, conserva los extremos externos y los invierte con sus barras', () => {
    const baseline = go(barStart, start, end, { type: 'mechanics', barIds: ['B1'], patch: { kind: 'frame2d' } },
      { type: 'moment-releases', barId: 'B1', releaseI: true, releaseJ: false })
    const active = editWithHistory(baseline, { type: 'split-start', barId: 'B1', hinge: true })
    expect(active.past).toBe(baseline.past)
    const cut = editWithHistory(active, { type: 'split-bar', barId: 'B1', s: 1.5 })
    const [first, second] = cut.editor.model.bars
    expect(first).toMatchObject({ releaseI: true, releaseJ: true, endId: second?.startId })
    expect(second).toMatchObject({ releaseI: true })
    expect(second?.releaseJ).toBeUndefined()
    expect(cut.past.length).toBe(baseline.past.length + 1)
    const undo = editWithHistory(cut, { type: 'undo' })
    expect(undo.editor.model).toBe(baseline.editor.model)
    expect(editWithHistory(undo, { type: 'redo' }).editor.model).toBe(cut.editor.model)
    const inverted = editWithHistory(cut, { type: 'reverse-bar', barId: second!.id })
    expect(inverted.editor.model.bars[1]).toMatchObject({ startId: second!.endId, releaseJ: true })
    expect(inverted.editor.model.bars[1]?.releaseI).toBeUndefined()
    const rigidCut = editWithHistory(baseline, { type: 'split-bar', barId: 'B1', s: 1.5 })
    expect(rigidCut.editor.model.bars[0]?.releaseJ).toBeUndefined()
    expect(rigidCut.editor.model.bars[1]?.releaseI).toBeUndefined()
  })
  it('deshace y rehace el pegado, la división y la inversión como transacciones completas', () => {
    const baseline = go(barStart, start, end, { type: 'copy' }, { type: 'paste-start' })
    const pasted = editWithHistory(baseline, { type: 'coordinates', mode: 'relative', first: 2, second: 3 })
    const divided = editWithHistory(pasted, { type: 'split-bar', barId: 'B2', s: 1.5 })
    const reversed = editWithHistory(divided, { type: 'reverse-bar', barId: 'B3' })
    expect([baseline, pasted, divided, reversed].map(state => state.past.length)).toEqual([1, 2, 3, 4])
    expect(reversed.editor.model.bars.find(bar => bar.id === 'B3')).toMatchObject({ startId: 'N5', endId: 'N3' })
    let state = reversed
    for (const expected of [divided, pasted, baseline]) {
      state = editWithHistory(state, { type: 'undo' })
      expect(state.editor.model).toBe(expected.editor.model)
    }
    for (const expected of [pasted, divided, reversed]) {
      state = editWithHistory(state, { type: 'redo' })
      expect(state.editor.model).toBe(expected.editor.model)
    }
  })
  it('registra una barra y sus nudos en una sola edición y recupera los mismos IDs', () => {
    const pending = go(barStart, start)
    expect(pending.past).toHaveLength(0)
    const created = editWithHistory(pending, end)
    expect(created.past).toHaveLength(1)
    const undone = editWithHistory(created, { type: 'undo' })
    expect(undone.editor.model).toBe(INITIAL_HISTORY.editor.model)
    expect(undone.editor.selection).toEqual([])
    expect(undone.editor.interaction).toEqual({ tool: 'select' })
    expect(editWithHistory(undone, { type: 'redo' }).editor.model).toBe(created.editor.model)
  })

  it('recupera nudos eliminados junto con todas sus barras y cancela referencias en curso', () => {
    const created = go(barStart, start, end)
    const removed = [{ kind: 'node', id: 'N1' }] as const
    const selected = editWithHistory(created, { type: 'select', items: removed })
    const deleted = editWithHistory(selected, { type: 'delete' })
    expect(deleted.editor.model.bars).toHaveLength(0)
    const pending = editWithHistory(deleted, start)
    const restored = editWithHistory(pending, { type: 'undo' })
    expect(restored.editor.interaction).toEqual({ tool: 'select' })
    expect(restored.editor.model).toBe(created.editor.model)
    expect(editWithHistory(restored, { type: 'redo' }).editor.model).toBe(deleted.editor.model)
  })

  it('registra movimiento y etiquetas en bloque y conserva el futuro ante ajustes y ediciones sin cambios', () => {
    const items = [{ kind: 'node', id: 'N1' }, { kind: 'node', id: 'N2' }] as const
    const renamed = go(barStart, start, end, { type: 'select', items }, { type: 'selection-label', label: 'Eje' })
    const moving = editWithHistory(renamed, { type: 'tool', tool: 'move' })
    const moved = editWithHistory(moving, { type: 'point', end: { point: { x: 2, y: 1 } } })
    expect(moved.past).toHaveLength(3)
    expect(moved.editor.model.nodes.map(({ x, y }) => [x, y])).toEqual([[2, 1], [5, 1]])
    const back = editWithHistory(moved, { type: 'undo' })
    expect(back.editor.model).toBe(renamed.editor.model)
    const configured = editWithHistory(back, { type: 'toggle-snap', system: 'grid' })
    const repeatedLabel = editWithHistory(configured, { type: 'selection-label', label: 'Eje' })
    expect(repeatedLabel.future).toBe(back.future)
    const invalid = editWithHistory(repeatedLabel, { type: 'selection-label', label: ' ' })
    expect(invalid.future).toBe(back.future)
    const forward = editWithHistory(invalid, { type: 'redo' })
    expect(forward.editor.model).toBe(moved.editor.model)
    expect(forward.editor.snap).toBe(configured.editor.snap)
  })

  it('acota el historial y descarta el futuro solo al confirmar una edición nueva', () => {
    let history = go({ type: 'tool', tool: 'node' })
    for (let x = 0; x <= HISTORY_LIMIT; x++) {
      history = editWithHistory(history, { type: 'point', end: { point: { x, y: 0 } } })
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT)
    const undone = editWithHistory(history, { type: 'undo' })
    expect(undone.future).toHaveLength(1)
    const drawing = editWithHistory(undone, { type: 'tool', tool: 'node' })
    const changed = editWithHistory(drawing, { type: 'point', end: { point: { x: 0, y: 1 } } })
    expect(changed.future).toHaveLength(0)
    expect(editWithHistory(changed, { type: 'redo' })).toBe(changed)
  })

  it('conserva el historial ante borrados sin efecto y rechazos de geometría', () => {
    const created = go(barStart, start, end)
    const stale = editWithHistory(created, { type: 'select', items: [{ kind: 'node', id: 'N99' }] })
    const noChange = editWithHistory(stale, { type: 'delete' })
    expect(noChange.editor.model).toBe(created.editor.model)
    expect(noChange.past).toBe(created.past)
    const moving = editWithHistory(noChange, { type: 'move-start', nodeId: 'N1' })
    const invalid = editWithHistory(moving, { type: 'coordinates', mode: 'global', first: 4, second: 0 })
    expect(invalid.editor.error).toContain('sin longitud válida')
    expect(invalid.editor.model).toBe(created.editor.model)
    expect(invalid.past).toBe(created.past)
  })

  it('deshace y rehace la creación numérica de un nudo con el mismo ID', () => {
    const created = go({ type: 'tool', tool: 'node' }, { type: 'coordinates', mode: 'global', first: 2.75, second: -1.25 })
    const undone = editWithHistory(created, { type: 'undo' })
    expect(undone.editor.model.nodes).toEqual([])
    expect(editWithHistory(undone, { type: 'redo' }).editor.model.nodes).toEqual([
      { id: 'N1', label: 'N1', x: 2.75, y: -1.25 },
    ])
  })

  it('registra cada cambio de apoyo y restaura el borrado de nudo y barra como una sola transacción', () => {
    const nodeId = 'N1'
    const angle = Math.PI / 6
    const bar = go(barStart, start, end)
    const added = editWithHistory(bar, { type: 'support', nodeId, definition: { kind: 'pinned' }, expected: undefined })
    const pinned = getNodeSupport(added.editor.model, nodeId)
    const changed = editWithHistory(added, { type: 'support', nodeId, definition: { kind: 'roller', surfaceAngle: angle }, expected: pinned })
    const roller = getNodeSupport(changed.editor.model, nodeId)
    const rotated = editWithHistory(changed, { type: 'support', nodeId, definition: { kind: 'roller', surfaceAngle: -angle }, expected: roller })
    const turned = getNodeSupport(rotated.editor.model, nodeId)
    const removed = editWithHistory(rotated, { type: 'support', nodeId, definition: null, expected: turned })
    expect(removed.past).toHaveLength(5)
    expect(removed.editor.model.supports).toEqual([])
    let restored = removed
    for (const step of [rotated, changed, added, bar]) {
      restored = editWithHistory(restored, { type: 'undo' })
      expect(restored.editor.model).toBe(step.editor.model)
    }
    for (const step of [added, changed, rotated, removed]) {
      restored = editWithHistory(restored, { type: 'redo' })
      expect(restored.editor.model).toBe(step.editor.model)
    }
    const withRoller = editWithHistory(restored, { type: 'undo' })
    const selected = editWithHistory(withRoller, { type: 'select', items: [{ kind: 'node', id: nodeId }] })
    const deleted = editWithHistory(selected, { type: 'delete' })
    expect(deleted.editor.model.supports).toEqual([])
    expect(deleted.editor.model.bars).toEqual([])
    expect(editWithHistory(deleted, { type: 'undo' }).editor.model).toBe(rotated.editor.model)
  })

  it('conserva Redo al introducir una inclinación equivalente o inválida', () => {
    const nodeId = 'N1'
    const created = go(barStart, start, end, {
      type: 'support', nodeId, definition: { kind: 'roller', surfaceAngle: -25 * Math.PI / 180 }, expected: undefined,
    })
    const expected = getNodeSupport(created.editor.model, nodeId)
    const removed = editWithHistory(created, { type: 'support', nodeId, definition: null, expected })
    const restored = editWithHistory(removed, { type: 'undo' })
    for (const surfaceAngle of [335 * Math.PI / 180, Infinity]) {
      const attempted = editWithHistory(restored, { type: 'support', nodeId, definition: { kind: 'roller', surfaceAngle }, expected })
      expect(attempted.editor.model).toBe(restored.editor.model)
      expect(attempted.past).toBe(restored.past)
      expect(attempted.future).toBe(restored.future)
    }
    expect(editWithHistory(restored, { type: 'redo' }).editor.model).toBe(removed.editor.model)
  })
})
