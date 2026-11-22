import { supportRestraints } from '../domain/support'
import type { Point } from '../geometry/coordinates'
import type { EquivalentLoadTrace, FrameInteriorLoad, FrameVector, PreparedBar, PreparedComponent, PreparedFrame, PreparedModel, ReducedDof } from './contracts'
import { frameEnergyModes, frameEquivalentLoad, frameVector, toGlobalVector, toLocalVector, transformFrameVector } from './frame'
import { compensatedSum } from './summation'

/** Ensambla trabajo axial en coordenadas globales [uxi, uyi, uxj, uyj]. */
export function trussStiffness(bar: Pick<PreparedBar, 'unit' | 'axialStiffness'>): Float64Array {
  const { x: c, y: s } = bar.unit
  const extension = [-c, -s, c, s]
  const matrix = new Float64Array(16)
  addOuterProduct(matrix, 4, [0, 1, 2, 3], extension, bar.axialStiffness)
  return matrix
}

function addOuterProduct(matrix: Float64Array, width: number, indices: readonly number[],
  direction: readonly number[], stiffness: number) {
  for (let i = 0; i < indices.length; i++) {
    for (let j = i; j < indices.length; j++) {
      const x = indices[i]!
      const y = indices[j]!
      const value = stiffness * direction[i]! * direction[j]!
      matrix[x * width + y] = matrix[x * width + y]! + value
      if (i !== j) matrix[y * width + x] = matrix[y * width + x]! + value
    }
  }
}

function globalFrameModes(bar: PreparedFrame) {
  return frameEnergyModes(bar).map(({ axial, transverse, spin, stiffness, endSign }) => {
    const direction = toGlobalVector({ x: axial, y: transverse }, bar.unit)
    return { stiffness, direction: [direction.x, direction.y, spin, -direction.x, -direction.y, endSign * spin] }
  })
}

export function frameGlobalStiffness(bar: PreparedFrame): Float64Array {
  const matrix = new Float64Array(36)
  for (const { direction, stiffness } of globalFrameModes(bar)) {
    addOuterProduct(matrix, 6, [0, 1, 2, 3, 4, 5], direction, stiffness)
  }
  return matrix
}

export function assembleModel(model: PreparedModel, includeTrace = false) {
  const size = model.dofs.length
  const K = new Float64Array(size * size)
  const forces: number[][] = Array.from({ length: size }, () => [])
  const memberLoads = new Map<string, FrameInteriorLoad[]>()
  const equivalentLocal = new Map<string, FrameVector>()
  const equivalentGlobal = new Map<string, FrameVector>()
  const equivalentLoads = new Map<string, EquivalentLoadTrace[]>()
  for (const load of model.loads) {
    if (load.kind === 'nodal') {
      const [x, y, rz] = model.dofByNode.get(load.nodeId)!
      forces[x]!.push(load.force.x)
      forces[y]!.push(load.force.y)
      if (rz !== undefined) forces[rz]!.push(load.moment)
    } else {
      const group = memberLoads.get(load.barId)
      if (group) group.push(load)
      else memberLoads.set(load.barId, [load])
    }
  }
  for (const bar of model.bars) {
    const { x, y } = bar.unit
    if (bar.kind === 'truss2d') {
      addOuterProduct(K, size, bar.dofIndices, [-x, -y, x, y], bar.axialStiffness)
      continue
    }
    for (const { direction, stiffness } of globalFrameModes(bar)) {
      addOuterProduct(K, size, bar.dofIndices, direction, stiffness)
    }
    const original = memberLoads.get(bar.barId) ?? []
    const vectors = original.map(load => frameEquivalentLoad(bar.length, load))
    const local = frameVector(i => compensatedSum(vectors.map(vector => vector[i]!)))
    equivalentLocal.set(bar.barId, local)
    const global = transformFrameVector(local, bar.unit, toGlobalVector)
    if (includeTrace) {
      equivalentGlobal.set(bar.barId, global)
      equivalentLoads.set(bar.barId, original.map((load, i) => ({ loadId: load.id, local: vectors[i]!,
        global: transformFrameVector(vectors[i]!, bar.unit, toGlobalVector) })))
    }
    for (const [i, index] of bar.dofIndices.entries()) forces[index]!.push(global[i]!)
  }
  return { K, F: Float64Array.from(forces, compensatedSum), equivalentLocal, equivalentGlobal, equivalentLoads, memberLoads }
}

