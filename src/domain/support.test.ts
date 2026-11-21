import { describe, expect, it } from 'vitest'
import { createBar, deleteSelection, EMPTY_STRUCTURE, moveNodes } from './structure'
import { changeNodeSupport, getNodeSupport, supportRestraints } from './support'

function withBar() {
  const created = createBar(EMPTY_STRUCTURE, { point: { x: 0, y: 0 } }, { point: { x: 3, y: 0 } })
  if ('error' in created) throw new Error(created.error)
  return created.model
}

describe('Apoyos nodales', () => {
  it('deriva las restricciones globales de los tres tipos de apoyo', () => {
    const pinned = supportRestraints({ kind: 'pinned' })
    expect(pinned).toEqual({ translation: [{ x: 1, y: 0 }, { x: 0, y: 1 }], rotation: false })
    expect(supportRestraints({ kind: 'fixed' })).toEqual({ ...pinned, rotation: true })
    const angle = Math.PI / 6
    const roller = supportRestraints({ kind: 'roller', surfaceAngle: angle })
    expect(roller.rotation).toBe(false)
    expect(roller.translation).toHaveLength(1)
    const normal = roller.translation[0]!
    expect(normal.x).toBeCloseTo(-0.5)
    expect(normal.y).toBeCloseTo(Math.sqrt(3) / 2)
    expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1)
    expect(normal.x * Math.cos(angle) + normal.y * Math.sin(angle)).toBeCloseTo(0)
  })

  it('rechaza nudos inexistentes y ángulos no finitos', () => {
    const model = withBar()
    expect(changeNodeSupport(model, 'N9', { kind: 'pinned' }, undefined)).toHaveProperty('error')
    for (const surfaceAngle of [NaN, Infinity, -Infinity]) {
      expect(changeNodeSupport(model, 'N1', { kind: 'roller', surfaceAngle }, undefined)).toHaveProperty('error')
    }
    expect(model.supports).toEqual([])
  })

  it('requiere identificar el apoyo actual para reemplazarlo y evita duplicados o cambios vacíos', () => {
    const created = changeNodeSupport(withBar(), 'N1', { kind: 'pinned' }, undefined)
    if ('error' in created) throw new Error(created.error)
    expect(changeNodeSupport(created.model, 'N1', { kind: 'fixed' }, undefined)).toHaveProperty('error')
    const changed = changeNodeSupport(created.model, 'N1', { kind: 'fixed' }, getNodeSupport(created.model, 'N1'))
    if ('error' in changed) throw new Error(changed.error)
    expect(changed.model.supports).toEqual([{ nodeId: 'N1', kind: 'fixed' }])
    expect(changed.model.bars).toBe(created.model.bars)
    expect(changeNodeSupport(changed.model, 'N1', null, getNodeSupport(created.model, 'N1'))).toHaveProperty('error')
    const repeated = changeNodeSupport(changed.model, 'N1', { kind: 'fixed' }, getNodeSupport(changed.model, 'N1'))
    expect('model' in repeated && repeated.model).toBe(changed.model)
  })

  it('normaliza una vuelta completa y conserva el lado de la superficie al girar media vuelta', () => {
    const model = withBar()
    expect(changeNodeSupport(model, 'N1', { kind: 'roller', surfaceAngle: -2 * Math.PI }, undefined))
      .toHaveProperty('item.surfaceAngle', 0)
    expect(changeNodeSupport(model, 'N1', { kind: 'roller', surfaceAngle: -Math.PI }, undefined))
      .toHaveProperty('item.surfaceAngle', Math.PI)
    expect(changeNodeSupport(model, 'N1', { kind: 'roller', surfaceAngle: 3 * Math.PI / 2 }, undefined))
      .toHaveProperty('item.surfaceAngle', -Math.PI / 2)
  })

  it('traslada el apoyo con su nudo y lo elimina junto con el nudo y sus barras incidentes', () => {
    const created = changeNodeSupport(withBar(), 'N1', { kind: 'pinned' }, undefined)
    if ('error' in created) throw new Error(created.error)
    const moved = moveNodes(created.model, ['N1'], 'N1', { x: -1, y: 2 })
    if ('error' in moved) throw new Error(moved.error)
    expect(moved.model.supports).toBe(created.model.supports)
    expect(moved.model.bars).toBe(created.model.bars)
    expect(deleteSelection(moved.model, { kind: 'bar', id: 'B1' }).supports).toBe(moved.model.supports)
    const deleted = deleteSelection(moved.model, { kind: 'node', id: 'N1' })
    expect(deleted.supports).toEqual([])
    expect(deleted.bars).toEqual([])
    expect(deleted.nodes.map(node => node.id)).toEqual(['N2'])
  })
})
