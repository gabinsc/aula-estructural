import { useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import type { Point } from '../geometry/coordinates'
import { parseNumber } from '../modeler/format'
import type { Action } from '../modeler/tools/editor'
import { isSnapStep, isSnapTolerance, OBJECT_REFERENCES, SNAP_LABELS } from '../modeler/tools/snap'
import type { SnapSettings } from '../modeler/tools/snap'
import { Icon } from './Icon'

const presets = [{ step: 0.1, label: '0,10' }, { step: 0.25, label: '0,25' },
  { step: 0.5, label: '0,50' }, { step: 1, label: '1,00' }]

export function SnapControls({ settings, dispatch }: { settings: SnapSettings; dispatch: Dispatch<Action> }) {
  const [open, setOpen] = useState(false)
  return <div className="snap-menu">
    {(['grid', 'objects'] as const).map(system => <label className="snap-option" key={system}>
      <input type="checkbox" checked={settings[system]} onChange={() => dispatch({ type: 'toggle-snap', system })} />
      <span>{system === 'grid' ? 'Grid Snap' : 'Object Snap'}</span><kbd>{system === 'grid' ? 'F9' : 'F3'}</kbd>
    </label>)}
    <fieldset className="snap-references">
      <legend>Referencias de objeto</legend>
      {OBJECT_REFERENCES.map(reference => <label className="snap-option" key={reference}>
        <input type="checkbox" checked={settings.references[reference]}
          onChange={() => dispatch({ type: 'toggle-snap-reference', reference })} />
        {SNAP_LABELS[reference]}
      </label>)}
    </fieldset>
    <button className="snap-configure" type="button" aria-expanded={open} aria-controls="snap-settings"
      onClick={() => setOpen(value => !value)}>
      <Icon name="sliders" size={16} /> Configurar Snap… <span className={open ? 'frame-chevron open' : 'frame-chevron'}><Icon name="chevron" size={15} /></span>
    </button>
    {open && <SnapFields settings={settings} dispatch={dispatch} />}
  </div>
}

function SnapFields({ settings, dispatch }: { settings: SnapSettings; dispatch: Dispatch<Action> }) {
  const [x, setX] = useState(String(settings.step.x))
  const [y, setY] = useState(String(settings.step.y))
  const [tolerance, setTolerance] = useState(String(settings.tolerancePx))
  const [error, setError] = useState('')

  function apply(step: Point, tolerancePx?: number) {
    setError('')
    setX(String(step.x))
    setY(String(step.y))
    dispatch({ type: 'snap-settings', step, tolerancePx })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const a = parseNumber(x)
    const b = parseNumber(y)
    const px = parseNumber(tolerance)
    if (a === null || b === null || !isSnapStep(a) || !isSnapStep(b)) {
      setError('Introduce en ambos ejes un incremento entre 0,00000001 y 1 000 000 000 m.')
      return
    }
    if (px === null || !isSnapTolerance(px)) {
      setError('Introduce una tolerancia visual entre 1 y 50 px.')
      return
    }
    apply({ x: a, y: b }, px)
  }

  const { step } = settings
  return <form id="snap-settings" className="precision-form snap-fields" onSubmit={submit}>
      <div className="snap-presets" role="group" aria-label="Incremento en ambos ejes">
        {presets.map(preset => <button key={preset.step} type="button" className="button secondary"
          aria-pressed={preset.step === step.x && preset.step === step.y}
          onClick={() => apply({ x: preset.step, y: preset.step })}>{preset.label}</button>)}
      </div>
      <div className="field-row">
        <label>Incremento X (m)<input value={x} inputMode="decimal" onChange={event => setX(event.target.value)} /></label>
        <label>Incremento Y (m)<input value={y} inputMode="decimal" onChange={event => setY(event.target.value)} /></label>
      </div>
      <label>Tolerancia visual de Object Snap (px)
        <input value={tolerance} inputMode="decimal" onChange={event => setTolerance(event.target.value)} />
      </label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="submit" className="button primary">Aplicar ajustes</button>
    </form>
}
