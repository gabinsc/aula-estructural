import { barGeometry, GEOMETRIC_TOLERANCE, isModelPoint, toGlobal } from '../geometry/coordinates'
import type { Point } from '../geometry/coordinates'
import { distributedIntensity, globalLoadVector, loadBarGeometry, validateLoad } from './load'
import type { StructuralLoad } from './load'
import type { Bar, Edit, Structure, StructuralNode } from './structure'

type Distributed = Extract<StructuralLoad, { kind: 'distributed' }>

function withinLength(position: number, length: number): number {
  const rounding = 8 * Number.EPSILON * Math.max(length, position)
  return position > length && position - length <= rounding ? length : position
}

function restrictDistribution(load: Distributed, barId: string, from: number, to: number,
  origin: number, originalEnd: number, segmentLength: number): Distributed {
  const span = load.s1 - load.s0
  const q0 = distributedIntensity(load, (from - load.s0) / span)
  const q1 = distributedIntensity(load, (to - load.s0) / span)
  const profile = q0.x === q1.x && q0.y === q1.y ? 'uniform' : 'linear'
  return { ...load, barId, s0: withinLength(from - origin, segmentLength),
    s1: to === originalEnd ? segmentLength : withinLength(to - origin, segmentLength), q0, q1, profile }
}

export function splitBar(model: Structure, barId: string, s: number): Edit<{ node: StructuralNode; bars: readonly [Bar, Bar] }> {
  const bar = model.bars.find(item => item.id === barId)
  const geometry = loadBarGeometry(model, barId)
  if (!bar || !geometry) return { error: 'La barra que quieres dividir no existe.' }
  const { length, frame, angle } = geometry
  if (!Number.isFinite(s) || s <= GEOMETRIC_TOLERANCE || length - s <= GEOMETRIC_TOLERANCE) {
    return { error: 'El corte debe quedar dentro de la barra y dejar dos tramos de longitud válida.' }
  }
  const point = toGlobal({ x: s, y: 0 }, frame)
  const end = model.nodes.find(node => node.id === bar.endId)!
  const firstGeometry = barGeometry(frame.origin, point)
  const secondGeometry = barGeometry(point, end)
  if (!isModelPoint(point) || !firstGeometry || !secondGeometry) return { error: 'El corte no se puede representar con precisión en el modelo.' }
  const linearError = Math.max(Math.abs(firstGeometry.length - s), Math.abs(secondGeometry.length - (length - s)))
  const rounding = Math.max(GEOMETRIC_TOLERANCE, 8 * Number.EPSILON * length)
  const angularError = Math.max(Math.abs(Math.sin((firstGeometry.angle - angle) / 2)),
    Math.abs(Math.sin((secondGeometry.angle - angle) / 2)))
  if (linearError > rounding || angularError > 1e-8) {
    return { error: 'El corte excede la precisión disponible para conservar las longitudes y la orientación.' }
  }

  const nodeId = `N${model.nextNode}`
  const node = { ...point, id: nodeId, label: nodeId }
  const firstId = `B${model.nextBar}`
  const secondId = `B${model.nextBar + 1}`
  const first = { ...bar, id: firstId, endId: nodeId, label: bar.label === bar.id ? firstId : bar.label }
  const second = { ...bar, id: secondId, startId: nodeId, label: bar.label === bar.id ? secondId : bar.label }
  let nextLoad = model.nextLoad
  const loads = model.loads.flatMap((load): readonly StructuralLoad[] => {
    if (load.kind === 'nodal' || load.barId !== barId) return [load]
    if (load.kind === 'point') {
      const cutTolerance = Math.min(GEOMETRIC_TOLERANCE, s / 2, (length - s) / 2)
      if (Math.abs(load.s - s) <= cutTolerance) {
        return [{ kind: 'nodal', id: load.id, nodeId, force: globalLoadVector(load.force, load.frame, angle), moment: 0 }]
      }
      if (load.s < s) return [{ ...load, barId: firstId, s: withinLength(load.s, firstGeometry.length) }]
      return [{ ...load, barId: secondId,
        s: load.s === length ? secondGeometry.length : withinLength(load.s - s, secondGeometry.length) }]
    }
    const parts: Distributed[] = []
    if (load.s0 < s) parts.push(restrictDistribution(load, firstId, load.s0,
      Math.min(s, load.s1), 0, s, firstGeometry.length))
    if (load.s1 > s) {
      const right = restrictDistribution(load, secondId, Math.max(s, load.s0),
        load.s1, s, length, secondGeometry.length)
      parts.push(parts.length ? { ...right, id: `C${nextLoad++}` } : right)
    }
    return parts
  })
  const mechanics = { ...model.mechanics, assignments: model.mechanics.assignments.flatMap(item =>
    item.barId === barId ? [{ ...item, barId: firstId }, { ...item, barId: secondId }] : [item]) }
  const result: Structure = { ...model, nodes: [...model.nodes, node], mechanics,
    bars: model.bars.flatMap(item => item.id === barId ? [first, second] : [item]),
    loads, nextNode: model.nextNode + 1, nextBar: model.nextBar + 2, nextLoad }
  for (const load of loads) {
    const original = model.loads.find(item => item.id === load.id)
    if (original === load) continue
    const error = validateLoad(result, load)
    if (error) return { error: `No se pudo reasignar ${load.id}. ${error}` }
  }
  return { model: result, item: { node, bars: [first, second] } }
}

export function reverseBar(model: Structure, barId: string): Edit<Bar> {
  const bar = model.bars.find(item => item.id === barId)
  const geometry = loadBarGeometry(model, barId)
  if (!bar || !geometry) return { error: 'La barra que quieres invertir no existe.' }
  const reversed = { ...bar, startId: bar.endId, endId: bar.startId }
  const loads = model.loads.map((load): StructuralLoad => {
    if (load.kind === 'nodal' || load.barId !== barId) return load
    const vector = (value: Point): Point => load.frame === 'global' ? value : { x: -value.x || 0, y: -value.y || 0 }
    if (load.kind === 'point') return { ...load, s: geometry.length - load.s, force: vector(load.force) }
    return { ...load, s0: geometry.length - load.s1, s1: geometry.length - load.s0, q0: vector(load.q1), q1: vector(load.q0) }
  })
  const result = { ...model, bars: model.bars.map(item => item.id === barId ? reversed : item), loads }
  for (const load of loads) {
    if (load.kind !== 'nodal' && load.barId === barId) {
      const error = validateLoad(result, load)
      if (error) return { error: `No se pudo invertir ${load.id}. ${error}` }
    }
  }
  return { model: result, item: reversed }
}
