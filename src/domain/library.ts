import { calculateSection } from '../geometry/sections'
import type { SectionGeometry, SectionProperties } from '../geometry/sections'
import type { MechanicalAssignment } from './mechanics'
import type { Edit, Structure } from './structure'

export type Material = Readonly<{
  id: string; name: string; description: string; category: string; E: number; nu?: number; density?: number
  source: string; revisedAt: string; editable: boolean; illustrative: boolean
}>
export type Section = Readonly<{
  id: string; name: string; geometry: SectionGeometry; values: SectionProperties
  axes: 'centroidal-xy'; unit: 'SI'; calculationVersion: 1
}>
export type SectionAxis = 'x' | 'y'
export type Library = Readonly<{
  version: 1; materials: readonly Material[]; sections: readonly Section[]; defaultMaterialId?: string; defaultSectionId?: string
}>

const EXAMPLE_SOURCE = 'Aula Estructural · valores ilustrativos'
export const DEFAULT_LIBRARY: Library = { version: 1, sections: [], materials: [
  { id: 'acero', name: 'Acero estructural', category: 'Metal', E: 200e9, nu: .3, density: 7850 },
  { id: 'concreto', name: 'Concreto', category: 'Cementicio', E: 25e9, nu: .2, density: 2400 },
  { id: 'aluminio', name: 'Aluminio', category: 'Metal', E: 69e9, nu: .33, density: 2700 },
  { id: 'personalizado', name: 'Material personalizado', category: 'Personalizado', E: 1e9 },
].map(entry => ({ ...entry, description: 'Ejemplo editable', source: EXAMPLE_SOURCE, revisedAt: '2026-11-21T00:00:00.000Z',
  editable: true, illustrative: true })) }

export function catalogOf(model: Structure): Library {
  return model.library ?? DEFAULT_LIBRARY
}

export function catalogId(id: string) { return /^[a-zA-Z0-9_-]{1,80}$/.test(id) }
const titleOK = (name: string) => name.trim().length > 0 && name.length <= 80

export function materialIssue(material: Material): string | undefined {
  if (!catalogId(material.id) || !titleOK(material.name) || !titleOK(material.category)) return 'Introduce nombre y categoría válidos.'
  if (!Number.isFinite(material.E) || !(material.E > 0)) return 'E debe ser finito y mayor que cero.'
  if (material.nu !== undefined && !(material.nu > -1 && material.nu < .5)) return 'ν debe cumplir −1 < ν < 0,5.'
  if (material.density !== undefined && (!Number.isFinite(material.density) || !(material.density > 0))) return 'La densidad debe ser finita y positiva.'
  const revision = Date.parse(material.revisedAt)
  if (!material.source.trim() || material.source.length > 500 || material.description.length > 1000 ||
    !Number.isFinite(revision) || new Date(revision).toISOString() !== material.revisedAt) return 'Introduce una fuente y una revisión válidas.'
}

export function makeSection(id: string, name: string, geometry: SectionGeometry): Section {
  if (!catalogId(id) || !titleOK(name)) throw new Error('Introduce un nombre de sección válido.')
  return { id, name: name.trim(), geometry, values: calculateSection(geometry).values, axes: 'centroidal-xy',
    unit: 'SI', calculationVersion: 1 }
}

function sectionValues(item: MechanicalAssignment, section: Section, axis?: SectionAxis): MechanicalAssignment {
  return { ...item, sectionId: section.id, sectionAxis: axis, A: section.values.A,
    ...(item.kind === 'frame2d' && axis ? { I: axis === 'x' ? section.values.Ixx : section.values.Iyy } : {}) }
}

export function linkageIssue(library: Library, item: MechanicalAssignment): string | undefined {
  if (item.materialId) {
    const material = library.materials.find(entry => entry.id === item.materialId)
    if (!material || item.E !== material.E) return `${item.barId}: material inexistente o E incompatible con su material.`
  }
  if (item.sectionId) {
    const section = library.sections.find(entry => entry.id === item.sectionId)
    if (!section || item.A !== section.values.A) return `${item.barId}: sección inexistente o A incompatible con su sección.`
    if (item.kind === 'frame2d' && (!item.sectionAxis || item.I !== sectionValues(item, section, item.sectionAxis).I)) {
      return `${item.barId}: I o eje incompatible con su sección.`
    }
  }
  if (item.sectionAxis && (!item.sectionId || item.kind !== 'frame2d')) return `${item.barId}: eje de sección sin pórtico vinculado.`
}

