import { useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import { loadBarGeometry } from '../../domain/load'
import type { Structure } from '../../domain/structure'
import { formatNumber, parseNumber } from '../format'
import type { Action } from '../tools/editor'

export function SplitForm({ model, barId, hinge, dispatch }: {
  model: Structure; barId: string; hinge?: true; dispatch: Dispatch<Action>
}) {
  const [value, setValue] = useState('')
  const geometry = loadBarGeometry(model, barId)
  if (!geometry) return null
  const length = geometry.length
  function submit(event: FormEvent) {
    event.preventDefault()
    dispatch({ type: 'split-bar', barId, s: parseNumber(value) ?? NaN })
  }
  return <section className="side-section" aria-label={hinge ? 'Insertar rótula interior' : 'Dividir barra'}>
    <h3>{hinge ? 'Insertar rótula en' : 'Dividir'} {barId}</h3>
    <form className="precision-form" onSubmit={submit}>
      <label>Distancia de corte s (m)<input inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} /></label>
      <p className="field-help">Desde el nudo inicial. Longitud {formatNumber(length, 8)} m. También puedes señalar la barra en el lienzo.</p>
      <button type="submit" className="button primary">{hinge ? 'Insertar rótula' : 'Aplicar división'}</button>
      <button type="button" className="button secondary" onClick={() => dispatch({ type: 'split-bar', barId, s: length / 2 })}>
        {hinge ? 'Insertar rótula en el punto medio' : 'Dividir en el punto medio'}</button>
      <button type="button" className="button secondary" onClick={() => dispatch({ type: 'cancel' })}>
        {hinge ? 'Cancelar inserción' : 'Cancelar división'}</button>
    </form>
  </section>
}
