import { useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import { Icon } from '../../app/Icon'
import { getNode } from '../../domain/structure'
import { radians } from '../../geometry/coordinates'
import { formatNumber, parseNumber } from '../format'
import { referencePoint } from '../tools/editor'
import type { Action, CoordinateMode, Editor } from '../tools/editor'

const options: { id: CoordinateMode; name: string; labels: [string, string] }[] = [
  { id: 'global', name: 'Global', labels: ['X (m)', 'Y (m)'] },
  { id: 'ucs', name: 'UCS', labels: ['X UCS (m)', 'Y UCS (m)'] },
  { id: 'relative', name: 'Relativa', labels: ['ΔX (m)', 'ΔY (m)'] },
  { id: 'polar', name: 'Polar', labels: ['Distancia (m)', 'Ángulo (°)'] },
]

export function CoordinateForm({ editor, dispatch }: {
  editor: Editor
  dispatch: Dispatch<Action>
}) {
  const { interaction } = editor
  const original = interaction.tool === 'edit-node' ? getNode(editor.model, interaction.nodeId) : undefined
  const [mode, setMode] = useState<CoordinateMode>(interaction.tool === 'paste' ? 'relative' : 'global')
  const [first, setFirst] = useState(original ? String(original.x) : '')
  const [second, setSecond] = useState(original ? String(original.y) : '')
  const [formError, setFormError] = useState('')
  const anchor = referencePoint(editor)
  const moving = interaction.tool === 'move' && interaction.stage === 'place' ? interaction : null
  const available = options.filter(option => anchor || option.id === 'global' || option.id === 'ucs')
  const current = available.find(option => option.id === mode) ?? options[0]!
  const submitLabel = interaction.tool === 'node' ? 'Crear nudo'
    : interaction.tool === 'paste' ? 'Pegar conjunto'
    : interaction.tool === 'edit-node' ? 'Aplicar coordenadas'
    : moving ? moving.nodeIds.length === 1 ? 'Mover nudo' : 'Mover nudos' : anchor ? 'Crear barra' : 'Fijar inicio'
  const icon = interaction.tool === 'reference' ? 'axes'
    : interaction.tool === 'paste' || interaction.tool === 'edit-node' || interaction.tool === 'split' ? 'move' : interaction.tool

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const a = parseNumber(first)
    const b = parseNumber(second)
    if (a === null || b === null) {
      setFormError('Escribe un número válido en cada campo.')
      return
    }
    setFormError('')
    dispatch({
      type: 'coordinates', mode: current.id, first: a, second: current.id === 'polar' ? radians(b % 360) : b,
    })
  }

  return <section className="side-section">
    <h3>Entrada de coordenadas</h3>
    <form className="precision-form" onSubmit={submit}>
      {moving && moving.nodeIds.length > 1 && <label>Nudo de referencia
        <select aria-label="Nudo de referencia" value={moving.referenceId}
          onChange={event => dispatch({ type: 'move-start', nodeId: event.target.value })}>
          {moving.nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>}
      <label>Sistema
        <select aria-label="Sistema" value={current.id} onChange={event => {
          const option = available.find(item => item.id === event.target.value)
          if (!option) return
          setMode(option.id)
          setFirst('')
          setSecond('')
          setFormError('')
        }}>
          {available.map(option => <option value={option.id} key={option.id}>{option.name}</option>)}
        </select>
      </label>
      {anchor && <p className="reference">Referencia global <span>({formatNumber(anchor.x)}, {formatNumber(anchor.y)}) m</span></p>}
      {(current.id === 'relative' || current.id === 'polar') && <p className="field-help">Respecto al inicio y a los ejes UCS.</p>}
      <div className="field-row">
        <label>{current.labels[0]}<input value={first} onChange={event => setFirst(event.target.value)} inputMode="decimal" /></label>
        <label>{current.labels[1]}<input value={second} onChange={event => setSecond(event.target.value)} inputMode="decimal" /></label>
      </div>
      {formError && <p role="alert" className="form-error">{formError}</p>}
      <button type="submit" className="button primary full"><Icon name={icon} size={16} />{submitLabel}</button>
    </form>
  </section>
}
