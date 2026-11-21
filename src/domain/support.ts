import type { Point } from '../geometry/coordinates'
import { getNode } from './structure'
import type { Edit, Structure } from './structure'

export type SupportDefinition =
  | { readonly kind: 'pinned' }
  | { readonly kind: 'roller'; readonly surfaceAngle: number }
  | { readonly kind: 'fixed' }

export type NodalSupport = SupportDefinition & { readonly nodeId: string }

const FULL_TURN = 2 * Math.PI
// Margen de redondeo de una vuelta en aritmética de punto flotante.
const ANGLE_ROUNDOFF = FULL_TURN * Number.EPSILON

export function getNodeSupport(model: Structure, nodeId: string): NodalSupport | undefined {
  return model.supports.find(support => support.nodeId === nodeId)
}

/** Ejes unitarios de traslación restringida en coordenadas globales. */
export function supportRestraints(support: SupportDefinition): {
  readonly translation: readonly Point[]
  readonly rotation: boolean
} {
  if (support.kind === 'roller') {
    return {
      translation: [{ x: -Math.sin(support.surfaceAngle), y: Math.cos(support.surfaceAngle) }],
      rotation: false,
    }
  }
  return { translation: [{ x: 1, y: 0 }, { x: 0, y: 1 }], rotation: support.kind === 'fixed' }
}

/** Ángulo dirigido de la superficie en (-π, π], antihorario desde +X global. */
function normalizeSurfaceAngle(angle: number): number {
  const wrapped = angle % FULL_TURN
  if (wrapped <= -Math.PI) return wrapped + FULL_TURN
  if (wrapped > Math.PI) return wrapped - FULL_TURN
  return wrapped || 0
}

export function changeNodeSupport(
  model: Structure, nodeId: string, definition: SupportDefinition | null, expected: NodalSupport | undefined,
): Edit<NodalSupport | null> {
  if (!getNode(model, nodeId)) return { error: 'El nudo asociado al apoyo ya no existe.' }
  const current = getNodeSupport(model, nodeId)
  if (current !== expected) return { error: 'El apoyo del nudo cambió. Revisa sus propiedades antes de continuar.' }
  if (!definition) {
    if (!current) return { model, item: null }
    return { model: { ...model, supports: model.supports.filter(support => support.nodeId !== nodeId) }, item: null }
  }
  if (definition.kind === 'roller' && !Number.isFinite(definition.surfaceAngle)) {
    return { error: 'Introduce una inclinación finita para la superficie del rodillo.' }
  }

  const item: NodalSupport = definition.kind === 'roller'
    ? { nodeId, kind: 'roller', surfaceAngle: normalizeSurfaceAngle(definition.surfaceAngle) }
    : { nodeId, kind: definition.kind }
  if (current?.kind === item.kind &&
    (item.kind !== 'roller' || (current.kind === 'roller' &&
      Math.abs(normalizeSurfaceAngle(current.surfaceAngle - item.surfaceAngle)) <= ANGLE_ROUNDOFF))) {
    return { model, item: current }
  }
  const supports = current
    ? model.supports.map(support => support.nodeId === nodeId ? item : support)
    : [...model.supports, item]
  return { model: { ...model, supports }, item }
}
