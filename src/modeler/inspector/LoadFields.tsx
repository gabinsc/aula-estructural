import { useEffect } from 'react'
import type { Dispatch } from 'react'
import { sameLoad, toBaseUnits, toKiloUnits, validateLoad } from '../../domain/load'
import type { LoadDefinition } from '../../domain/load'
import type { Structure } from '../../domain/structure'
import type { Point } from '../../geometry/coordinates'
import { parseNumber } from '../format'
import type { Action } from '../tools/editor'

export function readMagnitude(text: string, previous?: number): number | null {
  const number = parseNumber(text)
  if (number === null) return null
  return previous !== undefined && number === toKiloUnits(previous) ? previous : toBaseUnits(number)
}

export function LoadActions({ id, dispatch }: { id?: string; dispatch: Dispatch<Action> }) {
  return <>
    <button type="submit" className="button primary">{id ? 'Aplicar cambios a la carga' : 'Crear carga'}</button>
    {id && <button type="button" className="button secondary" onClick={() => dispatch({ type: 'delete-load', id })}>Quitar carga</button>}
    <button type="button" className="button secondary" onClick={() => dispatch({ type: 'cancel' })}>Cancelar formulario</button>
  </>
}

export function useLoadPreview(model: Structure, active: LoadDefinition | undefined,
  definition: LoadDefinition | null, dispatch: Dispatch<Action>) {
  useEffect(() => {
    const valid = definition && !validateLoad(model, definition) && (!active || !sameLoad(active, definition))
    dispatch({ type: 'preview-load', definition: valid ? definition : null })
  }, [model, active, definition, dispatch])
}

export interface VectorDraft { readonly x: string; readonly y: string }

export function vectorDraft(vector?: Point): VectorDraft {
  return { x: String(toKiloUnits(vector?.x ?? 0)), y: String(toKiloUnits(vector?.y ?? 0)) }
}

export function readVector(draft: VectorDraft, previous?: Point): Point | null {
  const x = readMagnitude(draft.x, previous?.x)
  const y = readMagnitude(draft.y, previous?.y)
  return x === null || y === null ? null : { x, y }
}

export function VectorFields({ value, onChange, xLabel, yLabel }: {
  value: VectorDraft; onChange: (value: VectorDraft) => void; xLabel: string; yLabel: string
}) {
  return <div className="field-row">
    <label>{xLabel}<input inputMode="decimal" value={value.x} onChange={event => onChange({ ...value, x: event.target.value })} /></label>
    <label>{yLabel}<input inputMode="decimal" value={value.y} onChange={event => onChange({ ...value, y: event.target.value })} /></label>
  </div>
}
