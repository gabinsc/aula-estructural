import { MAX_REDUNDANTS } from '../../analysis/forceMethod'
import type { Redundant } from '../../analysis/forceMethod'
import type { InfluenceQueryTarget, MethodRequest } from '../../analysis/methods'
import type { InfluenceTarget } from '../../analysis/influence'
import { loadBarGeometry } from '../../domain/load'
import type { Selection, Structure } from '../../domain/structure'
import { radians } from '../../geometry/coordinates'
import { parseNumber } from '../../modeler/format'
import { resultNumber } from './ResultTable'
import { InfluenceControls, influenceOptions } from './InfluenceControls'
import type { InfluenceDraft } from './InfluenceControls'

export type MethodKind = 'stiffness' | 'virtual' | 'forces' | 'influence' | 'cross'
export interface VirtualDraft {
  readonly targetKind: 'node' | 'section'
  readonly id: string
  readonly station: string
  readonly direction: 'x' | 'y' | 'angle' | 'rotation'
  readonly angle: string
}
export const INITIAL_VIRTUAL: VirtualDraft = { targetKind: 'node', id: '', station: '', direction: 'y', angle: '0' }

export function methodRequest(kind: MethodKind, draft: VirtualDraft, ids: readonly string[], moving: InfluenceDraft,
  targets?: readonly InfluenceQueryTarget[]): MethodRequest | undefined {
  if (kind === 'stiffness') return undefined
  if (kind === 'forces') return { kind, ids }
  if (kind === 'cross') return { kind }
  if (kind === 'influence') return { kind, options: influenceOptions(moving), ...(targets?.length && { targets }) }
  const station = parseNumber(draft.station)
  const angle = parseNumber(draft.angle)
  if (!draft.id || (draft.targetKind === 'section' && station === null) || (draft.direction === 'angle' && angle === null)) {
    return { kind, objective: null }
  }
  const target = draft.targetKind === 'node' ? { kind: 'node' as const, id: draft.id }
    : { kind: 'section' as const, id: draft.id, s: station! }
  const direction = draft.direction === 'x' ? { x: 1, y: 0 }
    : draft.direction === 'y' ? { x: 0, y: 1 }
      : { x: Math.cos(radians(angle ?? 0)), y: Math.sin(radians(angle ?? 0)) }
  return { kind, objective: { target, motion: draft.direction === 'rotation' ? { kind: 'rotation' } : { kind: 'translation', direction } } }
}

export const AXIS_LABEL = { x: '+X', y: '+Y', normal: 'Normal', rotation: 'Giro +Z' } as const
const SUPPORT_LABEL = { fixed: 'Empotrado', pinned: 'Articulado', roller: 'Rodillo' } as const
export function motionLabel(item: Redundant) {
  const motion = item.motion
  return motion.kind === 'rotation' ? 'Momento +Z'
    : `Fuerza (${resultNumber(motion.direction.x)}, ${resultNumber(motion.direction.y)})`
}

