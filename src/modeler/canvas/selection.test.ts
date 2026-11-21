import { describe, expect, it } from 'vitest'
import { EMPTY_STRUCTURE } from '../../domain/structure'
import { worldToScreen } from '../../geometry/camera'
import { selectionAt, selectionInBox } from './selection'

const viewport = { width: 900, height: 650 }
const model = {
  ...EMPTY_STRUCTURE,
  nodes: [{ x: 0, y: 0, id: 'N1', label: 'N1' }, { x: 10, y: 0, id: 'N2', label: 'N2' }],
  bars: [{ id: 'B1', label: 'B1', startId: 'N1', endId: 'N2' }],
}

describe('Selección en píxeles CSS', () => {
  it.each([24, 110, 320])('mantiene el margen de selección a escala de %i px/m', scale => {
    const camera = { center: { x: 5, y: 0 }, scale }
    const center = worldToScreen({ x: 5, y: 0 }, camera, viewport)
    expect(selectionAt(model, { ...center, y: center.y + 7 }, camera, viewport)).toEqual({ kind: 'bar', id: 'B1' })
    expect(selectionAt(model, { ...center, y: center.y + 8 }, camera, viewport)).toBeNull()
  })

  it('prioriza los nudos junto a una barra', () => {
    const camera = { center: { x: 5, y: 0 }, scale: 55 }
    const node = worldToScreen({ x: 0, y: 0 }, camera, viewport)
    const pointer = { x: node.x + 8, y: node.y + 4 }
    expect(selectionAt(model, pointer, camera, viewport)).toEqual({ kind: 'node', id: 'N1' })
    expect(selectionAt(model, { x: node.x - 11, y: node.y }, camera, viewport)).toBeNull()
  })

  it('selecciona barras contenidas de izquierda a derecha y cruzadas en el sentido inverso', () => {
    const camera = { center: { x: 5, y: 0 }, scale: 50 }
    const a = worldToScreen({ x: 4, y: 1 }, camera, viewport)
    const b = worldToScreen({ x: 6, y: -1 }, camera, viewport)
    expect(selectionInBox(model, { start: a, end: b }, camera, viewport)).toEqual([])
    expect(selectionInBox(model, { start: b, end: a }, camera, viewport)).toEqual([{ kind: 'bar', id: 'B1' }])
    expect(selectionInBox(model, {
      start: worldToScreen({ x: -1, y: 1 }, camera, viewport),
      end: worldToScreen({ x: 11, y: -1 }, camera, viewport),
    }, camera, viewport).map(item => item.id)).toEqual(['N1', 'N2', 'B1'])
  })
})
