import { useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import { supportRestraints } from '../../domain/support'
import type { NodalSupport, SupportDefinition } from '../../domain/support'
import { degrees, radians } from '../../geometry/coordinates'
import { formatNumber, parseNumber } from '../format'
import type { Action } from '../tools/editor'
import { AcademicHelp } from '../../app/academic/AcademicHelp'

const names = { pinned: 'Articulado', roller: 'Rodillo', fixed: 'Empotrado' } as const

export function NodeSupport({ nodeId, support, assigning, preset, dispatch }: {
  nodeId: string
  support: NodalSupport | undefined
  assigning: boolean
  preset?: SupportDefinition['kind']
  dispatch: Dispatch<Action>
}) {
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState<SupportDefinition['kind']>(preset ?? support?.kind ?? 'pinned')
  const displayedAngle = support?.kind === 'roller' ? Number(degrees(support.surfaceAngle).toPrecision(15)) : 0
  const [angle, setAngle] = useState(String(displayedAngle))
  const [error, setError] = useState('')
  const showForm = assigning || editing

  function change(definition: SupportDefinition | null) {
    dispatch({ type: 'support', nodeId, definition, expected: support })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (kind === 'roller') {
      const entered = parseNumber(angle)
      if (entered === null) {
        setError('Introduce una inclinación numérica finita.')
        return
      }
      // Conservar los radianes si se vuelve a enviar el ángulo mostrado.
      const surfaceAngle = support?.kind === 'roller' && entered === displayedAngle
        ? support.surfaceAngle : radians(entered % 360)
      change({ kind, surfaceAngle })
    } else {
      change({ kind })
    }
    setError('')
    setEditing(false)
  }

  const constraints = supportRestraints(support ?? (kind === 'roller' ? { kind, surfaceAngle: 0 } : { kind }))
  const roller = constraints.translation.length === 1

  return <section className="node-support" aria-label="Apoyo nodal">
    <h4>Apoyo de {nodeId}</h4>
    <AcademicHelp title="Qué restringe cada apoyo">
      <p>El articulado restringe las dos traslaciones y permite el giro. El rodillo restringe solo la traslación normal a su superficie. El empotrado restringe las dos traslaciones y el giro.</p>
    </AcademicHelp>
    {support && <dl className="support-properties">
      <dt>Tipo</dt><dd>{names[support.kind]}</dd>
      <dt>Orientación</dt><dd>{support.kind === 'roller' ? `${formatNumber(displayedAngle, 8)}° global` : 'Sin inclinación configurable'}</dd>
      <dt>Restringe</dt><dd>{roller ? 'Traslación normal a la superficie' : 'Traslación en X e Y globales'}{constraints.rotation && ' y rotación'}</dd>
      <dt>Permite</dt><dd>{roller ? 'Traslación tangencial y rotación' : constraints.rotation ? 'Ningún movimiento' : 'Rotación'}</dd>
    </dl>}
    {showForm ? <form className="precision-form" onSubmit={submit}>
      {preset ? <p className="field-help"><strong>{names[preset]}</strong>
        {support && support.kind !== preset && ' · Se aplicará al confirmar el reemplazo.'}
      </p> : <label>Tipo de apoyo<select value={kind} onChange={event => {
        setKind(event.target.value as SupportDefinition['kind'])
        setError('')
      }}>
        <option value="pinned">{names.pinned}</option>
        <option value="roller">{names.roller}</option>
        <option value="fixed">{names.fixed}</option>
      </select></label>}
      {kind === 'roller' && <>
        <label>Inclinación de la superficie (°)<input inputMode="decimal" value={angle} onChange={event => setAngle(event.target.value)} /></label>
        <p className="field-help">Desde +X global, en sentido antihorario. La flecha marca la normal restringida.</p>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="button primary">{support ? 'Aplicar cambios al apoyo' : 'Asignar apoyo'}</button>
      <button type="button" className="button secondary" onClick={() => dispatch({ type: 'cancel' })}>Cancelar formulario</button>
    </form> : <button type="button" className="button secondary" onClick={() => setEditing(true)}>Editar apoyo</button>}
    {support && <button type="button" className="button secondary" onClick={() => change(null)}>Quitar apoyo</button>}
  </section>
}
