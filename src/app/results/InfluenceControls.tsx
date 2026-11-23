import { loadBarGeometry } from '../../domain/load'
import type { Selection, Structure } from '../../domain/structure'
import { radians } from '../../geometry/coordinates'
import { parseNumber } from '../../modeler/format'
import type { InfluenceOptions, InfluenceTarget } from '../../analysis/influence'
import type { Axle, Train } from '../../analysis/influenceCurve'
import type { InfluenceQueryTarget } from '../../analysis/methods'

export type DisplayedInfluence = InfluenceQueryTarget & {
  readonly name: string; readonly color: string; readonly scale: number; readonly visible: boolean
}
export const DEFAULT_LINE_COLORS = ['#087785', '#a33b21', '#6245b6', '#296344', '#926019', '#2856a0', '#aa2b72', '#3d5963']

type TargetKind = 'reaction' | 'translation' | 'rotation' | 'effort'
type AxleDraft = { readonly id: string; readonly force: string; readonly offset: string }
export interface InfluenceDraft {
  readonly path: string
  readonly reversed: boolean
  readonly target: TargetKind
  readonly id: string
  readonly loadAngle: string
  readonly responseAngle: string
  readonly station: string
  readonly side: 'left' | 'right'
  readonly field: 'N' | 'V' | 'M'
  readonly train: boolean
  readonly trainId: string
  readonly trainName: string
  readonly sense: Train['sense']
  readonly axles: readonly AxleDraft[]
}

export const INITIAL_INFLUENCE: InfluenceDraft = { path: '', reversed: false, target: 'reaction', id: '',
  loadAngle: '-90', responseAngle: '90', station: '', side: 'right', field: 'M', train: false, trainId: 'T1',
  trainName: 'Tren de dos ejes', sense: 1, axles: [{ id: 'E1', force: '10', offset: '0' }, { id: 'E2', force: '20', offset: '2' }] }

