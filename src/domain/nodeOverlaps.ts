import { distance } from '../geometry/coordinates'
import type { StructuralNode } from './structure'

export const NODE_OVERLAP_TOLERANCE = 1e-8 // m, distancia euclidiana en coordenadas globales

export type NodeOverlap = readonly StructuralNode[]

interface Entry {
  readonly node: StructuralNode
  parent?: Entry
}

function representative(entry: Entry): Entry {
  while (entry.parent) {
    if (entry.parent.parent) entry.parent = entry.parent.parent
    entry = entry.parent
  }
  return entry
}

/** Agrupa las coincidencias directas y sus cadenas para mostrar un aviso por conjunto. */
export function findNodeOverlaps(nodes: readonly StructuralNode[]): readonly NodeOverlap[] {
  const entries: Entry[] = nodes.map(node => ({ node }))
  const ordered = [...entries].sort((a, b) => a.node.x - b.node.x)

  for (const [index, first] of ordered.entries()) {
    for (let next = index + 1; next < ordered.length; next++) {
      const second = ordered[next]!
      if (second.node.x - first.node.x > NODE_OVERLAP_TOLERANCE) break
      const a = representative(first)
      const b = representative(second)
      if (a !== b && distance(first.node, second.node) <= NODE_OVERLAP_TOLERANCE) b.parent = a
    }
  }

  const groups = new Map<Entry, StructuralNode[]>()
  for (const entry of entries) {
    const root = representative(entry)
    const members = groups.get(root)
    if (members) members.push(entry.node)
    else groups.set(root, [entry.node])
  }
  return [...groups.values()].filter(members => members.length > 1)
}
