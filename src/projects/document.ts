import { barGeometry, isModelPoint } from '../geometry/coordinates'
import type { Point } from '../geometry/coordinates'
import { validateLoad } from '../domain/load'
import type { StructuralLoad } from '../domain/load'
import { EMPTY_STRUCTURE, MAX_LABEL_LENGTH } from '../domain/structure'
import type { Bar, Structure, StructuralNode } from '../domain/structure'
import type { NodalSupport } from '../domain/support'
import { EMPTY_MECHANICS, mechanicalIssue } from '../domain/mechanics'
import type { MechanicalAssignment, MechanicalSection } from '../domain/mechanics'
import { catalogId, catalogOf, DEFAULT_LIBRARY, linkageIssue, makeSection, materialIssue } from '../domain/library'
import type { Library, Material } from '../domain/library'
import { SECTION_FIELDS } from '../geometry/sections'
import type { ParametricSection, SectionGeometry } from '../geometry/sections'
import type { DesignSettings } from '../design/contracts'
import { readDesignSettings } from '../design/settings'

export const SCHEMA_VERSION = 6

export interface ProjectView {
  readonly grid: boolean
  readonly dimensions: 'hidden' | 'selection' | 'all'
}

export interface ProjectDocument {
  readonly schemaVersion: typeof SCHEMA_VERSION
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly modifiedAt: string
  readonly model: Structure
  readonly view: ProjectView
  readonly design?: DesignSettings
}

const ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/

export function projectName(value: string): string {
  const name = value.trim()
  ensure(name.length > 0 && name.length <= 80, 'El nombre del proyecto debe tener entre 1 y 80 caracteres.')
  return name
}

export function makeProject(name = 'Plano sin título', model = EMPTY_STRUCTURE,
  view: ProjectView = { grid: true, dimensions: 'hidden' }, design?: DesignSettings): ProjectDocument {
  const now = new Date().toISOString()
  return { schemaVersion: SCHEMA_VERSION, id: crypto.randomUUID(), name: projectName(name),
    createdAt: now, modifiedAt: now, model: { ...model, library: catalogOf(model) }, view, ...(design && { design }) }
}

function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

function object(value: unknown, label: string): Record<string, unknown> {
  ensure(value && typeof value === 'object' && !Array.isArray(value), `${label} debe ser un objeto.`)
  return value as Record<string, unknown>
}

function list(value: unknown, name: string): unknown[] {
  ensure(Array.isArray(value), `${name} debe ser una lista.`)
  return value
}

function number(value: unknown, name: string): number {
  ensure(typeof value === 'number' && Number.isFinite(value), `${name} debe ser un número finito.`)
  return value
}

function text(value: unknown, name: string): string {
  ensure(typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_LABEL_LENGTH, `${name} no es válido.`)
  return value
}

function date(value: unknown, name: string): string {
  const iso = text(value, name)
  const time = Date.parse(iso)
  ensure(Number.isFinite(time) && new Date(time).toISOString() === iso, `${name} debe ser una fecha ISO válida.`)
  return iso
}

function point(raw: unknown, name: string): Point {
  const value = object(raw, name)
  return { x: number(value.x, `${name}.x`), y: number(value.y, `${name}.y`) }
}

function entityId(value: unknown, prefix: 'N' | 'B' | 'C'): string {
  const id = text(value, 'Identificador')
  const index = Number(id.slice(1))
  ensure(id[0] === prefix && Number.isSafeInteger(index) && index > 0 && id === `${prefix}${index}`, `Identificador inválido ${id}.`)
  return id
}

function unique<T>(items: readonly T[], key: (value: T) => string, name: string): Set<string> {
  const ids = new Set(items.map(key))
  ensure(ids.size === items.length, `${name} contiene identificadores repetidos.`)
  return ids
}

function counter(raw: unknown, ids: ReadonlySet<string>, name: string) {
  const count = number(raw, name)
  ensure(Number.isSafeInteger(count) && count > 0 && count < Number.MAX_SAFE_INTEGER &&
    [...ids].every(id => Number(id.slice(1)) < count), `${name} debe ser entero y mayor que los IDs existentes.`)
  return count
}

