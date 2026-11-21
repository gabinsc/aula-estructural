import { barGeometry, isModelPoint, translateFromReference } from '../geometry/coordinates'
import type { Point } from '../geometry/coordinates'
import { loadTarget, validateLoad } from './load'
import type { StructuralLoad } from './load'
import type { NodalSupport } from './support'
import type { MechanicalAssignment } from './mechanics'
import { catalogOf, linkageIssue } from './library'
import type { Bar, Edit, GeometrySelection, Selection, Structure, StructuralNode } from './structure'

export type Clipboard =
  | { readonly kind: 'geometry'; anchor: Point; nodes: readonly StructuralNode[];
      bars: readonly Bar[]; supports: readonly NodalSupport[]; loads: readonly StructuralLoad[];
      assignments: readonly MechanicalAssignment[] }
  | { readonly kind: 'loads'; loads: readonly StructuralLoad[]; target: GeometrySelection['kind'] }

export function copyEntities(model: Structure, selection: readonly Selection[]): Clipboard | { error: string } {
  const chosen = new Set(selection.map(item => item.id))
  const bars = model.bars.filter(bar => chosen.has(bar.id))
  const nodesToCopy = new Set(bars.flatMap(bar => [bar.startId, bar.endId]))
  for (const item of selection) if (item.kind === 'node') nodesToCopy.add(item.id)
  const nodes = model.nodes.filter(node => nodesToCopy.has(node.id))
  const anchor = nodes[0]
  if (!anchor) {
    const loads = model.loads.filter(load => chosen.has(load.id))
    const first = loads[0]
    if (!first) return { error: 'Selecciona elementos para copiar.' }
    const target = loadTarget(first).kind
    if (loads.some(load => loadTarget(load).kind !== target)) return { error: 'Copia por separado las cargas nodales y las cargas de barra.' }
    return { kind: 'loads', loads, target }
  }
  const barsToCopy = new Set(bars.map(bar => bar.id))
  const included = (load: StructuralLoad) => load.kind === 'nodal' ? nodesToCopy.has(load.nodeId) : barsToCopy.has(load.barId)
  if (model.loads.some(load => chosen.has(load.id) && !included(load))) {
    return { error: 'Incluye el propietario de cada carga seleccionada o copia esas cargas por separado.' }
  }
  return { kind: 'geometry', anchor, nodes, bars,
    assignments: model.mechanics.assignments.filter(assignment => barsToCopy.has(assignment.barId)),
    supports: model.supports.filter(support => nodesToCopy.has(support.nodeId)), loads: model.loads.filter(included) }
}

export function pasteGeometry(model: Structure, clipboard: Extract<Clipboard, { kind: 'geometry' }>,
  destination: Point): Edit<readonly Selection[]> {
  const nodes = new Map(clipboard.nodes.map((node, index) => {
    const id = `N${model.nextNode + index}`
    return [node.id, { ...translateFromReference(node, clipboard.anchor, destination), id, label: node.label === node.id ? id : node.label }]
  }))
  if ([...nodes.values()].some(node => !isModelPoint(node))) return { error: 'El pegado dejaría nudos fuera del rango del modelo.' }
  const originals = new Map(clipboard.nodes.map(node => [node.id, node]))
  const bars = new Map<string, Bar>()
  for (const bar of clipboard.bars) {
    const start = nodes.get(bar.startId)!
    const end = nodes.get(bar.endId)!
    const geometry = barGeometry(start, end)
    const original = barGeometry(originals.get(bar.startId)!, originals.get(bar.endId)!)!
    if (!geometry || Math.abs(geometry.length - original.length) > Math.max(1e-8, 8 * Number.EPSILON * original.length) ||
      Math.abs(Math.sin((geometry.angle - original.angle) / 2)) > 1e-8) {
      return { error: 'El pegado no conservaría la longitud u orientación de una barra con la precisión disponible.' }
    }
    const id = `B${model.nextBar + bars.size}`
    bars.set(bar.id, { ...bar, id, startId: start.id, endId: end.id, label: bar.label === bar.id ? id : bar.label })
  }
  const loads = clipboard.loads.map((load, index): StructuralLoad => {
    const id = `C${model.nextLoad + index}`
    return load.kind === 'nodal' ? { ...load, id, nodeId: nodes.get(load.nodeId)!.id } : { ...load, id, barId: bars.get(load.barId)!.id }
  })
  const copiedAssignments = clipboard.assignments.map(assignment => ({ ...assignment, barId: bars.get(assignment.barId)!.id }))
  if (copiedAssignments.some(assignment => linkageIssue(catalogOf(model), assignment))) {
    return { error: 'La biblioteca de las barras copiadas cambió. Vuelve a copiarlas antes de pegar.' }
  }
  const assignments = [...model.mechanics.assignments, ...copiedAssignments]
  const result: Structure = { ...model, nodes: [...model.nodes, ...nodes.values()], bars: [...model.bars, ...bars.values()],
    mechanics: { ...model.mechanics, assignments },
    supports: [...model.supports, ...clipboard.supports.map(support => ({ ...support, nodeId: nodes.get(support.nodeId)!.id }))],
    loads: [...model.loads, ...loads], nextNode: model.nextNode + nodes.size,
    nextBar: model.nextBar + bars.size, nextLoad: model.nextLoad + loads.length }
  const error = loads.map(load => validateLoad(result, load)).find(Boolean)
  if (error) return { error }
  return { model: result, item: [
    ...[...nodes.values()].map(node => ({ kind: 'node' as const, id: node.id })),
    ...[...bars.values()].map(bar => ({ kind: 'bar' as const, id: bar.id })),
  ] }
}

export function duplicateLoads(model: Structure, clipboard: Extract<Clipboard, { kind: 'loads' }>,
  target: GeometrySelection): Edit<readonly Selection[]> {
  if (target.kind !== clipboard.target) return { error: 'Selecciona un propietario compatible para duplicar las cargas.' }
  const loads = clipboard.loads.map((load, index): StructuralLoad => {
    const id = `C${model.nextLoad + index}`
    return load.kind === 'nodal' ? { ...load, id, nodeId: target.id } : { ...load, id, barId: target.id }
  })
  const error = loads.map(load => validateLoad(model, load)).find(Boolean)
  if (error) return { error }
  return { model: { ...model, loads: [...model.loads, ...loads], nextLoad: model.nextLoad + loads.length },
    item: loads.map(load => ({ kind: 'load', id: load.id })) }
}
