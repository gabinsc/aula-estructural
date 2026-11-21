import { barGeometry, isModelPoint, translateFromReference } from '../geometry/coordinates'
import type { Point } from '../geometry/coordinates'
import type { NodalSupport } from './support'
import type { StructuralLoad } from './load'
import { loadFitsLength } from './load'
import { EMPTY_MECHANICS } from './mechanics'
import type { MechanicalSection } from './mechanics'
import type { Library } from './library'

export interface StructuralNode extends Point {
  readonly id: string
  readonly label: string
}

export interface Bar {
  readonly id: string
  readonly label: string
  readonly startId: string
  readonly endId: string
}

export interface Structure {
  readonly nodes: readonly StructuralNode[]
  readonly bars: readonly Bar[]
  readonly supports: readonly NodalSupport[]
  readonly loads: readonly StructuralLoad[]
  readonly mechanics: MechanicalSection
  readonly library?: Library
  readonly nextNode: number
  readonly nextBar: number
  readonly nextLoad: number
}

export type GeometrySelection = { readonly kind: 'node' | 'bar'; readonly id: string }
export type Selection = GeometrySelection | { readonly kind: 'load'; readonly id: string }
export type Endpoint = { readonly point: Point; readonly nodeId?: string }
export type Edit<T> = { readonly model: Structure; readonly item: T } | { readonly error: string }

export const EMPTY_STRUCTURE: Structure = {
  nodes: [], bars: [], supports: [], loads: [], mechanics: EMPTY_MECHANICS, nextNode: 1, nextBar: 1, nextLoad: 1,
}
export const MAX_LABEL_LENGTH = 80

export function getNode(model: Structure, id: string): StructuralNode | undefined {
  return model.nodes.find(node => node.id === id)
}

export function createNode(model: Structure, end: Endpoint): Edit<StructuralNode> {
  if (!isModelPoint(end.point)) return { error: 'Introduce coordenadas finitas entre −1 000 000 000 y 1 000 000 000 m.' }
  const existing = (end.nodeId ? getNode(model, end.nodeId) : undefined)
    ?? model.nodes.find(node => node.x === end.point.x && node.y === end.point.y)
  if (existing) return { model, item: existing }

  const id = `N${model.nextNode}`
  const item = { x: end.point.x, y: end.point.y, id, label: id }
  return { model: { ...model, nodes: [...model.nodes, item], nextNode: model.nextNode + 1 }, item }
}

export function createBar(model: Structure, start: Endpoint, end: Endpoint): Edit<Bar> {
  const first = createNode(model, start)
  if ('error' in first) return first
  const second = createNode(first.model, end)
  if ('error' in second) return second

  const a = first.item
  const b = second.item
  if (!barGeometry(a, b)) return { error: 'Los extremos deben ser nudos distintos.' }
  if (model.bars.some(bar => (bar.startId === a.id && bar.endId === b.id) || (bar.startId === b.id && bar.endId === a.id))) {
    return { error: 'Ya existe una barra entre esos dos nudos.' }
  }

  const id = `B${model.nextBar}`
  const item = { id, label: id, startId: a.id, endId: b.id }
  return {
    model: { ...second.model, bars: [...model.bars, item], nextBar: model.nextBar + 1 },
    item,
  }
}