function parseLoad(raw: unknown): StructuralLoad {
  const value = object(raw, 'Carga')
  const id = entityId(value.id, 'C')
  if (value.kind === 'nodal') return { id, kind: 'nodal', nodeId: entityId(value.nodeId, 'N'),
    force: point(value.force, `${id}.force`), moment: number(value.moment, `${id}.moment`) }
  const frame = value.frame
  ensure(frame === 'global' || frame === 'local', `Marco de carga inválido en ${id}.`)
  const barId = entityId(value.barId, 'B')
  if (value.kind === 'point') return { id, kind: 'point', frame, barId,
    s: number(value.s, `${id}.s`), force: point(value.force, `${id}.force`) }
  ensure(value.kind === 'distributed', `Tipo de carga desconocido en ${id}.`)
  const profile = value.profile
  ensure(profile === 'uniform' || profile === 'linear', `Perfil inválido en ${id}.`)
  return { id, kind: 'distributed', frame, profile, barId,
    s0: number(value.s0, `${id}.s0`), s1: number(value.s1, `${id}.s1`),
    q0: point(value.q0, `${id}.q0`), q1: point(value.q1, `${id}.q1`) }
}

function readCatalogId(value: unknown): string {
  ensure(typeof value === 'string' && catalogId(value), 'Identificador de biblioteca inválido.')
  return value
}

function optionalId(value: unknown) { return value === undefined ? undefined : readCatalogId(value) }

function parseMechanics(raw: unknown, barIds: ReadonlySet<string>, links: boolean): MechanicalSection {
  const data = object(raw, 'Propiedades mecánicas')
  ensure(data.version === 1, 'Versión de las propiedades mecánicas incompatible.')
  const assignments = list(data.assignments, 'Asignaciones mecánicas').map((entry): MechanicalAssignment => {
    const value = object(entry, 'Asignación mecánica')
    const barId = entityId(value.barId, 'B')
    ensure(barIds.has(barId), `Asignación para barra inexistente ${barId}.`)
    const kind = value.kind
    ensure(kind === 'truss2d' || kind === 'frame2d', `Tipo resistente inválido en ${barId}.`)
    const properties = {
      ...(value.E === undefined ? {} : { E: number(value.E, `${barId}.E`) }),
      ...(value.A === undefined ? {} : { A: number(value.A, `${barId}.A`) }),
      ...(value.I === undefined ? {} : { I: number(value.I, `${barId}.I`) }),
    }
    const sectionAxis = links ? value.sectionAxis : undefined
    ensure(sectionAxis === undefined || sectionAxis === 'x' || sectionAxis === 'y', `Eje de sección inválido en ${barId}.`)
    const materialId = links ? optionalId(value.materialId) : undefined
    const sectionId = links ? optionalId(value.sectionId) : undefined
    const assignment: MechanicalAssignment = { barId, kind, ...properties,
      ...(materialId ? { materialId } : {}), ...(sectionId ? { sectionId } : {}), ...(sectionAxis ? { sectionAxis } : {}) }
    const issue = mechanicalIssue(assignment)
    ensure(!issue, `${barId}. ${issue}`)
    return assignment
  })
  unique(assignments, entry => entry.barId, 'Asignaciones mecánicas')
  return { version: 1, assignments }
}

function parseGeometry(raw: unknown): SectionGeometry {
  const shape = object(raw, 'Geometría de sección')
  if (shape.kind === 'manual') {
    const v = object(shape.values, 'Propiedades manuales')
    return { kind: 'manual', values: { A: number(v.A, 'A'), cx: number(v.cx, 'cx'), cy: number(v.cy, 'cy'),
      Ixx: number(v.Ixx, 'Ixx'), Iyy: number(v.Iyy, 'Iyy'), Ixy: number(v.Ixy, 'Ixy') } }
  }
  if (shape.kind === 'compound') {
    const parts = list(shape.parts, 'Regiones de sección')
    ensure(parts.length <= 100, 'Se admiten hasta 100 regiones.')
    return { kind: 'compound', parts: parts.map(raw => {
      const item = object(raw, 'Región')
      ensure(item.hole === undefined || typeof item.hole === 'boolean', 'El estado de vacío no es válido.')
      const base = { ...point(item, 'Región'), ...(item.hole ? { hole: true } : {}) }
      if (item.kind === 'disk') return { ...base, kind: 'disk', r: number(item.r, 'Radio') }
      ensure(item.kind === 'rect', 'Primitiva de sección desconocida.')
      return { ...base, kind: 'rect', b: number(item.b, 'Ancho'), h: number(item.h, 'Altura') }
    }) }
  }
  ensure(typeof shape.kind === 'string' && Object.hasOwn(SECTION_FIELDS, shape.kind), 'Tipo de sección desconocido.')
  const kind = shape.kind as ParametricSection
  const dimensions = object(shape.dimensions, 'Dimensiones')
  return { kind, dimensions: Object.fromEntries(SECTION_FIELDS[kind].map(key => [key, number(dimensions[key], key)])) }
}

