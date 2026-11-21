import { describe, expect, it } from 'vitest'
import { MAX_COORDINATE, radians } from '../../geometry/coordinates'
import { findNodeOverlaps } from '../../domain/nodeOverlaps'
import { edit, INITIAL_EDITOR } from './editor'
import type { Action, Editor } from './editor'
import { buildObjectSnaps, resolveSnap } from './snap'

function apply(...actions: Action[]): Editor {
  return actions.reduce(edit, INITIAL_EDITOR)
}

describe('Estados de las herramientas', () => {
  it('cambia el UCS y transforma la entrada de trabajo sin mover los nudos existentes', () => {
    const editor = apply(
      { type: 'tool', tool: 'node' },
      { type: 'coordinates', mode: 'global', first: 2, second: 3 },
      { type: 'ucs', frame: { origin: { x: 4, y: 6 }, angle: radians(90) } },
      { type: 'coordinates', mode: 'ucs', first: 2, second: 1 },
      { type: 'coordinates', mode: 'global', first: 8, second: -4 },
    )
    expect(editor.model.nodes.map(({ x, y }) => [x, y])).toEqual([[2, 3], [3, 8], [8, -4]])
  })

  it('cancela una barra pendiente con Escape sin crear su nudo inicial', () => {
    const editor = apply(
      { type: 'tool', tool: 'bar' },
      { type: 'coordinates', mode: 'global', first: 4, second: 3 },
      { type: 'cancel' },
    )
    expect(editor.model.nodes).toHaveLength(0)
    expect(editor.interaction).toEqual({ tool: 'bar', stage: 'start' })
  })

  it('crea un extremo relativo y otro polar usando los ejes UCS', () => {
    const editor = apply(
      { type: 'ucs', frame: { origin: { x: 20, y: 20 }, angle: radians(90) } },
      { type: 'tool', tool: 'bar' },
      { type: 'coordinates', mode: 'global', first: 0, second: 0 },
      { type: 'coordinates', mode: 'relative', first: 4, second: 2 },
      { type: 'coordinates', mode: 'global', first: 10, second: 10 },
      { type: 'coordinates', mode: 'polar', first: 5, second: radians(-90) },
    )
    expect(editor.model.bars).toHaveLength(2)
    const relative = editor.model.nodes[1]!
    expect(relative.x).toBeCloseTo(-2, 12)
    expect(relative.y).toBeCloseTo(4, 12)
    expect(editor.model.nodes[3]).toMatchObject({ x: 15, y: 10 })
  })

  it('conserva la entrada numérica incluso junto a un nudo y con Snap activo', () => {
    const editor = apply(
      { type: 'tool', tool: 'node' },
      { type: 'coordinates', mode: 'global', first: 4, second: 5 },
      { type: 'coordinates', mode: 'global', first: 4.000000001, second: 5 },
    )
    expect(editor.model.nodes.map(node => node.x)).toEqual([4, 4.000000001])
  })

  it('usa un punto ajustado como origen UCS sin mover ni crear geometría', () => {
    const editor = apply(
      { type: 'ucs', frame: { origin: { x: 0.35, y: -2.4 }, angle: radians(60) } },
      { type: 'pick-origin' },
    )
    const end = resolveSnap({ x: 3.72, y: 5.36 }, 58, editor.snap, [])
    const updated = edit(editor, { type: 'point', end })
    expect(updated.ucs).toEqual({ origin: { x: 4, y: 5 }, angle: radians(60) })
    expect(updated.model).toBe(editor.model)
  })

  it('mueve un nudo seleccionado con un punto ajustado y conserva el ID usado por sus barras', () => {
    const editor = apply(
      { type: 'tool', tool: 'bar' },
      { type: 'coordinates', mode: 'global', first: 0, second: 0 },
      { type: 'coordinates', mode: 'global', first: 3, second: 0 },
      { type: 'tool', tool: 'move' },
      { type: 'move-start', nodeId: 'N1' },
    )
    const end = resolveSnap({ x: 1.1, y: 1.75 }, 58, editor.snap, buildObjectSnaps(editor.model), new Set(['N1']))
    const updated = edit(editor, { type: 'point', end })
    expect(updated.model.nodes[0]).toMatchObject({ id: 'N1', x: 1, y: 2 })
    expect(updated.model.bars).toBe(editor.model.bars)
    const picking = edit(updated, { type: 'move-start', nodeId: 'N1' })
    const rejected = edit(picking, { type: 'coordinates', mode: 'global', first: 3, second: 0 })
    expect(rejected.error).toMatch(/longitud/)
    expect(rejected.model).toBe(updated.model)
  })

  it('admite selección aditiva y conmutable, y elimina el conjunto seleccionado', () => {
    const first = { kind: 'node', id: 'N1' } as const
    const second = { kind: 'node', id: 'N2' } as const
    const member = { kind: 'bar', id: 'B1' } as const
    const editor = apply(
      { type: 'tool', tool: 'bar' },
      { type: 'coordinates', mode: 'global', first: 0, second: 0 },
      { type: 'coordinates', mode: 'global', first: 1, second: 1 },
      { type: 'tool', tool: 'select' },
      { type: 'select', items: [first] },
      { type: 'select', items: [first, second], mode: 'add' },
      { type: 'select', items: [second, member], mode: 'toggle' },
    )
    expect(editor.selection).toEqual([first, member])
    const cleaned = edit(editor, { type: 'delete' })
    expect(cleaned.model.nodes.map(node => node.id)).toEqual(['N2'])
    expect(cleaned.model.bars).toEqual([])
    expect(cleaned.selection).toEqual([])
  })

  it('superpone N2 a N1 con Object Snap y permite separarlos manteniendo sus barras', () => {
    const separate = apply(
      { type: 'tool', tool: 'node' },
      { type: 'coordinates', mode: 'global', first: 0, second: 0 },
      { type: 'coordinates', mode: 'global', first: 3, second: 2 },
      { type: 'tool', tool: 'bar' },
      { type: 'coordinates', mode: 'global', first: 0, second: 0 },
      { type: 'coordinates', mode: 'global', first: 0, second: 4 },
      { type: 'coordinates', mode: 'global', first: 3, second: 2 },
      { type: 'coordinates', mode: 'global', first: 6, second: 0 },
      { type: 'tool', tool: 'move' },
      { type: 'move-start', nodeId: 'N2' },
    )
    expect(findNodeOverlaps(separate.model.nodes)).toEqual([])
    const target = resolveSnap({ x: 0.04, y: 0.03 }, 58, separate.snap, buildObjectSnaps(separate.model), new Set(['N2']))
    expect(target).toMatchObject({ kind: 'endpoint', nodeId: 'N1' })
    const overlap = edit(separate, { type: 'point', end: target })
    expect(overlap.error).toBeNull()
    expect(overlap.model.nodes).toHaveLength(4)
    expect(findNodeOverlaps(overlap.model.nodes).map(group => group.map(node => node.id))).toEqual([['N1', 'N2']])
    expect(overlap.model.bars).toBe(separate.model.bars)
    expect(overlap.model.bars.map(bar => [bar.startId, bar.endId])).toEqual([['N1', 'N3'], ['N2', 'N4']])

    const ucs = edit(overlap, { type: 'ucs', frame: { origin: { x: 10, y: -7 }, angle: radians(45) } })
    expect(ucs.model.nodes).toBe(overlap.model.nodes)
    expect(findNodeOverlaps(ucs.model.nodes)).toEqual(findNodeOverlaps(overlap.model.nodes))

    const pick = edit(ucs, { type: 'move-start', nodeId: 'N2' })
    const moved = edit(pick, { type: 'coordinates', mode: 'global', first: 5, second: 2 })
    expect(findNodeOverlaps(moved.model.nodes)).toEqual([])
    expect(moved.model.bars).toBe(separate.model.bars)
    expect(moved.model.nodes[1]).toMatchObject({ id: 'N2', x: 5, y: 2 })
  })

  it('mueve solo los nudos explícitos de una selección mixta y admite cambiar la referencia', () => {
    const starting = apply(
      { type: 'tool', tool: 'bar' },
      { type: 'coordinates', mode: 'global', first: 0, second: 0 },
      { type: 'coordinates', mode: 'global', first: 3, second: 0 },
      { type: 'coordinates', mode: 'global', first: 3, second: 0 },
      { type: 'coordinates', mode: 'global', first: 7, second: 0 },
      { type: 'select', items: [{ kind: 'bar', id: 'B2' }, { kind: 'node', id: 'N1' }, { kind: 'node', id: 'N2' }] },
      { type: 'tool', tool: 'move' },
    )
    expect(starting.interaction).toMatchObject({ referenceId: 'N1', nodeIds: ['N1', 'N2'] })
    const changedReference = edit(starting, { type: 'move-start', nodeId: 'N2' })
    expect(changedReference.interaction).toMatchObject({ referenceId: 'N2', nodeIds: ['N1', 'N2'] })
    const failed = edit(changedReference, { type: 'coordinates', mode: 'global', first: 7, second: 0 })
    expect(failed.error).toMatch(/B2/)
    expect(failed.model).toBe(starting.model)
    const done = edit(failed, { type: 'coordinates', mode: 'global', first: 6, second: 0 })
    expect(done.model.nodes.map(({ id, x }) => [id, x])).toEqual([['N1', 3], ['N2', 6], ['N3', 7]])
    expect(done.model.bars).toBe(starting.model.bars)
    expect(done.selection).toEqual(starting.selection)
  })

  it('aplica una etiqueta válida a una selección mixta sin cambiar IDs ni extremos', () => {
    const start = apply(
      { type: 'tool', tool: 'bar' },
      { type: 'coordinates', mode: 'global', first: 0, second: 0 },
      { type: 'coordinates', mode: 'global', first: 3, second: 0 },
      { type: 'select', items: [{ kind: 'node', id: 'N1' }, { kind: 'bar', id: 'B1' }] },
    )
    const invalid = edit(start, { type: 'selection-label', label: '  ' })
    expect(invalid.error).toMatch(/etiqueta/i)
    expect(invalid.model).toBe(start.model)
    const result = edit(start, { type: 'selection-label', label: ' Eje A ' })
    expect(result.model.nodes[0]).toEqual({ ...start.model.nodes[0], label: 'Eje A' })
    expect(result.model.nodes[1]).toBe(start.model.nodes[1])
    expect(result.model.bars[0]).toEqual({ ...start.model.bars[0], label: 'Eje A' })
    expect(result.selection).toBe(start.selection)
  })

  it('rechaza el conjunto cuando un nudo secundario saldría del dominio físico', () => {
    const start = apply(
      { type: 'tool', tool: 'node' },
      { type: 'coordinates', mode: 'global', first: 0, second: 0 },
      { type: 'coordinates', mode: 'global', first: 20, second: 0 },
      { type: 'select', items: [{ kind: 'node', id: 'N1' }, { kind: 'node', id: 'N2' }] },
      { type: 'tool', tool: 'move' },
    )
    const failed = edit(start, { type: 'coordinates', mode: 'global', first: MAX_COORDINATE - 5, second: 0 })
    expect(failed.error).toMatch(/fuera del rango/)
    expect(failed.model).toBe(start.model)
  })
})
