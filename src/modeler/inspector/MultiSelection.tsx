import { useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import { Icon } from '../../app/Icon'
import { MAX_LABEL_LENGTH } from '../../domain/structure'
import { barGeometry, degrees } from '../../geometry/coordinates'
import { formatNumber } from '../format'
import type { Action, Editor } from '../tools/editor'

function common<T>(values: readonly T[]): T | undefined {
  const first = values[0]
  return values.every(value => value === first) ? first : undefined
}

function metric(values: readonly (number | undefined)[], unit: string, digits: number): string {
  if (values.some(value => value === undefined)) return 'Sin valor calculado'
  const value = common(values)
  return value === undefined ? 'Valores distintos' : `${formatNumber(value, digits)}${unit}`
}

function GroupLabel({ label, dispatch }: { label?: string; dispatch: Dispatch<Action> }) {
  const [value, setValue] = useState(label ?? '')

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'selection-label', label: value })
  }

  return <form className="precision-form group-label" onSubmit={apply}>
    <label>Etiqueta común<input value={value} maxLength={MAX_LABEL_LENGTH}
      placeholder={label === undefined ? 'Valores distintos' : undefined}
      onChange={event => setValue(event.target.value)} /></label>
    <button type="submit" className="button secondary">Aplicar etiqueta</button>
    <p className="field-help">La etiqueta es editable. Los identificadores son únicos.</p>
  </form>
}

export function MultiSelection({ editor, dispatch }: { editor: Editor; dispatch: Dispatch<Action> }) {
  const { model, selection } = editor
  const ids = new Set(selection.map(item => item.id))
  const nodes = model.nodes.filter(node => ids.has(node.id))
  const bars = model.bars.filter(bar => ids.has(bar.id))
  const loads = model.loads.filter(load => ids.has(load.id))
  const entities = [...nodes, ...bars]
  const label = common(entities.map(item => item.label))
  const formKey = JSON.stringify(entities.map(item => [item.id, item.label]))
  const geometries = bars.length > 0 && bars.length === selection.length ? bars.map(bar => {
    const start = model.nodes.find(node => node.id === bar.startId)
    const end = model.nodes.find(node => node.id === bar.endId)
    return start && end ? barGeometry(start, end) : null
  }) : null

  return <section className="side-section" aria-label="Propiedades de selección múltiple">
    <h3>Propiedades</h3>
    <div className="selected-object">
      <span className="tile-icon"><Icon name="layers" /></span>
      <div><strong>{selection.length} elementos seleccionados</strong><small>
        {nodes.length} {nodes.length === 1 ? 'nudo' : 'nudos'} · {bars.length} {bars.length === 1 ? 'barra' : 'barras'}
        {loads.length > 0 && ` · ${loads.length} ${loads.length === 1 ? 'carga' : 'cargas'}`}
      </small></div>
      <button type="button" className="icon-button delete-button" title="Eliminar (Supr)" aria-label="Eliminar selección"
        onClick={() => dispatch({ type: 'delete' })}><Icon name="trash" size={17} /></button>
    </div>
    {entities.length > 1 && <GroupLabel key={formKey} label={label} dispatch={dispatch} />}
    {nodes.length === selection.length && <>
      <h4 className="property-access">Solo lectura</h4>
      <dl className="properties">
        <dt>X global</dt><dd>{metric(nodes.map(node => node.x), ' m', 9)}</dd>
        <dt>Y global</dt><dd>{metric(nodes.map(node => node.y), ' m', 9)}</dd>
      </dl>
      <p className="field-help group-help">Usa Mover para trasladar los nudos seleccionados.</p>
    </>}
    {geometries && <>
      <h4 className="property-access">Calculadas · Solo lectura</h4>
      <dl className="properties">
        <dt>Longitud</dt><dd>{metric(geometries.map(item => item?.length), ' m', 9)}</dd>
        <dt>Ángulo global</dt><dd>{metric(geometries.map(item => item ? degrees(item.angle) : undefined), '°', 6)}</dd>
      </dl>
    </>}
    {loads.length === selection.length && <dl className="properties">
      <dt>Tipo común</dt><dd>{common(loads.map(load => load.kind === 'nodal' ? 'Nodal' : load.kind === 'point' ? 'Puntual' :
        load.profile === 'uniform' ? 'Uniforme' : 'Variable')) ?? 'Tipos distintos'}</dd>
      <dt>Sistema común</dt><dd>{common(loads.map(load => load.kind === 'nodal' || load.frame === 'global' ? 'Global' : 'Local de barra')) ??
        'Sistemas distintos'}</dd>
    </dl>}
  </section>
}