export function MethodControls({ kind, changeKind, draft, changeDraft, model, selection, candidates, ids, toggle, clear, moving, changeMoving,
  addLine, lineCount }: {
  kind: MethodKind
  changeKind: (kind: MethodKind) => void
  draft: VirtualDraft
  changeDraft: (draft: VirtualDraft) => void
  model: Structure
  selection: readonly Selection[]
  candidates: readonly Redundant[]
  ids: readonly string[]
  toggle: (id: string) => void
  clear: () => void
  moving: InfluenceDraft
  changeMoving: (value: InfluenceDraft) => void
  addLine: (target: InfluenceTarget) => void
  lineCount: number
}) {
  const picked = selection.find(item => item.kind === 'node' || item.kind === 'bar')
  const choose = (targetKind: VirtualDraft['targetKind'], id: string) => {
    const length = targetKind === 'section' ? loadBarGeometry(model, id)?.length : undefined
    changeDraft({ ...draft, targetKind, id, station: length === undefined ? '' : String(length / 2) })
  }
  const entities = draft.targetKind === 'node' ? model.nodes : model.bars
  const length = draft.targetKind === 'section' ? loadBarGeometry(model, draft.id)?.length : undefined
  return <section className="method-setup" aria-label="Configuración del método">
    <label className="result-field">Método de análisis
      <select value={kind} onChange={event => changeKind(event.target.value as MethodKind)}>
        <option value="stiffness">Método matricial de rigideces</option>
        <option value="virtual">Trabajo virtual / carga unitaria</option>
        <option value="forces">Método de las fuerzas</option>
        <option value="influence">Líneas de influencia</option>
        <option value="cross">Distribución de momentos</option>
      </select>
    </label>
    {kind === 'influence' && <InfluenceControls model={model} draft={moving} change={changeMoving} selection={selection}
      addLine={addLine} lineCount={lineCount} />}
    {kind === 'cross' && <p className="result-hint">Cross admite vigas y pórticos sin rotación apreciable de cuerda. Se distribuyen los giros nodales activos.</p>}
    {kind === 'virtual' && <fieldset className="method-fields">
      <legend>Respuesta buscada</legend>
      <div className="result-controls">
        <label className="result-field">Objetivo<select value={draft.targetKind}
          onChange={event => choose(event.target.value as VirtualDraft['targetKind'], '')}>
          <option value="node">Nudo</option><option value="section">Sección de barra</option>
        </select></label>
        <label className="result-field">{draft.targetKind === 'node' ? 'Nudo objetivo' : 'Barra objetivo'}
          <select value={draft.id} onChange={event => choose(draft.targetKind, event.target.value)}>
            <option value="">Seleccionar…</option>
            {entities.map(item => <option value={item.id} key={item.id}>{item.id}{item.label !== item.id ? ` · ${item.label}` : ''}</option>)}
          </select>
        </label>
      </div>
      <button type="button" className="button secondary" disabled={!picked}
        onClick={() => { if (picked) choose(picked.kind === 'node' ? 'node' : 'section', picked.id) }}>Usar selección CAD</button>
      {draft.targetKind === 'section' && <label className="result-field">Estación objetivo s (m) · desde el nudo inicial
        <input inputMode="decimal" value={draft.station} onChange={event => changeDraft({ ...draft, station: event.target.value })}
          aria-label="Estación objetivo s (m)" />
        {length !== undefined && <small>L = {resultNumber(length)} m</small>}
      </label>}
      <label className="result-field">Componente<select value={draft.direction}
        onChange={event => changeDraft({ ...draft, direction: event.target.value as VirtualDraft['direction'] })}>
        <option value="x">Horizontal +X</option><option value="y">Vertical +Y</option>
        <option value="angle">Dirección arbitraria</option><option value="rotation">Giro antihorario +Z</option>
      </select></label>
      {draft.direction === 'angle' && <label className="result-field">Ángulo global (°)
        <input inputMode="decimal" value={draft.angle} onChange={event => changeDraft({ ...draft, angle: event.target.value })} />
      </label>}
    </fieldset>}
    {kind === 'forces' && <fieldset className="method-fields">
      <legend>Redundantes · {ids.length} seleccionadas</legend>
      <p>Selecciona restricciones en el CAD o en esta lista. Analizar verifica la estabilidad de la primaria.</p>
      {candidates.length > 0 ? <div className="method-constraints">
        {candidates.map(item => <label key={item.id}>
          <input type="checkbox" checked={ids.includes(item.id)} disabled={!ids.includes(item.id) && ids.length >= MAX_REDUNDANTS}
            onChange={() => toggle(item.id)} />
          <span><strong>{item.id}</strong> · {SUPPORT_LABEL[item.support]} · {AXIS_LABEL[item.axis]}<small>{motionLabel(item)}</small></span>
        </label>)}
      </div> : <p>No hay restricciones elegibles.</p>}
      {ids.length > 0 && <button type="button" className="button secondary" onClick={clear}>Limpiar redundantes</button>}
    </fieldset>}
  </section>
}