function parseLibrary(raw: unknown): Library {
  const data = object(raw, 'Biblioteca')
  ensure(data.version === 1, 'Versión de biblioteca incompatible.')
  const materials = list(data.materials, 'Materiales').map((raw): Material => {
    const item = object(raw, 'Material')
    ensure(typeof item.description === 'string' && typeof item.source === 'string' &&
      typeof item.illustrative === 'boolean' && typeof item.editable === 'boolean', 'Metadatos de material inválidos.')
    const material: Material = { id: readCatalogId(item.id), name: text(item.name, 'Nombre'),
      category: text(item.category, 'Categoría'), description: item.description, E: number(item.E, 'E'),
      ...(item.nu === undefined ? {} : { nu: number(item.nu, 'ν') }),
      ...(item.density === undefined ? {} : { density: number(item.density, 'Densidad') }),
      source: item.source, revisedAt: date(item.revisedAt, 'Revisión del material'), editable: item.editable, illustrative: item.illustrative }
    const issue = materialIssue(material)
    ensure(!issue, issue ?? '')
    return material
  })
  const sections = list(data.sections, 'Secciones').map(raw => {
    const item = object(raw, 'Sección')
    ensure(item.axes === 'centroidal-xy' && item.unit === 'SI' && item.calculationVersion === 1, 'Contrato de sección incompatible.')
    const section = makeSection(readCatalogId(item.id), text(item.name, 'Nombre'), parseGeometry(item.geometry))
    const values = object(item.values, 'Propiedades de sección')
    ensure(Object.entries(section.values).every(([key, value]) => value === values[key]), `Propiedades inconsistentes en ${section.name}.`)
    return section
  })
  const materialIds = unique(materials, item => item.id, 'Materiales')
  const sectionIds = unique(sections, item => item.id, 'Secciones')
  const defaultMaterialId = optionalId(data.defaultMaterialId), defaultSectionId = optionalId(data.defaultSectionId)
  ensure((!defaultMaterialId || materialIds.has(defaultMaterialId)) && (!defaultSectionId || sectionIds.has(defaultSectionId)),
    'La biblioteca contiene predeterminados inexistentes.')
  return { version: 1, materials, sections, ...(defaultMaterialId ? { defaultMaterialId } : {}),
    ...(defaultSectionId ? { defaultSectionId } : {}) }
}

