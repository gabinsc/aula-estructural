import { describe, expect, it } from 'vitest'
import { findNodeOverlaps, NODE_OVERLAP_TOLERANCE } from './nodeOverlaps'
import type { StructuralNode } from './structure'

function node(id: string, x: number, y: number): StructuralNode {
  return { id, label: id, x, y }
}

describe('Coincidencias geométricas de nudos', () => {
  it('omite nudos aislados y devuelve cada conjunto de superposición una sola vez', () => {
    const n1 = node('N1', 3, -4)
    const n2 = node('N2', 3, -4)
    const n3 = node('N3', -3, 4)
    const n4 = node('N4', -3, 4)
    const n5 = node('N5', 3, 4)
    expect(findNodeOverlaps([n1, n3, n5])).toEqual([])
    expect(findNodeOverlaps([n1, n3, n4, n2, n5])).toEqual([[n1, n2], [n3, n4]])
  })

  it('incluye el límite y usa la distancia euclidiana, no un recuadro por eje', () => {
    const tolerance = NODE_OVERLAP_TOLERANCE
    const origin = node('N1', 0, 0)
    for (const x of [-tolerance, tolerance, tolerance * (1 - 1e-6)]) {
      const near = node('N2', x, 0)
      expect(findNodeOverlaps([origin, near])).toEqual([[origin, near]])
    }
    expect(findNodeOverlaps([origin, node('N2', tolerance * (1 + 1e-6), 0)])).toEqual([])
    expect(findNodeOverlaps([origin, node('N2', 0.75 * tolerance, 0.75 * tolerance)])).toEqual([])
  })

  it('muestra un solo conjunto cuando se encadenan coincidencias directas', () => {
    const tolerance = NODE_OVERLAP_TOLERANCE
    const n1 = node('N1', 0, 0)
    const n2 = node('N2', 0.75 * tolerance, 0)
    const n3 = node('N3', 1.5 * tolerance, 0)
    expect(findNodeOverlaps([n3, n1, n2])).toEqual([[n3, n1, n2]])
    expect(findNodeOverlaps([n1, n3])).toEqual([])
  })
})
