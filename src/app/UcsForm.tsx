import { useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import { degrees, GLOBAL_FRAME, isModelPoint, radians } from '../geometry/coordinates'
import type { CoordinateFrame } from '../geometry/coordinates'
import { formatNumber, parseNumber } from '../modeler/format'
import type { Action } from '../modeler/tools/editor'
import { Icon } from './Icon'

export function describeUcs(frame: CoordinateFrame) {
  const customized = frame.origin.x !== 0 || frame.origin.y !== 0 || frame.angle !== 0
  const angle = degrees(frame.angle)
  return { customized, angle, label: `${customized ? 'UCS de trabajo' : 'Global'} · ${formatNumber(angle, 4)}°` }
}

export function UcsForm({ frame, picking, dispatch, onClose }: {
  frame: CoordinateFrame; picking: boolean; dispatch: Dispatch<Action>
  onClose: () => void
}) {
  const displayedRotation = Number(degrees(frame.angle).toPrecision(15))
  const [x, setX] = useState(() => String(frame.origin.x))
  const [y, setY] = useState(() => String(frame.origin.y))
  const [angle, setAngle] = useState(() => String(displayedRotation))
  const [error, setError] = useState('')

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const a = parseNumber(x)
    const b = parseNumber(y)
    const rotation = parseNumber(angle)
    if (a === null || b === null || rotation === null) {
      setError('Introduce tres valores numéricos.')
      return
    }
    const origin = { x: a, y: b }
    if (!isModelPoint(origin)) {
      setError('Introduce un origen dentro del rango del modelo.')
      return
    }
    // Reapplying the displayed rotation preserves the original radians.
    const storedAngle = rotation === displayedRotation ? frame.angle : radians(rotation % 360)
    dispatch({ type: 'ucs', frame: { origin, angle: storedAngle } })
    onClose()
  }

  function reset() {
    dispatch({ type: 'ucs', frame: GLOBAL_FRAME })
    onClose()
  }

  return <form id="ucs-settings" className="precision-form" onSubmit={apply}>
      <div className="field-row">
        <label>Origen X (m)<input inputMode="decimal" value={x} onChange={event => setX(event.target.value)} /></label>
        <label>Origen Y (m)<input inputMode="decimal" value={y} onChange={event => setY(event.target.value)} /></label>
      </div>
      <label>Rotación (°)<input inputMode="decimal" value={angle} onChange={event => setAngle(event.target.value)} /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="submit" className="button primary">Aplicar UCS</button>
      <button type="button" className="button secondary" aria-pressed={picking}
        onClick={() => {
          dispatch({ type: picking ? 'cancel' : 'pick-origin' })
          onClose()
        }}>
        <Icon name="cursor" size={16} /> Elegir origen en el lienzo
      </button>
      <button type="button" className="button secondary" onClick={reset}>Restablecer UCS global</button>
    </form>
}
