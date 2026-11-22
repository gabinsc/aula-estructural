import { useMemo, useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import { AcademicHelp } from '../../app/academic/AcademicHelp'
import { loadBarGeometry, loadTarget, toKiloUnits } from '../../domain/load'
import type { LoadDefinition, StructuralLoad } from '../../domain/load'
import type { GeometrySelection, Structure } from '../../domain/structure'
import type { Action, LoadPreset } from '../tools/editor'
import { BarLoadForm } from './BarLoadForm'
import { DirectionControl } from './DirectionControl'
import { LoadActions, readMagnitude, readVector, useLoadPreview, vectorDraft } from './LoadFields'

function NodalForm({ model, target, active, preset, dispatch }: {
  model: Structure
  target: GeometrySelection
  active: Extract<StructuralLoad, { kind: 'nodal' }> | undefined
  preset?: LoadPreset
  dispatch: Dispatch<Action>
}) {
  const momentOnly = preset === 'moment' && (!active || (!active.force.x && !active.force.y))
  const forceOnly = preset === 'nodal' && !active
  const [vector, setVector] = useState(() => vectorDraft(active?.force))
  const [mz, setMz] = useState(String(toKiloUnits(active?.moment ?? 0)))
  const [error, setError] = useState('')

  const definition = useMemo<LoadDefinition | null>(() => {
    const force = readVector(vector, active?.force)
    const moment = readMagnitude(mz, active?.moment)
    return force && moment !== null ? { kind: 'nodal', nodeId: target.id, force, moment } : null
  }, [vector, mz, active, target.id])
  useLoadPreview(model, active, definition, dispatch)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!definition) {
      setError('Introduce valores numéricos finitos para Fx, Fy y Mz.')
      return
    }
    setError('')
    dispatch({ type: 'save-load', id: active?.id, definition })
  }

  return <form className="precision-form" onSubmit={submit}>
    <p className="field-help">Ejes globales. θ es antihorario desde +X. Mz positivo gira en sentido antihorario.</p>
    {!momentOnly && <DirectionControl value={vector} onChange={setVector}
      xLabel="Fx (kN)" yLabel="Fy (kN)" magnitudeLabel="Magnitud P (kN)" angleLabel="Ángulo θ (°)" />}
    {!forceOnly && <label>Mz (kN·m)<input inputMode="decimal" value={mz} onChange={event => setMz(event.target.value)} /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <LoadActions id={active?.id} dispatch={dispatch} />
  </form>
}

export function LoadInspector({ model, target, activeId, assigning, direct, preset, dispatch }: {
  model: Structure
  target: GeometrySelection
  activeId: string | null
  assigning: boolean
  direct?: StructuralLoad
  preset?: LoadPreset
  dispatch: Dispatch<Action>
}) {
  const [draft, setDraft] = useState<number | null>(null)
  const loads = model.loads.filter(load => {
    const owner = loadTarget(load)
    return owner.kind === target.kind && owner.id === target.id
  })
  const active = direct ?? loads.find(load => load.id === activeId)
  const geometry = target.kind === 'bar' ? loadBarGeometry(model, target.id) : null
  const formKey = active ? JSON.stringify(active) : `new-${draft}`
  if (!assigning && !loads.length && draft === null) return null

  return <section className="load-inspector" aria-label="Cargas del elemento">
    <h4>{direct ? `Carga ${direct.id} · ${loadName(direct)}` : `Cargas de ${target.id}`}</h4>
    <AcademicHelp title="Cargas y ejes de referencia">
      <p>Una acción nodal aplica una fuerza o un momento en un nudo. Una fuerza puntual de barra actúa a la distancia física s. Una distribuida aplica fuerza por unidad de longitud entre s₀ y s₁.</p>
      <p>En global, +X apunta a la derecha y +Y hacia arriba. En una barra, +x′ va del nudo inicial al final y +y′ se obtiene al girar +90°. Un momento nodal positivo es antihorario.</p>
    </AcademicHelp>
    {direct && <p className="field-help">Asociada a {target.kind === 'node' ? 'nudo' : 'barra'} {target.id}.</p>}
    {!direct && !!loads.length && <ul className="load-list">
      {loads.map(load => <li key={load.id}>
        <button type="button" className="button secondary" aria-pressed={load.id === activeId}
          onClick={() => { setDraft(null); dispatch({ type: 'select-load', id: load.id }) }}>
          {load.id} · {loadName(load)}
        </button>
      </li>)}
    </ul>}
    {!direct && <button type="button" className="button secondary" onClick={() => {
      setDraft(previous => (previous ?? 0) + 1)
      dispatch({ type: 'select-load', id: null })
    }}>Nueva carga</button>}
    {(active || assigning || draft !== null) && (target.kind === 'node'
      ? <NodalForm key={formKey} model={model} target={target} active={active?.kind === 'nodal' ? active : undefined}
        preset={preset} dispatch={dispatch} />
      : geometry && <BarLoadForm key={formKey} model={model} barId={target.id} length={geometry.length}
        active={active?.kind === 'nodal' ? undefined : active} preset={preset} dispatch={dispatch} />)}
  </section>
}

function loadName(load: StructuralLoad) {
  return load.kind === 'nodal' ? 'Nodal' : load.kind === 'point' ? 'Puntual' : load.profile === 'uniform' ? 'Uniforme' : 'Variable'
}
