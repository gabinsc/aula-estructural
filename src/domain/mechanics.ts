import type { Edit, Structure } from './structure'
import type { SectionAxis } from './library'

export type ElementKind = 'truss2d' | 'frame2d'
export type MechanicalField = 'E' | 'A' | 'I'
export type MechanicalValues = Readonly<{
  kind: ElementKind
  E?: number
  A?: number
  I?: number
}>

export type MechanicalAssignment = MechanicalValues & { readonly barId: string; readonly materialId?: string;
  readonly sectionId?: string; readonly sectionAxis?: SectionAxis }
export type MechanicalPatch = Partial<MechanicalValues>

export interface MechanicalSection {
  readonly version: 1
  readonly assignments: readonly MechanicalAssignment[]
}

export const EMPTY_MECHANICS: MechanicalSection = { version: 1, assignments: [] }

const SI_SCALE: Record<MechanicalField, number> = { E: 1e9, A: 1e-4, I: 1e-8 }
export const fromMechanicalDisplay = (field: MechanicalField, value: number) => value * SI_SCALE[field]
export const toMechanicalDisplay = (field: MechanicalField, value: number) => value / SI_SCALE[field]

export function mechanicalIssue(values: MechanicalValues): string | undefined {
  if (values.kind !== 'truss2d' && values.kind !== 'frame2d') return 'El tipo resistente no es válido.'
  if (values.kind === 'truss2d' && values.I !== undefined) return 'I corresponde a barras de pórtico.'
  for (const key of ['E', 'A', 'I'] as const) {
    const value = values[key]
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) return `${key} debe ser finito y mayor que cero.`
  }
}

export function sameMechanicalValues(a: MechanicalValues | undefined, b: MechanicalValues) {
  return a?.kind === b.kind && a.E === b.E && a.A === b.A && a.I === b.I
}

/** Conserva los campos sin editar de cada barra. Un campo presente con undefined se borra. */
export function editMechanicalValues(model: Structure, barIds: readonly string[],
  patch: MechanicalPatch | null): Edit<readonly string[]> {
  const ids = new Set(barIds)
  const existing = new Set(model.bars.map(bar => bar.id))
  if (!ids.size || [...ids].some(id => !existing.has(id))) return { error: 'Selecciona barras existentes.' }
  const old = model.mechanics.assignments
  const byId = new Map(old.map(assignment => [assignment.barId, assignment]))
  let changed = false
  for (const barId of ids) {
    const current = byId.get(barId)
    if (!patch) {
      changed = byId.delete(barId) || changed
      continue
    }
    const kind = patch.kind ?? current?.kind
    if (!kind) return { error: `Selecciona un tipo resistente para ${barId}.` }
    const values = { ...current, ...patch, kind, barId }
    const manualMaterial = Object.hasOwn(patch, 'E')
    const manualSection = Object.hasOwn(patch, 'A') || Object.hasOwn(patch, 'I') || current?.kind !== kind
    if (manualMaterial) delete values.materialId
    if (manualSection) { delete values.sectionId; delete values.sectionAxis }
    if (kind === 'truss2d' && patch.I === undefined) delete values.I
    const issue = mechanicalIssue(values)
    if (issue) return { error: `${barId}. ${issue}` }
    changed = !sameMechanicalValues(current, values) || current?.materialId !== values.materialId ||
      current?.sectionId !== values.sectionId || changed
    byId.set(barId, values)
  }
  if (!changed) return { model, item: [...ids] }
  const assignments = [...byId.values()]
  return { model: { ...model, mechanics: { ...model.mechanics, assignments } }, item: [...ids] }
}
