import type { SteelAxisRestraint, SteelConnection, SteelMemberSettings } from './contracts'
import { catalogOf } from '../../domain/library'
import type { Structure } from '../../domain/structure'

/** Vincula condiciones declaradas a la barra y su sección. Las cargas se versionan aparte. */
export function steelMemberRevision(model: Structure, barId: string) {
  const bar = model.bars.find(item => item.id === barId)
  const assignment = model.mechanics.assignments.find(item => item.barId === barId)
  const section = catalogOf(model).sections.find(item => item.id === assignment?.sectionId)
  const coordinates = (id: string | undefined) => {
    const node = model.nodes.find(item => item.id === id)
    return node && [id, node.x, node.y]
  }
  const shape = section?.geometry
  const geometry = !shape ? undefined : shape.kind === 'manual' ? Object.entries(shape.values).sort()
    : shape.kind === 'compound' ? shape.parts.map(part => part.kind === 'rect'
      ? [part.kind, part.x, part.y, !!part.hole, part.b, part.h] : [part.kind, part.x, part.y, !!part.hole, part.r])
      : [shape.kind, Object.entries(shape.dimensions).sort()]
  return JSON.stringify([coordinates(bar?.startId), coordinates(bar?.endId),
    assignment?.kind, assignment?.materialId, assignment?.sectionId, assignment?.sectionAxis,
    assignment?.E, assignment?.A, assignment?.I, geometry])
}

function object(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${label} debe ser un objeto.`)
  return raw as Record<string, unknown>
}

function scalar(raw: unknown, label: string, zero = false): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || (zero ? raw < 0 : raw <= 0)) {
    throw new Error(`${label}: introduce una magnitud ${zero ? 'no negativa' : 'positiva'} y finita.`)
  }
  return raw
}

function axis(raw: unknown, label: string): SteelAxisRestraint {
  const item = object(raw, label)
  if (typeof item.ends !== 'string' || !item.ends.trim() || item.ends.trim().length > 160) {
    throw new Error(`Describe las condiciones de extremo del eje ${label}.`)
  }
  return { length: scalar(item.length, `Longitud ${label}`), k: scalar(item.k, `K ${label}`), ends: item.ends.trim() }
}

function connection(raw: unknown): SteelConnection {
  const item = object(raw, 'Conexión')
  const netArea = scalar(item.netArea, 'Área neta')
  if (item.kind === 'direct') return { kind: item.kind, netArea }
  if (item.kind !== 'partial-bolted') throw new Error('Configuración de conexión fuera del alcance.')
  const eccentricity = scalar(item.eccentricity, 'Excentricidad', true)
  const length = scalar(item.length, 'Longitud de conexión')
  if (eccentricity >= length) throw new Error('La excentricidad debe ser menor que la longitud de conexión.')
  return { kind: item.kind, netArea, eccentricity, length }
}

export function readSteelMember(raw: unknown): SteelMemberSettings {
  const item = object(raw, 'Configuración de acero')
  if (typeof item.barId !== 'string' || !/^B[1-9]\d*$/.test(item.barId)) throw new Error('ID de barra de acero inválido.')
  const { method, grade } = item
  if (method !== 'LRFD' && method !== 'ASD') throw new Error('Selecciona LRFD o ASD.')
  if (grade !== undefined && grade !== 'ASTM A36' && grade !== 'ASTM A572 Grado 50') throw new Error('Grado de acero fuera del alcance.')
  const revision = item.memberRevision
  if (revision !== undefined && (typeof revision !== 'string' || !revision.length || revision.length > 50000)) {
    throw new Error('La revisión de la barra de acero es inválida.')
  }
  const flags = ['weldedI', 'flexureRestrained', 'unreinforcedWeb'] as const
  for (const name of flags) if (item[name] !== undefined && typeof item[name] !== 'boolean') throw new Error('Confirmación de acero inválida.')
  return { barId: item.barId, method, ...(grade && { grade }), ...(revision && { memberRevision: revision }),
    ...(item.connection === undefined ? {} : { connection: connection(item.connection) }),
    ...(item.x === undefined ? {} : { x: axis(item.x, 'x') }),
    ...(item.y === undefined ? {} : { y: axis(item.y, 'y') }),
    ...(item.lateralLength === undefined ? {} : { lateralLength: scalar(item.lateralLength, 'Longitud lateral') }),
    ...(item.weldedI === true && { weldedI: true }),
    ...(item.flexureRestrained === true && { flexureRestrained: true }),
    ...(item.unreinforcedWeb === true && { unreinforcedWeb: true }),
  }
}

export function readSteelMembers(raw: unknown): readonly SteelMemberSettings[] {
  if (!Array.isArray(raw)) throw new Error('Las verificaciones de acero deben estar en una lista.')
  const members = raw.map(readSteelMember)
  if (new Set(members.map(item => item.barId)).size !== members.length) throw new Error('Hay configuraciones de acero duplicadas.')
  return members
}