function vector(degrees: number) {
  const value = (degrees % 360 + 360) % 360
  if (value === 0) return { x: 1, y: 0 }
  if (value === 90) return { x: 0, y: 1 }
  if (value === 180) return { x: -1, y: 0 }
  if (value === 270) return { x: 0, y: -1 }
  const angle = radians(value)
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

export function influenceOptions(draft: InfluenceDraft): InfluenceOptions | null {
  const bars = draft.path.trim().split(/[\s,;→]+/).filter(Boolean)
  const angle = parseNumber(draft.loadAngle)
  const response = parseNumber(draft.responseAngle)
  const station = parseNumber(draft.station)
  if (!bars.length || !draft.id || angle === null ||
    ((draft.target === 'reaction' || draft.target === 'translation') && response === null) ||
    (draft.target === 'effort' && station === null)) return null
  let target: InfluenceTarget
  if (draft.target === 'effort') target = { kind: 'effort', barId: draft.id, s: station!, field: draft.field, side: draft.side }
  else if (draft.target === 'reaction') target = { kind: 'reaction', nodeId: draft.id, direction: vector(response!) }
  else target = { kind: 'displacement', nodeId: draft.id, motion: draft.target === 'rotation' ? { kind: 'rotation' }
    : { kind: 'translation', direction: vector(response!) } }
  let train: Train | undefined
  if (draft.train) {
    const axles: Axle[] = []
    for (const item of draft.axles) {
      const force = parseNumber(item.force), offset = parseNumber(item.offset)
      if (force === null || offset === null) return null
      axles.push({ id: item.id, force: force * 1000, offset })
    }
    train = { id: draft.trainId, name: draft.trainName, sense: draft.sense, axles }
  }
  return { bars, reversed: draft.reversed, target, direction: vector(angle), train }
}

export function InfluenceControls({ model, selection, draft, change, addLine, lineCount }: {
  model: Structure; selection: readonly Selection[]; draft: InfluenceDraft; change: (value: InfluenceDraft) => void
  addLine: (target: InfluenceTarget) => void; lineCount: number
}) {
  const ids = selection.filter(item => item.kind === 'bar').map(item => item.id)
  const targets = draft.target === 'effort' ? model.bars
    : draft.target === 'reaction' ? model.nodes.filter(node => model.supports.some(support => support.nodeId === node.id)) : model.nodes
  const selected = selection.find(item => item.kind === (draft.target === 'effort' ? 'bar' : 'node') && targets.some(target => target.id === item.id))
  const edit = (patch: Partial<InfluenceDraft>) => change({ ...draft, ...patch })
  const geometry = draft.target === 'effort' ? loadBarGeometry(model, draft.id) : null
  const options = influenceOptions(draft)
  function choose(id: string) {
    const length = draft.target === 'effort' ? loadBarGeometry(model, id)?.length : undefined
    edit({ id, station: length === undefined ? '' : String(length / 2) })
  }
  function axle(id: string, patch: Partial<AxleDraft>) {
    edit({ axles: draft.axles.map(item => item.id === id ? { ...item, ...patch } : item) })
  }
  return <>
    <fieldset className="method-fields">
      <legend>Recorrido y respuesta fija</legend>
      <label className="result-field">Barras en orden de avance
        <input value={draft.path} placeholder="B1, B2, B3" onChange={event => edit({ path: event.target.value })} /></label>
      <button type="button" className="button secondary" disabled={!ids.length} onClick={() => edit({ path: ids.join(', ') })}>Usar barras del CAD</button>
      <label><input type="checkbox" checked={draft.reversed} onChange={event => edit({ reversed: event.target.checked })} /> Invertir origen del recorrido</label>
      <label className="result-field">Respuesta de influencia<select value={draft.target}
        onChange={event => edit({ target: event.target.value as TargetKind, id: '', station: '' })}>
        <option value="reaction">Reacción de apoyo</option><option value="translation">Desplazamiento nodal</option>
        <option value="rotation">Giro nodal</option><option value="effort">Esfuerzo de sección</option>
      </select></label>
      <label className="result-field">Entidad objetivo<select value={draft.id} onChange={event => choose(event.target.value)}>
        <option value="">Seleccionar…</option>{targets.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
      </select></label>
      <button type="button" className="button secondary" disabled={!selected} onClick={() => { if (selected) choose(selected.id) }}>Usar objetivo CAD</button>
      <button type="button" className="button secondary" disabled={!options || lineCount >= 8}
        onClick={() => { if (options) addLine(options.target) }}>Agregar a líneas mostradas</button>
      {draft.target === 'effort' && <div className="result-controls">
        <label className="result-field">Estación del corte (m)<input inputMode="decimal" value={draft.station}
          onChange={event => edit({ station: event.target.value })} />
          {geometry && <small>L = {geometry.length} m</small>}</label>
        <label className="result-field">Campo<select value={draft.field} onChange={event => edit({ field: event.target.value as InfluenceDraft['field'] })}>
          <option value="N">Axial N</option><option value="V">Cortante V</option><option value="M">Momento M</option>
        </select></label>
        <label className="result-field">Lado del corte<select value={draft.side}
          onChange={event => edit({ side: event.target.value as InfluenceDraft['side'] })}>
          <option value="left">Izquierdo s⁻</option><option value="right">Derecho s⁺</option>
        </select></label>
      </div>}
      {(draft.target === 'reaction' || draft.target === 'translation') && <label className="result-field">Ángulo global de respuesta (°)
        <input inputMode="decimal" value={draft.responseAngle} onChange={event => edit({ responseAngle: event.target.value })} /></label>}
      <label className="result-field">Ángulo global de carga (°)
        <input inputMode="decimal" value={draft.loadAngle} onChange={event => edit({ loadAngle: event.target.value })} /></label>
    </fieldset>
    <fieldset className="method-fields">
      <legend>Tren de cargas</legend>
      <label><input type="checkbox" checked={draft.train} onChange={event => edit({ train: event.target.checked })} /> Configurar tren</label>
      {draft.train && <>
        <p>Los ejes son paralelos a la unidad. Una fuerza negativa invierte su sentido. Las distancias se miden detrás del eje de referencia.</p>
        <div className="result-controls">
          <label className="result-field">ID del tren<input value={draft.trainId} maxLength={24} onChange={event => edit({ trainId: event.target.value })} /></label>
          <label className="result-field">Nombre del tren<input value={draft.trainName} maxLength={60} onChange={event => edit({ trainName: event.target.value })} /></label>
        </div>
        <label className="result-field">Sentido del tren<select value={draft.sense} onChange={event => edit({ sense: event.target.value === '1' ? 1 : -1 })}>
          <option value="1">S creciente</option><option value="-1">S decreciente</option>
        </select></label>
        {draft.axles.map(item => <div className="influence-axle" key={item.id}>
          <label className="result-field">{item.id} · Fuerza (kN)<input inputMode="decimal" value={item.force}
            onChange={event => axle(item.id, { force: event.target.value })} /></label>
          <label className="result-field">Distancia de {item.id} (m)<input inputMode="decimal" value={item.offset}
            onChange={event => axle(item.id, { offset: event.target.value })} /></label>
          <button type="button" className="button secondary" aria-label={`Quitar eje ${item.id}`} disabled={draft.axles.length === 1}
            onClick={() => edit({ axles: draft.axles.filter(value => item.id !== value.id) })}>Quitar</button>
        </div>)}
        <button type="button" className="button secondary" disabled={draft.axles.length >= 16} onClick={() => {
          const id = `E${1 + Math.max(...draft.axles.map(item => Number(item.id.slice(1))))}`
          edit({ axles: [...draft.axles, { id, force: '10', offset: '0' }] })
        }}>Agregar eje</button>
      </>}
    </fieldset>
  </>
}