type Category = 'material' | 'section'
export type LibraryEdit =
  | { type: 'save-material'; material: Material; updateLinked: boolean }
  | { type: 'save-section'; id: string; name: string; geometry: SectionGeometry; updateLinked: boolean }
  | { type: 'delete'; category: Category; id: string }
  | { type: 'default'; category: Category; id?: string }
  | { type: 'assign'; barIds: readonly string[]; materialId?: string; sectionId?: string; axis?: SectionAxis }

function publish(model: Structure, library: Library, assignments = model.mechanics.assignments): Edit<Structure> {
  const next = { ...model, library, mechanics: assignments === model.mechanics.assignments ? model.mechanics
    : { ...model.mechanics, assignments } }
  return { model: next, item: next }
}

export function editLibrary(model: Structure, change: LibraryEdit): Edit<Structure> {
  const library = catalogOf(model)
  const assignments = model.mechanics.assignments
  if (change.type === 'assign') {
    const material = library.materials.find(item => item.id === change.materialId)
    const section = library.sections.find(item => item.id === change.sectionId)
    const ids = new Set(change.barIds)
    const targets = assignments.filter(item => ids.has(item.barId))
    if (targets.length !== ids.size || !ids.size || [...ids].some(id => !model.bars.some(bar => bar.id === id))) {
      return { error: 'Confirma el tipo resistente de cada barra antes de asignar desde la biblioteca.' }
    }
    if ((change.materialId && !material) || (change.sectionId && !section) || (!material && !section)) {
      return { error: 'Selecciona un material o una sección existente.' }
    }
    if (section && !change.axis && targets.some(item => item.kind === 'frame2d')) return { error: 'Selecciona explícitamente un eje centroidal para I de los pórticos.' }
    const updated = assignments.map(item => {
      if (!ids.has(item.barId)) return item
      const assigned = material ? { ...item, materialId: material.id, E: material.E } : item
      return section ? sectionValues(assigned, section, item.kind === 'frame2d' ? change.axis : undefined) : assigned
    })
    if (updated.every((item, i) => {
      const previous = assignments[i]!
      return item === previous || (item.materialId === previous.materialId && item.sectionId === previous.sectionId &&
        item.sectionAxis === previous.sectionAxis && item.E === previous.E && item.A === previous.A && item.I === previous.I)
    })) return { model, item: model }
    return publish(model, library, updated)
  }
  if (change.type === 'save-material') {
    const item = change.material
    const issue = materialIssue(item)
    if (issue) return { error: issue }
    const saved = library.materials.find(entry => entry.id === item.id)
    if (saved && !saved.editable) return { error: 'Este material es de solo lectura. Duplícalo para crear una copia editable.' }
    const physics = saved && (saved.E !== item.E || saved.nu !== item.nu || saved.density !== item.density)
    const linked = physics && assignments.some(entry => entry.materialId === item.id)
    if (linked && !change.updateLinked) return { error: 'Confirma la actualización de las barras vinculadas o guarda una copia.' }
    return publish(model, { ...library, materials: saved ? library.materials.map(entry => entry.id === item.id ? item : entry)
      : [...library.materials, item] }, linked ? assignments.map(entry => entry.materialId === item.id ? { ...entry, E: item.E } : entry) : assignments)
  }
  if (change.type === 'save-section') {
    let item: Section
    try { item = makeSection(change.id, change.name, change.geometry) }
    catch (cause) { return { error: (cause as Error).message } }
    const saved = library.sections.find(entry => entry.id === item.id)
    const linked = saved && JSON.stringify(saved.geometry) !== JSON.stringify(item.geometry) &&
      assignments.some(entry => entry.sectionId === item.id)
    if (linked && !change.updateLinked) return { error: 'Confirma la actualización de las barras vinculadas o guarda una copia.' }
    return publish(model, { ...library, sections: saved ? library.sections.map(entry => entry.id === item.id ? item : entry)
      : [...library.sections, item] }, linked ? assignments.map(entry => entry.sectionId === item.id
        ? sectionValues(entry, item, entry.sectionAxis) : entry) : assignments)
  }
  const material = change.category === 'material'
  const key = material ? 'defaultMaterialId' : 'defaultSectionId'
  const entries = material ? library.materials : library.sections
  if (change.id && !entries.some(entry => entry.id === change.id)) return { error: 'La entrada ya no existe.' }
  if (change.type === 'default') return library[key] === change.id ? { model, item: model } : publish(model, { ...library, [key]: change.id })
  if (library[key] === change.id || assignments.some(item => (material ? item.materialId : item.sectionId) === change.id)) {
    return { error: 'Retira el predeterminado y las asignaciones antes de eliminar una entrada en uso.' }
  }
  return publish(model, material ? { ...library, materials: library.materials.filter(entry => entry.id !== change.id) }
    : { ...library, sections: library.sections.filter(entry => entry.id !== change.id) })
}
