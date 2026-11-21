import { useMemo, useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import type { LoadDefinition, LoadFrame, StructuralLoad } from '../../domain/load'
import { formatNumber, parseNumber } from '../format'
import type { Structure } from '../../domain/structure'
import type { Action, LoadPreset } from '../tools/editor'
import { DirectionControl } from './DirectionControl'
import { LoadActions, readVector, useLoadPreview, vectorDraft } from './LoadFields'

type BarLoad = Exclude<StructuralLoad, { kind: 'nodal' }>
type Mode = 'point' | 'uniform' | 'linear'

export function BarLoadForm({ model, barId, active, length, preset, dispatch }: {
  model: Structure
  barId: string
  active: BarLoad | undefined
  length: number
  preset?: LoadPreset
  dispatch: Dispatch<Action>
}) {
  const point = active?.kind === 'point' ? active : undefined
  const interval = active?.kind === 'distributed' ? active : undefined
  const [mode, setMode] = useState<Mode>(interval?.profile ?? (preset === 'uniform' || preset === 'linear' ? preset : 'point'))
  const [frame, setFrame] = useState<LoadFrame>(active?.frame ?? 'global')
  const [s, setS] = useState(String(point?.s ?? 0))
  const [s0, setS0] = useState(String(interval?.s0 ?? 0))
  const [s1, setS1] = useState(String(interval?.s1 ?? length))
  const [force, setForce] = useState(() => vectorDraft(point?.force))
  const [q0, setQ0] = useState(() => vectorDraft(interval?.q0))
  const [q1, setQ1] = useState(() => vectorDraft(interval?.q1))
  const [error, setError] = useState('')
  const position = parseNumber(s)
  const prime = frame === 'local' ? '′' : ''
  const presetMode = !active && (preset === 'point' || preset === 'uniform' || preset === 'linear')

  const definition = useMemo<LoadDefinition | null>(() => {
    if (mode === 'point') {
      const vector = readVector(force, point?.force)
      return position === null || !vector ? null : { kind: 'point', barId, s: position, frame, force: vector }
    }
    const start = parseNumber(s0)
    const end = parseNumber(s1)
    const initial = readVector(q0, interval?.q0)
    const final = mode === 'uniform' ? initial : readVector(q1, interval?.q1)
    if (start === null || end === null || !initial || !final) return null
    return { kind: 'distributed', barId, frame, profile: mode, s0: start, s1: end, q0: initial, q1: final }
  }, [mode, force, q0, q1, point, interval, position, barId, frame, s0, s1])
  useLoadPreview(model, active, definition, dispatch)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!definition) {
      setError('Introduce números finitos para las distancias y las componentes.')
      return
    }
    setError('')
    dispatch({ type: 'save-load', id: active?.id, definition })
  }

  return <form className="precision-form" onSubmit={submit}>
    {presetMode ? <p className="field-help"><strong>{mode === 'point' ? 'Puntual sobre barra'
      : mode === 'uniform' ? 'Distribuida uniforme' : 'Distribuida variable'}</strong></p>
      : <label>Tipo de carga<select value={mode} onChange={event => {
      const next = event.target.value
      if (next === 'point' || next === 'uniform' || next === 'linear') setMode(next)
      setError('')
    }}>
      {(!active || point) && <option value="point">Puntual</option>}
      {!point && <>
        <option value="uniform">Distribuida uniforme</option>
        <option value="linear">Distribuida variable</option>
      </>}
    </select></label>}
    <label>Sistema de la carga<select value={frame} onChange={event => setFrame(event.target.value === 'local' ? 'local' : 'global')}>
      <option value="global">Global</option>
      <option value="local">Local de barra</option>
    </select></label>
    <p className="field-help">{frame === 'local' ? 'X′ positivo va del inicio al final y Y′ positivo gira 90° antihorario. Valores negativos invierten el sentido; el ángulo parte de +X′.' : 'X positivo apunta a la derecha e Y positivo hacia arriba. El ángulo parte de +X.'} Las componentes se interpretan en los ejes elegidos.</p>
    <p className="field-help">Distancias desde el nudo inicial. Longitud de barra {formatNumber(length, 8)} m.</p>
    {mode === 'point' ? <>
      <label>Distancia s (m)<input inputMode="decimal" value={s} onChange={event => setS(event.target.value)} /></label>
      {position !== null && position >= 0 && position <= length && <output className="field-help">
        {formatNumber(position / length * 100, 4)} % de la longitud
      </output>}
      <DirectionControl value={force} onChange={setForce} xLabel={`Fx${prime} (kN)`} yLabel={`Fy${prime} (kN)`}
        magnitudeLabel="Magnitud P (kN)" angleLabel="Ángulo θ (°)" local={frame === 'local'} />
    </> : <>
      <div className="field-row">
        <label>Inicio s₀ (m)<input inputMode="decimal" value={s0} onChange={event => setS0(event.target.value)} /></label>
        <label>Fin s₁ (m)<input inputMode="decimal" value={s1} onChange={event => setS1(event.target.value)} /></label>
      </div>
      <button type="button" className="button secondary" onClick={() => { setS0('0'); setS1(String(length)) }}>Usar toda la barra</button>
      <p className="field-help">{mode === 'uniform' ? 'Intensidad constante en el intervalo.' : 'La intensidad cambia linealmente entre los extremos.'}</p>
      <DirectionControl value={q0} onChange={setQ0} dial={false}
        magnitudeLabel={mode === 'linear' ? 'Intensidad q₀ (kN/m)' : 'Intensidad q (kN/m)'}
        angleLabel={mode === 'linear' ? 'Ángulo q₀ (°)' : 'Ángulo q (°)'}
        xLabel={`q${mode === 'linear' ? '₀' : ''}x${prime} (kN/m)`} yLabel={`q${mode === 'linear' ? '₀' : ''}y${prime} (kN/m)`} />
      {mode === 'linear' && <DirectionControl value={q1} onChange={setQ1} dial={false}
        magnitudeLabel="Intensidad q₁ (kN/m)" angleLabel="Ángulo q₁ (°)"
        xLabel={`q₁x${prime} (kN/m)`} yLabel={`q₁y${prime} (kN/m)`} />}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <LoadActions id={active?.id} dispatch={dispatch} />
  </form>
}
