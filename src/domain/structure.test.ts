import { describe, expect, it } from 'vitest'
import { createBar, createNode, deleteSelection, EMPTY_STRUCTURE } from './structure'
import type { Edit } from './structure'

function success<T>(result: Edit<T>) {
  if ('error' in result) throw new Error(result.error)
  return result
}

describe('Edición del modelo estructural', () => {
  it('crea un nudo exacto y reutiliza un nudo con las mismas coordenadas', () => {
    const first = success(createNode(EMPTY_STRUCTURE, { point: { x: 2.125, y: -3.5 } }))
    expect(first.item).toEqual({ x: 2.125, y: -3.5, id: 'N1', label: 'N1' })
    const again = success(createNode(first.model, { point: { x: 2.125, y: -3.5 } }))
    expect(again.model).toBe(first.model)
    expect(again.item).toBe(first.item)
    expect('error' in createNode(first.model, { point: { x: Infinity, y: 0 } })).toBe(true)
  })

  it('crea barras con referencias a los extremos y reutiliza un nudo identificado', () => {
    const start = { point: { x: 0, y: 0 } }
    const end = { point: { x: 4, y: 3 } }
    const a = success(createBar(EMPTY_STRUCTURE, start, end))
    const b = success(createBar(a.model, { point: end.point, nodeId: a.item.endId }, { point: { x: 8, y: 3 } }))
    expect(a.item).toEqual({ id: 'B1', label: 'B1', startId: 'N1', endId: 'N2' })
    expect(b.item.startId).toBe('N2')
    expect(b.model.nodes).toHaveLength(3)
    expect(b.model.bars).toHaveLength(2)
  })

  it('rechaza barras degeneradas o duplicadas y conserva el modelo previo', () => {
    const start = { point: { x: 0, y: 0 } }
    const end = { point: { x: 2, y: 2 } }
    expect(createBar(EMPTY_STRUCTURE, start, { point: { x: 1e-10, y: 0 } })).toHaveProperty('error')
    expect(EMPTY_STRUCTURE.nodes).toHaveLength(0)
    const { model } = success(createBar(EMPTY_STRUCTURE, start, end))
    expect(createBar(model, end, start)).toHaveProperty('error')
    expect(model.nodes).toHaveLength(2)
    expect(model.bars).toHaveLength(1)
  })

  it('mantiene separadas dos barras en un cruce geométrico', () => {
    const { model } = success(createBar(EMPTY_STRUCTURE, { point: { x: 0, y: 0 } }, { point: { x: 4, y: 4 } }))
    const crossed = success(createBar(model, { point: { x: 0, y: 4 } }, { point: { x: 4, y: 0 } }))
    expect(crossed.model.nodes).toHaveLength(4)
    expect(crossed.item).toMatchObject({ startId: 'N3', endId: 'N4' })
  })

  it('elimina las barras incidentes al borrar su nudo y mantiene los extremos al borrar una barra', () => {
    const { model } = success(createBar(EMPTY_STRUCTURE, { point: { x: 0, y: 0 } }, { point: { x: 4, y: 4 } }))
    expect(deleteSelection(model, { kind: 'bar', id: 'B1' })).toMatchObject({ nodes: model.nodes, bars: [] })
    const edited = deleteSelection(model, { kind: 'node', id: 'N1' })
    expect(edited.nodes.map(node => node.id)).toEqual(['N2'])
    expect(edited.bars).toEqual([])
  })
})
