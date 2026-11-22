import { useState } from 'react'
import type { Dispatch } from 'react'
import { fromMechanicalDisplay, mechanicalIssue, toMechanicalDisplay } from '../../domain/mechanics'
import type { ElementKind, MechanicalAssignment, MechanicalField, MechanicalPatch } from '../../domain/mechanics'
import type { Structure } from '../../domain/structure'
import type { Action } from '../tools/editor'
import { LibraryAssignment } from './LibraryAssignment'
import { AcademicHelp } from '../../app/academic/AcademicHelp'

const FIELDS = [
  { key: 'E', label: 'E (GPa)' },
  { key: 'A', label: 'A (cm²)' },
  { key: 'I', label: 'I (cm⁴)' },
] as const

function common<K extends keyof MechanicalAssignment>(items: readonly (MechanicalAssignment | undefined)[], key: K) {
  const value = items[0]?.[key]
  return items.every(item => item?.[key] === value) ? { value, mixed: false } : { value: undefined, mixed: true }
}

function display(field: MechanicalField, value: number | undefined) {
  if (value === undefined) return ''
  const scaled = toMechanicalDisplay(field, value)
  return Number.isFinite(scaled) && scaled > 0 ? String(Number(scaled.toPrecision(15))) : ''
}

export function MechanicalInspector({ model, barIds, dispatch }: {
  model: Structure
  barIds: readonly string[]
  dispatch: Dispatch<Action>
}) {
  const byId = new Map(model.mechanics.assignments.map(item => [item.barId, item]))
  const assignments = barIds.map(id => byId.get(id))
  return <details className="mechanical-section">
    <summary>Propiedades mecánicas</summary>
    <AcademicHelp title="Qué significan E, A e I">
      <p>E es el módulo elástico y A el área de la sección. Su producto EA determina la rigidez axial. I es el segundo momento de área respecto al eje de flexión elegido. En pórticos, EI determina la rigidez a flexión.</p>
    </AcademicHelp>
    <MechanicalForm key={JSON.stringify([barIds, assignments])} assignments={assignments} barIds={barIds} dispatch={dispatch} />
    <LibraryAssignment model={model} assignments={assignments} barIds={barIds} dispatch={dispatch} />
  </details>
}

function MechanicalForm({ assignments, barIds, dispatch }: {
  assignments: readonly (MechanicalAssignment | undefined)[]
  barIds: readonly string[]
  dispatch: Dispatch<Action>
}) {
  const [draft, setDraft] = useState<Partial<Record<MechanicalField, string>>>({})
  const [chosen, setChosen] = useState<ElementKind>()
  const [error, setError] = useState('')
  const selection = common(assignments, 'kind')
  const kind = chosen ?? selection.value
  const multiple = barIds.length > 1
  const missing = assignments.some(item => !item || item.E === undefined || item.A === undefined ||
    (item.kind === 'frame2d' && item.I === undefined))
  const EI = product('I')
  const EA = product('A')

  function product(field: 'A' | 'I') {
    const E = common(assignments, 'E').value
    const value = common(assignments, field).value
    if (E === undefined || value === undefined) return '—'
    const result = E * value
    return Number.isFinite(result) && result > 0 ? result.toExponential(4) : 'Fuera del rango numérico'
  }

  function apply() {
    if (!chosen && assignments.some(item => !item)) {
      setError('Selecciona un tipo resistente para las barras pendientes.')
      return
    }
    const fields: Partial<Record<MechanicalField, number | undefined>> = {}
    for (const { key } of FIELDS) {
      const value = draft[key]?.trim()
      if (value === undefined || (key === 'I' && kind !== 'frame2d')) continue
      const normalized = value.replace(',', '.')
      const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
      fields[key] = value === '' ? undefined : decimal.test(normalized) ? fromMechanicalDisplay(key, Number(normalized)) : NaN
    }
    const patch: MechanicalPatch = { ...fields, ...(chosen && { kind: chosen }) }
    const issue = mechanicalIssue({ ...fields, kind: kind ?? 'frame2d' })
    setError(issue ?? '')
    if (!issue) dispatch({ type: 'mechanics', patch, barIds })
  }

  return <form className="precision-form mechanical-form" noValidate onSubmit={event => { event.preventDefault(); apply() }}>
    <label>Tipo resistente
      <select value={kind ?? ''} onChange={event => setChosen(event.target.value as ElementKind)}>
        <option value="" disabled>{selection.mixed ? 'Tipos diferentes' : 'Sin asignar'}</option>
        <option value="truss2d">Armadura 2D</option>
        <option value="frame2d">Pórtico 2D</option>
      </select>
    </label>
    {FIELDS.filter(field => field.key !== 'I' || kind === 'frame2d').map(({ key, label }) => {
      const { value, mixed } = common(assignments, key)
      return <label key={key}>{label}
        <input inputMode="decimal" placeholder={mixed ? 'Valores diferentes' : 'Pendiente'}
          value={draft[key] ?? display(key, value)} onChange={event => setDraft({ ...draft, [key]: event.target.value })} />
      </label>
    })}
    {assignments.some(Boolean) && <dl className="properties">
      <dt>EA (N)</dt><dd>{EA}</dd>
      {kind === 'frame2d' && <><dt>EI (N·m²)</dt><dd>{EI}</dd></>}
    </dl>}
    {multiple && <p className="field-help">Se aplicarán solo los campos editados a las {barIds.length} barras seleccionadas.</p>}
    {missing && <p className="field-help">Propiedades pendientes para el análisis.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="button primary">{multiple ? 'Aplicar a las barras seleccionadas' : 'Guardar propiedades'}</button>
    {(chosen || Object.keys(draft).length > 0) && <button type="button" className="button secondary" onClick={() => {
      setDraft({})
      setChosen(undefined)
      setError('')
    }}>Cancelar cambios</button>}
    {assignments.some(Boolean) && <button type="button" className="button secondary"
      onClick={() => dispatch({ type: 'mechanics', barIds, patch: null })}>Quitar asignación{multiple ? ' de la selección' : ''}</button>}
  </form>
}
