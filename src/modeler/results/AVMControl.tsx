import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../../app/Icon'
import { resultNumber } from '../../app/results/ResultTable'
import { activeEfforts, AVM_VIEWS, BASE_HEIGHT, deformationFactor, EFFORT_UNIT, MAX_AMPLIFICATION } from './diagramModel'
import type { AVMPreferences, AVMView, DiagramModel } from './diagramModel'

const SHORT_VIEW: Record<AVMView, string> = { model: 'Modelo', N: 'Axial', V: 'Cortante', M: 'Momento', combined: 'Combinada', deformed: 'Deformada' }

export function AVMControl({ preferences, update, status, hasResult, canvasHeight }: {
  preferences: AVMPreferences; update: (patch: Partial<AVMPreferences>) => void; status: string; hasResult: boolean; canvasHeight: number
}) {
  const { view, amplitude, amplification } = preferences
  const index = AVM_VIEWS.findIndex(item => item.key === view)
  const [open, setOpen] = useState(false)
  const [factorError, setFactorError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const active = useRef<HTMLButtonElement>(null)
  const panel = useId()
  useEffect(() => {
    if (!open) return
    active.current?.focus({ preventScroll: true })
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    window.addEventListener('pointerdown', closeOutside)
    return () => window.removeEventListener('pointerdown', closeOutside)
  }, [open])

  function close() {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }

  return <div className="avm-control" ref={root} onKeyDown={event => {
    if (open && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }}>
    <button className="avm-cycle" type="button" aria-label="AVM" title={`AVM · ${SHORT_VIEW[view]} · ${status}`}
      onClick={() => { setOpen(false); update({ view: AVM_VIEWS[(index + 1) % AVM_VIEWS.length]!.key }) }}>
      <strong>AVM</strong><span data-avm-view={view}>{SHORT_VIEW[view]}</span>
    </button>
    <button className="avm-menu-button" type="button" ref={trigger} aria-label="Opciones AVM"
      title="Opciones AVM" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(value => !value)}>
      <Icon name="chevron" size={13} />
    </button>
    {open && <div id={panel} className="avm-menu" role="group" aria-label="Vistas y capas AVM"
      style={canvasHeight ? { maxHeight: Math.min(410, canvasHeight - 92) } : undefined}>
      <div className="avm-menu-heading"><strong>Visualización</strong><small>{status}</small></div>
      <div className="avm-views" role="group" aria-label="Vista AVM">
        {AVM_VIEWS.map(item => <button type="button" key={item.key} ref={view === item.key ? active : undefined}
          aria-pressed={view === item.key} onClick={() => { update({ view: item.key }); close() }}>{item.label}</button>)}
      </div>
      <fieldset className="avm-options"><legend>Capas</legend>
        {([['loads', 'Cargas aplicadas'], ['reactions', 'Reacciones'], ['labels', 'Etiquetas de valores'],
          ['extremes', 'Extremos'], ['ids', 'Identificadores'], ['automaticLabels', 'Distribución automática'],
          ['geometry', 'Geometría original'], ['deformed', 'Geometría deformada']] as const).map(([key, label]) =>
          <label key={key}><input type="checkbox" checked={preferences[key]}
            onChange={event => update({ [key]: event.target.checked })} />{label}</label>)}
      </fieldset>
      <label className="result-field">Decimales de resultados
        <select value={preferences.decimals} onChange={event => update({ decimals: Number(event.target.value) })}>
          {[0, 1, 2, 3, 4].map(digits => <option key={digits}>{digits}</option>)}
        </select>
      </label>
      {activeEfforts(view).length > 0 && <>
        <label className="avm-slider">Amplitud AVM <output>{amplitude}×</output>
          <input aria-label="Amplitud AVM" type="range" min=".25" max="3" step=".25" value={amplitude}
            onChange={event => update({ amplitude: Number(event.target.value) })} />
        </label>
        <label className="avm-query-control"><input type="checkbox" checked={preferences.query} disabled={!hasResult}
          onChange={event => update({ query: event.target.checked })} />Consultar en el lienzo</label>
      </>}
      {view === 'deformed' && <div className="avm-factor">
        <label><input type="checkbox" checked={amplification === null}
          onChange={event => { setFactorError(''); update({ amplification: event.target.checked ? null : 1 }) }} />Amplificación automática</label>
        {amplification !== null && <form onSubmit={event => {
          event.preventDefault()
          const value = Number(new FormData(event.currentTarget).get('factor'))
          if (!Number.isFinite(value) || value <= 0 || value > MAX_AMPLIFICATION) {
            setFactorError('Introduce un factor mayor que 0 y hasta 10¹².')
            return
          }
          setFactorError('')
          update({ amplification: value })
        }}>
          <label>Factor manual<input name="factor" type="number" step="any" defaultValue={amplification} /></label>
          <button type="submit">Aplicar factor</button>
          {factorError && <small role="alert">{factorError}</small>}
        </form>}
      </div>}
    </div>}
  </div>
}

export function AVMLegend({ preferences, diagram, status, hasResult, queryReady, invalidDiagram }: {
  preferences: AVMPreferences; diagram?: DiagramModel; status: string; hasResult: boolean; queryReady: boolean; invalidDiagram: boolean
}) {
  const { view, amplitude, amplification, reactions, deformed } = preferences
  if (view === 'model' && !reactions) return null
  const fields = activeEfforts(view)
  const hasFrames = diagram?.members.some(member => !!member.fields)
  const factor = diagram && view === 'deformed' ? deformationFactor(diagram, amplification) : 0
  return <div className="avm-legend" aria-label="Leyenda AVM">
    {!hasResult ? <p role="status">{status} · Ejecuta Analizar estructura.</p> : <>
      {invalidDiagram && <p role="status">Los valores exceden el rango de visualización.</p>}
      {diagram && fields.map(field => <p key={field} data-effort={field}><b>{field}</b>
        {field !== 'N' && !hasFrames ? 'No aplicable en armaduras'
          : diagram.maxima[field] > 0
            ? `${resultNumber(diagram.maxima[field], .001)} ${EFFORT_UNIT[field]} ↔ ${BASE_HEIGHT[field] * amplitude} px`
            : `0 ${EFFORT_UNIT[field]}`}
      </p>)}
      {diagram && fields.includes('N') && <p>+N tracción · −N compresión</p>}
      {view === 'combined' && !invalidDiagram && <p>AVM · franjas separadas en Resultados</p>}
      {view === 'deformed' && diagram && <p><b className="avm-deformed-key">δ</b>
        {!deformed ? 'Deformada oculta' : factor === 0 ? 'Desplazamientos despreciables' :
          `Amplificación ${resultNumber(factor)}× · ${amplification === null ? 'Auto' : 'Manual'}`}
      </p>}
      {reactions && <p className="avm-reaction-key">Reacciones globales</p>}
      {queryReady && <p>Consulta activa · señala una barra o su diagrama</p>}
    </>}
  </div>
}
