import type { Point } from '../geometry/coordinates'
import { barGeometry, toGlobal } from '../geometry/coordinates'
import type { Edit, GeometrySelection, Structure } from './structure'

interface NodalLoad {
  readonly kind: 'nodal'
  readonly nodeId: string
  readonly force: Point
  readonly moment: number
}

export type LoadFrame = 'global' | 'local'

interface PointLoad {
  readonly kind: 'point'
  readonly barId: string
  readonly s: number
  readonly frame: LoadFrame
  readonly force: Point
}

interface DistributedLoad {
  readonly kind: 'distributed'
  readonly barId: string
  readonly frame: LoadFrame
  readonly profile: 'uniform' | 'linear'
  readonly s0: number
  readonly s1: number
  readonly q0: Point
  readonly q1: Point
}

export type LoadDefinition = NodalLoad | PointLoad | DistributedLoad
export type StructuralLoad = LoadDefinition & { readonly id: string }

export function loadTarget(load: LoadDefinition): GeometrySelection {
  return load.kind === 'nodal' ? { kind: 'node', id: load.nodeId } : { kind: 'bar', id: load.barId }
}

export function loadBarGeometry(model: Structure, barId: string) {
  const bar = model.bars.find(item => item.id === barId)
  const start = bar && model.nodes.find(node => node.id === bar.startId)
  const end = bar && model.nodes.find(node => node.id === bar.endId)
  return start && end ? barGeometry(start, end) : null
}

/** Los vectores locales giran con la barra. La traslación del origen solo se aplica a posiciones. */
export function globalLoadVector(vector: Point, frame: LoadFrame, barAngle: number): Point {
  return frame === 'local' ? toGlobal(vector, { origin: { x: 0, y: 0 }, angle: barAngle }) : vector
}

export function loadFitsLength(load: PointLoad | DistributedLoad, length: number): boolean {
  if (load.kind === 'point') return load.s >= 0 && load.s <= length
  return load.s0 >= 0 && load.s0 < load.s1 && load.s1 <= length
}

/** Intensidad en una fracción u del intervalo de carga. Conserva los valores de los extremos. */
export function distributedIntensity(load: DistributedLoad, u: number): Point {
  if (load.profile === 'uniform') return load.q0
  return {
    x: (1 - u) * load.q0.x + u * load.q1.x,
    y: (1 - u) * load.q0.y + u * load.q1.y,
  }
}

export function toBaseUnits(kilo: number): number {
  return kilo * 1000
}

export function toKiloUnits(base: number): number {
  return base / 1000
}

function finiteVector(vector: Point): boolean {
  return Number.isFinite(Math.hypot(vector.x, vector.y))
}

function sameVector(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

export function validateLoad(model: Structure, definition: LoadDefinition): string | undefined {
  const vectors = definition.kind === 'distributed' ? [definition.q0, definition.q1] : [definition.force]
  if (!vectors.every(finiteVector) || (definition.kind === 'nodal' && !Number.isFinite(definition.moment))) {
    return 'Introduce componentes de carga finitas y representables en unidades internas.'
  }
  if (definition.kind === 'nodal') {
    if (!model.nodes.some(node => node.id === definition.nodeId)) return 'El nudo de la carga ya no existe.'
    return
  }
  const geometry = loadBarGeometry(model, definition.barId)
  if (!geometry) return 'La barra de la carga ya no existe o carece de longitud válida.'
  if (!loadFitsLength(definition, geometry.length)) {
    return definition.kind === 'point' ? 'La distancia s debe estar entre 0 y la longitud de la barra.'
      : 'El intervalo debe cumplir 0 ≤ s₀ < s₁ ≤ longitud de la barra.'
  }
  if (definition.kind === 'distributed') {
    const equal = sameVector(definition.q0, definition.q1)
    if (definition.profile === 'uniform' && !equal) return 'Una carga uniforme debe tener la misma intensidad en ambos extremos.'
    if (definition.profile === 'linear' && equal) return 'Introduce intensidades distintas o elige una carga uniforme.'
  }
}

export function sameLoad(a: LoadDefinition, b: LoadDefinition): boolean {
  if (a.kind === 'nodal' && b.kind === 'nodal') return a.nodeId === b.nodeId && a.moment === b.moment && sameVector(a.force, b.force)
  if (a.kind === 'point' && b.kind === 'point') return a.barId === b.barId && a.s === b.s && a.frame === b.frame && sameVector(a.force, b.force)
  return a.kind === 'distributed' && b.kind === 'distributed' && a.barId === b.barId && a.profile === b.profile && a.frame === b.frame &&
    a.s0 === b.s0 && a.s1 === b.s1 && sameVector(a.q0, b.q0) && sameVector(a.q1, b.q1)
}

export function saveLoad(model: Structure, definition: LoadDefinition, id?: string): Edit<StructuralLoad> {
  const existing = id === undefined ? undefined : model.loads.find(load => load.id === id)
  if (id !== undefined && !existing) return { error: 'La carga que estás editando ya no existe.' }
  if (existing && (existing.kind !== definition.kind || loadTarget(existing).id !== loadTarget(definition).id)) {
    return { error: 'La carga debe conservar su tipo y elemento asociado.' }
  }
  const error = validateLoad(model, definition)
  if (error) return { error }
  if (existing && sameLoad(existing, definition)) return { model, item: existing }

  const item: StructuralLoad = { ...definition, id: existing?.id ?? `C${model.nextLoad}` }
  return {
    item,
    model: existing
      ? { ...model, loads: model.loads.map(load => load.id === existing.id ? item : load) }
      : { ...model, loads: [...model.loads, item], nextLoad: model.nextLoad + 1 },
  }
}

export function deleteLoad(model: Structure, id: string): Structure {
  const loads = model.loads.filter(load => load.id !== id)
  return loads.length === model.loads.length ? model : { ...model, loads }
}