export function rollerNormal(angle: number): Point {
  // Las orientaciones canónicas tienen un eje exactamente nulo en la geometría.
  // Evaluar cos(π/2) introduciría rigidez espuria al equilibrar la diagonal.
  if (angle === 0) return { x: 0, y: 1 }
  if (angle === Math.PI) return { x: 0, y: -1 }
  if (angle === Math.PI / 2) return { x: -1, y: 0 }
  if (angle === -Math.PI / 2) return { x: 1, y: 0 }
  return supportRestraints({ kind: 'roller', surfaceAngle: angle }).translation[0]!
}

export function reduceComponent(model: PreparedModel, component: PreparedComponent,
  bars: ReadonlyMap<string, PreparedBar>, F: Float64Array) {
  const dofIndices = component.nodeIds.flatMap(id => model.dofByNode.get(id)!)
  const reducedDofs: ReducedDof[] = []
  const nodeColumns = new Map<string, number[]>()
  const normals = new Map<string, Point>()
  for (const nodeId of component.nodeIds) {
    const support = model.supports.get(nodeId)
    const columns: number[] = []
    nodeColumns.set(nodeId, columns)
    if (support?.kind === 'roller') {
      const normal = rollerNormal(support.surfaceAngle)
      normals.set(nodeId, normal)
      columns.push(reducedDofs.length)
      reducedDofs.push({ nodeId, axis: 'tangent', direction: { x: normal.y, y: normal.x === 0 ? 0 : -normal.x } })
    } else if (!support) {
      columns.push(reducedDofs.length, reducedDofs.length + 1)
      reducedDofs.push({ nodeId, axis: 'ux', direction: { x: 1, y: 0 } }, { nodeId, axis: 'uy', direction: { x: 0, y: 1 } })
    }
    if (model.dofByNode.get(nodeId)!.length === 3 && !model.rotationLocks.has(nodeId)) {
      columns.push(reducedDofs.length)
      reducedDofs.push({ nodeId, axis: 'rz', direction: { x: 0, y: 0 } })
    }
  }
  const size = reducedDofs.length
  const Kr = new Float64Array(size * size)
  const Fr = Float64Array.from(reducedDofs, dof => {
    const [x, y, rz] = model.dofByNode.get(dof.nodeId)!
    return dof.axis === 'rz' ? F[rz!]! : dof.direction.x * F[x]! + dof.direction.y * F[y]!
  })
  const incidentStiffness = new Float64Array(size)
  for (const id of component.barIds) {
    const bar = bars.get(id)!
    const start = nodeColumns.get(bar.startId)!
    const end = nodeColumns.get(bar.endId)!
    const indices = [...start, ...end]
    // Qᵀ K Q por energía. Proyectar primero evita restar rigideces
    // grandes al evaluar una dirección casi libre.
    if (bar.kind === 'frame2d') {
      const projected = indices.map(index => toLocalVector(reducedDofs[index]!.direction, bar.unit))
      for (const { axial, transverse, spin, stiffness, endSign } of frameEnergyModes(bar)) {
        const direction = indices.map((index, i) => {
          const vector = projected[i]!
          if (reducedDofs[index]!.axis === 'rz') return i < start.length ? spin : endSign * spin
          return (i < start.length ? 1 : -1) * (vector.x * axial + vector.y * transverse)
        })
        addOuterProduct(Kr, size, indices, direction, stiffness)
      }
      continue
    }
    const direction = indices.map((index, i) => {
      const vector = reducedDofs[index]!.direction
      if (model.dofByNode.get(reducedDofs[index]!.nodeId)!.length === 2) {
        incidentStiffness[index] = incidentStiffness[index]! + bar.axialStiffness
      }
      return (i < start.length ? -1 : 1) * (vector.x * bar.unit.x + vector.y * bar.unit.y)
    })
    addOuterProduct(Kr, size, indices, direction, bar.axialStiffness)
  }
  // En los nudos con flexión, la escala axial no sirve para evaluar
  // mecanismos locales. El sistema escalado comprueba el rango global.
  for (const [i, dof] of reducedDofs.entries()) if (model.dofByNode.get(dof.nodeId)!.length === 3) {
    incidentStiffness[i] = Kr[i * size + i]!
  }
  return { Kr, Fr, incidentStiffness, dofIndices, reducedDofs, normals }
}

export type ReducedComponent = ReturnType<typeof reduceComponent>
