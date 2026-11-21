import type { Dispatch } from 'react'
import { Icon } from '../../app/Icon'
import type { NodeOverlap } from '../../domain/nodeOverlaps'
import { getNode } from '../../domain/structure'
import { loadTarget } from '../../domain/load'
import { getNodeSupport } from '../../domain/support'
import { barGeometry, degrees, fromGlobal } from '../../geometry/coordinates'
import { formatNumber } from '../format'
import { acceptsPoint } from '../tools/editor'
import type { Action, Editor } from '../tools/editor'
import { CoordinateForm } from './CoordinateForm'
import { MultiSelection } from './MultiSelection'
import { LoadInspector } from './LoadInspector'
import { NodeSupport } from './NodeSupport'
import { SplitForm } from './SplitForm'
import { MechanicalInspector } from './MechanicalInspector'

function SelectionDetails({ editor, dispatch }: { editor: Editor; dispatch: Dispatch<Action> }) {
  const { model, selection: items, ucs } = editor
  const selection = items[0]
  if (!selection) return null
  if (items.length > 1) return <MultiSelection editor={editor} dispatch={dispatch} />
  if (selection.kind === 'load') {
    const load = model.loads.find(item => item.id === selection.id)
    return load && <section className="side-section"><LoadInspector key={load.id} model={model}
      target={loadTarget(load)} activeId={load.id} assigning={false} direct={load} dispatch={dispatch} /></section>
  }
  const node = selection.kind === 'node' ? getNode(model, selection.id) : undefined
  const support = node && getNodeSupport(model, node.id)
  const assigning = editor.interaction.tool === 'support'
  const supportPreset = assigning ? editor.interaction.preset : undefined
  const bar = selection.kind === 'bar' ? model.bars.find(item => item.id === selection.id) : undefined
  const start = bar && getNode(model, bar.startId)
  const end = bar && getNode(model, bar.endId)
  const geometry = start && end && barGeometry(start, end)
  const localNode = node && fromGlobal(node, ucs)
  const work = ucs.origin.x !== 0 || ucs.origin.y !== 0 || ucs.angle !== 0
  const label = node?.label ?? bar?.label
  return <section className="side-section">
    <h3>Propiedades</h3>
    <div className="selected-object">
      <span className="tile-icon"><Icon name={selection.kind} /></span>
      <div><strong>{label}</strong><small>{selection.kind === 'node' ? 'Nudo' : 'Barra'}
        {label !== selection.id && ` · ${selection.id}`}</small></div>
      <button type="button" className="icon-button delete-button" title="Eliminar (Supr)" aria-label="Eliminar selección" onClick={() => dispatch({ type: 'delete' })}><Icon name="trash" size={17} /></button>
    </div>
    {node && <dl className="properties">
      <dt>X global</dt><dd>{formatNumber(node.x, 9)} m</dd>
      <dt>Y global</dt><dd>{formatNumber(node.y, 9)} m</dd>
      {localNode && work && <>
        <dt>X UCS</dt><dd>{formatNumber(localNode.x, 9)} m</dd>
        <dt>Y UCS</dt><dd>{formatNumber(localNode.y, 9)} m</dd>
      </>}
    </dl>}
    {start && end && geometry && <dl className="properties">
      <dt>Nudo inicial</dt><dd>{start.id}</dd>
      <dt>Nudo final</dt><dd>{end.id}</dd>
      <dt>Longitud</dt><dd>{formatNumber(geometry.length, 9)} m</dd>
      <dt>Ángulo global</dt><dd>{formatNumber(degrees(geometry.angle), 6)}°</dd>
    </dl>}
    {node && (assigning || (support && editor.interaction.tool === 'select')) && <NodeSupport
      key={`${node.id}-${support?.kind}-${support?.kind === 'roller' ? support.surfaceAngle : ''}-${assigning}-${supportPreset}`}
      nodeId={node.id} support={support} assigning={assigning} preset={supportPreset} dispatch={dispatch} />}
    {(node || bar) && (editor.interaction.tool === 'load' || editor.interaction.tool === 'select') && <LoadInspector
      key={`${selection.id}-${editor.interaction.tool}-${editor.interaction.tool === 'load' ? editor.interaction.preset : ''}`}
      preset={editor.interaction.tool === 'load' ? editor.interaction.preset : undefined}
      model={model} target={selection} activeId={editor.activeLoadId}
      assigning={editor.interaction.tool === 'load'} dispatch={dispatch} />}
  </section>
}

export function Inspector({ editor, dispatch, overlaps }: {
  editor: Editor
  dispatch: Dispatch<Action>
  overlaps: readonly NodeOverlap[]
}) {
  const { interaction, model } = editor
  const drawing = acceptsPoint(interaction) && interaction.tool !== 'reference'
  const selectedBars = editor.selection.filter(item => item.kind === 'bar').map(item => item.id)
  const formStage = 'stage' in interaction ? interaction.stage : model.nextNode
  return <aside className="inspector" aria-label="Inspector">
    <header className="inspector-heading"><Icon name="panel" size={17} /><h2>Inspector</h2></header>
    <div className="inspector-body">
      {editor.error && <p className="model-error" role="alert">{editor.error}</p>}
      {overlaps.length > 0 && <section className="side-section overlap-section" aria-label="Nudos superpuestos">
        <h3><Icon name="warning" size={17} /> Nudos superpuestos</h3>
        <p>Los nudos coinciden geométricamente. Cada uno conserva su ID y sus barras.</p>
        <ul className="overlap-groups">
          {overlaps.map(group => <li key={group[0]!.id}>
            {group.map(node => <button key={node.id} type="button" className="button secondary"
              aria-label={`Seleccionar ${node.id}`} title={node.label}
              aria-pressed={editor.selection.some(item => item.kind === 'node' && item.id === node.id)}
              onClick={() => {
                dispatch({ type: 'tool', tool: 'select' })
                dispatch({ type: 'select', items: [{ kind: 'node', id: node.id }] })
              }}>{node.id}</button>)}
          </li>)}
        </ul>
      </section>}
      {interaction.tool === 'split' ? <SplitForm key={interaction.barId} model={model} barId={interaction.barId} dispatch={dispatch} />
        : drawing && <CoordinateForm editor={editor} dispatch={dispatch} key={`${interaction.tool}-${formStage}-${interaction.tool === 'edit-node' ? interaction.nodeId : ''}`} />}
      {editor.selection.length > 0 && <SelectionDetails editor={editor} dispatch={dispatch} />}
      {selectedBars.length > 0 && <section className="side-section">
        <MechanicalInspector key={selectedBars.join(',')} model={model} barIds={selectedBars} dispatch={dispatch} />
      </section>}
      <section className="side-section">
        <h3>Geometría del modelo</h3>
        <div className="model-counts">
          <div><span><Icon name="node" size={14} /> Nudos</span><strong>{model.nodes.length}</strong></div>
          <div><span><Icon name="bar" size={14} /> Barras</span><strong>{model.bars.length}</strong></div>
        </div>
      </section>
    </div>
  </aside>
}