export function deleteSelection(model: Structure, ...selection: readonly Selection[]): Structure {
  const nodes = new Set(selection.filter(item => item.kind === 'node').map(item => item.id))
  const bars = new Set(selection.filter(item => item.kind === 'bar').map(item => item.id))
  const removedLoads = new Set(selection.filter(item => item.kind === 'load').map(item => item.id))
  const remainingNodes = model.nodes.filter(node => !nodes.has(node.id))
  const remainingBars = model.bars.filter(bar => !bars.has(bar.id) && !nodes.has(bar.startId) && !nodes.has(bar.endId))
  const geometryChanged = remainingNodes.length !== model.nodes.length || remainingBars.length !== model.bars.length
  if (!geometryChanged && !model.loads.some(load => removedLoads.has(load.id))) return model
  const supports = nodes.size ? model.supports.filter(support => !nodes.has(support.nodeId)) : model.supports
  const remainingBarIds = new Set(remainingBars.map(bar => bar.id))
  const loads = model.loads.filter(load => !removedLoads.has(load.id) &&
    (load.kind === 'nodal' ? !nodes.has(load.nodeId) : remainingBarIds.has(load.barId)))
  const mechanics = remainingBars.length === model.bars.length ? model.mechanics : { ...model.mechanics,
    assignments: model.mechanics.assignments.filter(assignment => remainingBarIds.has(assignment.barId)) }
  return { ...model, nodes: geometryChanged ? remainingNodes : model.nodes,
    bars: geometryChanged ? remainingBars : model.bars, supports, loads, mechanics }
}

export function relabelSelection(model: Structure, selection: readonly Selection[], value: string): Edit<string> {
  const label = value.trim()
  if (!label || label.length > MAX_LABEL_LENGTH) {
    return { error: `Introduce una etiqueta de 1 a ${MAX_LABEL_LENGTH} caracteres.` }
  }
  const ids = new Set(selection.map(item => item.id))
  const nodes = model.nodes.map(node => ids.has(node.id) && node.label !== label ? { ...node, label } : node)
  const bars = model.bars.map(bar => ids.has(bar.id) && bar.label !== label ? { ...bar, label } : bar)
  if (nodes.every((node, index) => node === model.nodes[index]) && bars.every((bar, index) => bar === model.bars[index])) {
    return { model, item: label }
  }
  return {
    model: { ...model, nodes, bars },
    item: label,
  }
}

export function moveNodes(
  model: Structure, ids: readonly string[], referenceId: string, destination: Point,
): Edit<readonly StructuralNode[]> {
  const nodes = new Map(model.nodes.map(node => [node.id, node]))
  const reference = nodes.get(referenceId)
  if (!reference || !ids.includes(referenceId)) return { error: 'El nudo de referencia no está seleccionado.' }
  if (!isModelPoint(destination)) return { error: 'El destino está fuera del rango de coordenadas del modelo.' }
  const unchanged = destination.x === reference.x && destination.y === reference.y
  const moved = new Map<string, StructuralNode>()
  for (const id of new Set(ids)) {
    const node = nodes.get(id)
    if (!node) return { error: 'Un nudo seleccionado ya no existe.' }
    const point = unchanged ? node : translateFromReference(node, reference, destination)
    if (!isModelPoint(point)) return { error: 'El desplazamiento dejaría un nudo fuera del rango del modelo.' }
    moved.set(id, unchanged ? node : { ...node, ...point })
  }
  const item = [...moved.values()]
  if (unchanged) return { model, item }

  const lengths = new Map<string, number>()
  for (const bar of model.bars) {
    if (!moved.has(bar.startId) && !moved.has(bar.endId)) continue
    const start = moved.get(bar.startId) ?? nodes.get(bar.startId)
    const end = moved.get(bar.endId) ?? nodes.get(bar.endId)
    const geometry = start && end && barGeometry(start, end)
    if (!geometry) {
      return { error: `Ese destino dejaría una barra sin longitud válida (${bar.id}).` }
    }
    lengths.set(bar.id, geometry.length)
  }
  for (const load of model.loads) {
    if (load.kind === 'nodal') continue
    const length = lengths.get(load.barId)
    if (length !== undefined && !loadFitsLength(load, length)) {
      return { error: `Ese destino dejaría la carga ${load.id} fuera de la barra ${load.barId}. Ajusta la posición de la carga antes de mover el nudo.` }
    }
  }
  return { model: { ...model, nodes: model.nodes.map(node => moved.get(node.id) ?? node) }, item }
}
