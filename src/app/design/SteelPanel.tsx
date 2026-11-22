import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { FrameResult, FrameSection } from '../../analysis'
import type { DesignResult } from '../../design/contracts'
import type { DemandKind, SteelDemandDeclaration, SteelMemberSettings } from '../../design/steel/contracts'
import { E090 } from '../../design/steel/e090'
import { steelDesign } from '../../design/steel/evaluate'
import { readSteelMember } from '../../design/steel/settings'
import type { Section } from '../../domain/library'
import { parseNumber } from '../../modeler/format'
import { buildFrameFields } from '../../modeler/results/diagramFields'
import { ResultTable, resultNumber } from '../results/ResultTable'

const DEMAND_OPTIONS: Record<DemandKind, string> = {
  unclassified: 'Sin clasificación', characteristic: 'Característica o nominal', service: 'De servicio',
  'lrfd-combination': 'Combinación factorizada LRFD', 'asd-combination': 'Combinación compatible ASD',
}
const STATUS = {
  pass: 'Cumple la verificación realizada', fail: 'No cumple la verificación realizada', pending: 'No evaluado',
  outside: 'Fuera del alcance', stale: 'Resultado desactualizado',
}
const format = (value: number | undefined, scale = 1) => value === undefined ? '' : String(value * scale)

function Parameters({ settings, save }: { settings: SteelMemberSettings; save: (settings: SteelMemberSettings) => void }) {
  const [connectionKind, setConnectionKind] = useState(settings.connection?.kind ?? '')
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const text = (key: string) => String(values.get(key) ?? '').trim()
    const number = (key: string, factor = 1) => text(key) ? (parseNumber(text(key)) ?? NaN) * factor : undefined
    function axis(key: 'x' | 'y') {
      const length = number(`length-${key}`), k = number(`k-${key}`), ends = text(`ends-${key}`)
      return length !== undefined || k !== undefined || ends ? { length, k, ends } : undefined
    }
    try {
      save(readSteelMember({ barId: settings.barId, method: text('method'), grade: text('grade') || undefined,
        x: axis('x'), y: axis('y'), lateralLength: number('lateral'), weldedI: values.has('welded'),
        flexureRestrained: values.has('flexure'), unreinforcedWeb: values.has('web'),
        connection: connectionKind ? { kind: connectionKind, netArea: number('net', 1e-4),
          eccentricity: number('eccentricity', .001), length: number('connectionLength', .001) } : undefined }))
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Parámetros inválidos.') }
  }
  return <details className="result-detail">
    <summary>Parámetros de acero de la barra</summary>
    <form className="design-form" onSubmit={submit}>
      <div className="result-controls">
        <label className="result-field">Método de acero<select name="method" defaultValue={settings.method}>
          <option>LRFD</option><option>ASD</option>
        </select></label>
        <label className="result-field">Grado declarado<select name="grade" defaultValue={settings.grade ?? ''}>
          <option value="">Seleccionar…</option><option>ASTM A36</option><option>ASTM A572 Grado 50</option>
        </select></label>
      </div>
      <label className="result-field">Transferencia de la conexión<select value={connectionKind} onChange={event =>
        setConnectionKind(event.target.value as typeof connectionKind)}>
        <option value="">Sin datos</option><option value="direct">Directa a todos los elementos</option>
        <option value="partial-bolted">Parcial solamente por pernos</option>
      </select></label>
      {connectionKind && <label className="result-field">Área neta An (cm²)<input name="net" inputMode="decimal"
        defaultValue={format(settings.connection?.netArea, 1e4)} /></label>}
      {connectionKind === 'partial-bolted' && <div className="result-controls">
        <label className="result-field">Excentricidad de conexión (mm)<input name="eccentricity" inputMode="decimal"
          defaultValue={format(settings.connection?.eccentricity, 1e3)} /></label>
        <label className="result-field">Longitud de conexión (mm)<input name="connectionLength" inputMode="decimal"
          defaultValue={format(settings.connection?.length, 1e3)} /></label>
      </div>}
      {(['x', 'y'] as const).map(axis => <fieldset className="method-fields" key={axis}>
        <legend>Pandeo respecto de {axis}</legend>
        <div className="result-controls">
          <label className="result-field">Longitud {axis} (m)<input name={`length-${axis}`} inputMode="decimal" defaultValue={format(settings[axis]?.length)} /></label>
          <label className="result-field">K {axis}<input name={`k-${axis}`} inputMode="decimal" defaultValue={format(settings[axis]?.k)} /></label>
        </div>
        <label className="result-field">Condiciones de extremo {axis}<input name={`ends-${axis}`} maxLength={160} defaultValue={settings[axis]?.ends ?? ''} /></label>
      </fieldset>)}
      <label className="result-field">Longitud lateral Lb (m)<input name="lateral" inputMode="decimal" defaultValue={format(settings.lateralLength)} /></label>
      <label><input type="checkbox" name="welded" defaultChecked={settings.weldedI} /> Perfil I soldado homogéneo con unión continua ala–alma</label>
      <label><input type="checkbox" name="flexure" defaultChecked={settings.flexureRestrained} /> Flexión simple en plano principal y torsión restringida según §6.1.1</label>
      <label><input type="checkbox" name="web" defaultChecked={settings.unreinforcedWeb} /> Alma homogénea sin rigidizadores</label>
      <button type="submit" className="button secondary">Guardar parámetros de acero</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </details>
}