export function parseModel(raw: unknown, version?: 1 | 2 | 3 | 4 | 5 | 6): Structure {
  const data = object(raw, 'Modelo')
  const schemaVersion = version ?? (data.library === undefined ? 2 : SCHEMA_VERSION)
  const nodes = list(data.nodes, 'Nudos').map((rawNode): StructuralNode => {
    const value = object(rawNode, 'Nudo')
    const id = entityId(value.id, 'N')
    const position = point(value, id)
    ensure(isModelPoint(position), `Coordenadas fuera del dominio en ${id}.`)
    return { ...position, id, label: text(value.label, `${id}.label`) }
  })
  const nodeIds = unique(nodes, node => node.id, 'Nudos')
  const byNode = new Map(nodes.map(node => [node.id, node]))
  const joints = new Set<string>()
  const bars = list(data.bars, 'Barras').map((rawBar): Bar => {
    const value = object(rawBar, 'Barra')
    const id = entityId(value.id, 'B')
    const startId = entityId(value.startId, 'N')
    const endId = entityId(value.endId, 'N')
    const start = byNode.get(startId)
    const end = byNode.get(endId)
    ensure(start && end && barGeometry(start, end), `Extremos inexistentes o longitud inválida en ${id}.`)
    const key = [startId, endId].sort().join(':')
    ensure(!joints.has(key), `Hay más de una barra entre los extremos de ${id}.`)
    joints.add(key)
    const { releaseI, releaseJ } = value
    ensure(version === undefined || schemaVersion >= 6 ? [releaseI, releaseJ].every(flag => flag === undefined || flag === true)
      : releaseI === undefined && releaseJ === undefined, `Liberaciones inválidas en ${id}.`)
    return { id, label: text(value.label, `${id}.label`), startId, endId,
      ...(releaseI === true && { releaseI }), ...(releaseJ === true && { releaseJ }) }
  })
  const barIds = unique(bars, bar => bar.id, 'Barras')
  const supports = list(data.supports, 'Apoyos').map((rawSupport): NodalSupport => {
    const value = object(rawSupport, 'Apoyo')
    const nodeId = entityId(value.nodeId, 'N')
    ensure(nodeIds.has(nodeId), `Nudo inexistente para el apoyo de ${nodeId}.`)
    if (value.kind === 'pinned' || value.kind === 'fixed') return { kind: value.kind, nodeId }
    ensure(value.kind === 'roller', `Tipo de apoyo inválido en ${nodeId}.`)
    const surfaceAngle = number(value.surfaceAngle, 'Orientación del rodillo')
    ensure(surfaceAngle > -Math.PI && surfaceAngle <= Math.PI, `Orientación fuera de (−π, π] en ${nodeId}.`)
    return { kind: 'roller', nodeId, surfaceAngle }
  })
  unique(supports, support => support.nodeId, 'Apoyos')
  const loads = list(data.loads, 'Cargas').map(parseLoad)
  const loadIds = unique(loads, load => load.id, 'Cargas')
  const mechanics = schemaVersion === 1 ? EMPTY_MECHANICS : parseMechanics(data.mechanics, barIds, schemaVersion >= 3)
  const frames = new Set(mechanics.assignments.filter(assignment => assignment.kind === 'frame2d').map(assignment => assignment.barId))
  ensure(bars.every(bar => !(bar.releaseI || bar.releaseJ) || frames.has(bar.id)),
    'Solo las barras de pórtico pueden tener liberaciones de momento.')
  const library = schemaVersion >= 3 ? parseLibrary(data.library) : DEFAULT_LIBRARY
  for (const item of mechanics.assignments) {
    const issue = linkageIssue(library, item)
    ensure(!issue, issue ?? '')
  }
  const model = { nodes, bars, supports, loads, mechanics, library, nextNode: counter(data.nextNode, nodeIds, 'Contador de nudos'),
    nextBar: counter(data.nextBar, barIds, 'Contador de barras'), nextLoad: counter(data.nextLoad, loadIds, 'Contador de cargas') }
  for (const load of loads) {
    const error = validateLoad(model, load)
    ensure(!error, `Carga ${load.id}. ${error}`)
  }
  return model
}

export function readProject(raw: unknown): ProjectDocument {
  const value = object(raw, 'Proyecto')
  const schemaVersion = value.schemaVersion
  ensure(schemaVersion === 1 || schemaVersion === 2 || schemaVersion === 3 || schemaVersion === 4 || schemaVersion === 5 || schemaVersion === SCHEMA_VERSION,
    'Versión de esquema incompatible. Se admiten las versiones 1, 2, 3, 4 y 5.')
  const id = text(value.id, 'ID de proyecto')
  ensure(ID_PATTERN.test(id), 'El ID de proyecto no es válido.')
  const createdAt = date(value.createdAt, 'Fecha de creación')
  const modifiedAt = date(value.modifiedAt, 'Fecha de modificación')
  ensure(modifiedAt >= createdAt, 'La modificación es anterior a la creación.')
  const view = object(value.view, 'Vista')
  const { grid, dimensions } = view
  ensure(typeof grid === 'boolean' && (dimensions === 'hidden' || dimensions === 'selection' || dimensions === 'all'),
    'Las preferencias de vista no son válidas.')
  return { schemaVersion: SCHEMA_VERSION, id, name: projectName(text(value.name, 'Nombre de proyecto')),
    createdAt, modifiedAt, model: parseModel(value.model, schemaVersion), view: { grid, dimensions },
    ...(schemaVersion >= 4 && value.design !== undefined && { design: readDesignSettings(value.design, schemaVersion >= 5) }) }
}

export function importProject(json: string): ProjectDocument {
  let data: unknown
  try { data = JSON.parse(json) }
  catch { throw new Error('El archivo no contiene JSON válido.') }
  return readProject(data)
}