export function SteelPanel({ design, section, E, settings, memberRevision, save, learning, frame, selectStation }: {
  design: DesignResult; section?: Section; E?: number; settings: SteelMemberSettings; save: (settings: SteelMemberSettings) => void
  memberRevision: string
  learning: boolean; frame?: FrameResult; selectStation: (s: number, side: FrameSection['side']) => void
}) {
  const [declaration, setDeclaration] = useState<SteelDemandDeclaration>()
  const { analysisRevision, loadCaseId } = design.designCase
  const requiresConfirmation = settings.grade !== undefined && settings.memberRevision !== memberRevision
  const applied = requiresConfirmation ? { barId: settings.barId, method: settings.method } : settings
  const result = steelDesign(design, { section, E, settings: applied, demand: declaration })
  const marks = useMemo(() => {
    if (!frame) return []
    const { marks } = buildFrameFields(frame)
    return (['N', 'V', 'M'] as const).flatMap(field => {
      const entries = marks[field].map(mark => mark.section)
      const max = entries.reduce((a, b) => b[field] > a[field] ? b : a)
      const min = entries.reduce((a, b) => b[field] < a[field] ? b : a)
      return [{ field, label: `Máximo ${field}`, cut: max }, { field, label: `Mínimo ${field}`, cut: min }]
    })
  }, [frame])
  function classify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const kind = data.get('kind')
    if (typeof kind !== 'string' || !Object.hasOwn(DEMAND_OPTIONS, kind)) return
    setDeclaration({ analysisRevision, caseId: loadCaseId, kind: kind as DemandKind,
      combination: String(data.get('combination') ?? '').trim(), secondOrder: data.has('secondOrder') })
  }
  return <section className="result-section" aria-label="Verificación de acero">
    <h3>Acero · {settings.method}</h3>
    <p><a href={E090.url} target="_blank" rel="noreferrer">{E090.name}</a> · {E090.edition}</p>
    <p className="result-hint">{settings.grade ?? 'Grado pendiente'} · caso {loadCaseId} · consultas en la estación seleccionada</p>
    {requiresConfirmation && <p role="alert">Cambió la barra o su asignación. Revisa y confirma los parámetros de acero.</p>}
    <Parameters settings={settings} save={next => save({ ...next, memberRevision })} />
    <details className="result-detail">
      <summary>Clasificar demanda del caso</summary>
      <form className="design-form" onSubmit={classify}>
        <label className="result-field">Naturaleza de las acciones<select name="kind" defaultValue={declaration?.kind ?? 'unclassified'}>
          {Object.entries(DEMAND_OPTIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label className="result-field">Identificación y base de la combinación<input name="combination" maxLength={200}
          defaultValue={declaration?.combination ?? ''} /></label>
        <label><input type="checkbox" name="secondOrder" defaultChecked={declaration?.secondOrder} /> Momentos requeridos conforme a §3.1 revisados externamente</label>
        <button type="submit" className="button secondary" disabled={!design.actions}>Confirmar clasificación del caso</button>
      </form>
    </details>
    <p className="result-hint">{declaration?.analysisRevision === analysisRevision && declaration.caseId === loadCaseId && design.actions
      ? DEMAND_OPTIONS[declaration.kind] : 'Demanda sin clasificación vigente'} · clasificación de sesión</p>
    {marks.length > 0 && <div className="result-controls" aria-label="Estaciones críticas de las acciones">
      {marks.map(({ cut, label }) => <button key={label} type="button" className="button secondary" onClick={() => selectStation(cut.s, cut.side)}>{label}</button>)}
    </div>}
    <h3>{result.partial ? 'Verificación parcial' : 'Verificaciones de la estación'}</h3>
    <p className="result-hint">{result.governing ? `Gobierna entre las comprobaciones calculadas: ${result.governing.title}.`
      : 'Sin relación demanda/capacidad evaluada en esta estación.'}</p>
    <ResultTable label="Estados límite de acero" headings={['Estado límite', 'Nominal', 'Factor', 'Capacidad', 'Demanda', 'Demanda/capacidad', 'Estado']}
      rows={result.states.map(item => {
        const suffix = item.unit === 'N' ? ' kN' : item.unit === 'N·m' ? ' kN·m' : ''
        const shown = (value: number | undefined) => value === undefined ? '—' : `${resultNumber(value, item.unit ? .001 : 1)}${suffix}`
        return { id: item.id, cells: [item.title, shown(item.nominal), resultNumber(item.factor), shown(item.capacity),
          shown(item.demand), resultNumber(item.ratio), item.applicable ? item.state === 'pass' && item.ratio === undefined
            ? 'Condición geométrica verificada' : STATUS[item.state] : 'Sin demanda aplicable'] }
      })} />
    {result.states.map(item => (item.applicable || learning) && <details key={item.id} className="result-detail">
      <summary>{item.title} · {item.source}</summary>
      {item.diagnostic && <p>{item.diagnostic}</p>}
      {learning && item.equation && <><p className="method-equation">{item.equation}</p><p>{item.substitution}</p></>}
    </details>)}
  </section>
}
