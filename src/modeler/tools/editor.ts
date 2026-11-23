import { createBar, createNode, deleteSelection, EMPTY_STRUCTURE, getNode, moveNodes, relabelSelection } from '../../domain/structure'
import { editMechanicalValues } from '../../domain/mechanics'
import type { MechanicalPatch } from '../../domain/mechanics'
import { editLibrary } from '../../domain/library'
import type { LibraryEdit } from '../../domain/library'
import type { Endpoint, GeometrySelection, Selection, Structure } from '../../domain/structure'
import { reverseBar, setMomentReleases, splitBar } from '../../domain/barEdition'
import { copyEntities, duplicateLoads, pasteGeometry } from '../../domain/clipboard'
import type { Clipboard } from '../../domain/clipboard'
import { loadBarGeometry, saveLoad } from '../../domain/load'
import type { LoadDefinition } from '../../domain/load'
import { changeNodeSupport } from '../../domain/support'
import type { NodalSupport, SupportDefinition } from '../../domain/support'
import { fromGlobal, GLOBAL_FRAME, isModelPoint, polarToGlobal, relativeToGlobal, toGlobal } from '../../geometry/coordinates'
import type { CoordinateFrame, Point } from '../../geometry/coordinates'
import { DEFAULT_SNAP, isSnapStep, isSnapTolerance } from './snap'
import type { ObjectReference, SnapSettings } from './snap'

export type Tool = 'select' | 'node' | 'bar' | 'pan' | 'move' | 'support' | 'load'
export type Interaction =
  | { tool: 'select' }
  | { tool: 'node' }
  | { tool: 'support'; preset?: SupportPreset }
  | { tool: 'load'; preset?: LoadPreset }
  | { tool: 'pan' }
  | { tool: 'reference' }
  | { tool: 'paste'; target?: GeometrySelection['kind'] }
  | { tool: 'split'; barId: string; hinge?: true }
  | { tool: 'edit-node'; nodeId: string }
  | { tool: 'move'; stage: 'pick' }
  | { tool: 'move'; stage: 'place'; referenceId: string; nodeIds: readonly string[] }
  | { tool: 'bar'; stage: 'start' }
  | { tool: 'bar'; stage: 'end'; start: Endpoint }

export type CoordinateMode = 'global' | 'ucs' | 'relative' | 'polar'
export type SelectionMode = 'add' | 'toggle'
export type LoadPreset = 'nodal' | 'moment' | 'point' | 'uniform' | 'linear'
export type SupportPreset = SupportDefinition['kind']

export function loadPresetTarget(preset: LoadPreset): 'node' | 'bar' {
  return preset === 'nodal' || preset === 'moment' ? 'node' : 'bar'
}

export interface Editor {
  readonly model: Structure
  readonly interaction: Interaction
  readonly selection: readonly Selection[]
  readonly activeLoadId: string | null
  readonly loadDraft: LoadDefinition | null
  readonly clipboard: Clipboard | null
  readonly lastTool: Tool | null
  readonly ucs: CoordinateFrame
  readonly snap: SnapSettings
  readonly error: string | null
}

export type Action =
  | { type: 'tool'; tool: Tool }
  | { type: 'select'; items: readonly Selection[]; mode?: SelectionMode }
  | { type: 'selection-label'; label: string }
  | { type: 'mechanics'; barIds: readonly string[]; patch: MechanicalPatch | null }
  | { type: 'library'; change: LibraryEdit }
  | { type: 'select-load'; id: string | null }
  | { type: 'load-preset'; preset: LoadPreset }
  | { type: 'support-preset'; preset: SupportPreset }
  | { type: 'preview-load'; definition: LoadDefinition | null }
  | { type: 'save-load'; definition: LoadDefinition; id?: string }
  | { type: 'delete-load'; id: string }
  | { type: 'support'; nodeId: string; definition: SupportDefinition | null; expected: NodalSupport | undefined }
  | { type: 'point'; end: Endpoint }
  | { type: 'move-start'; nodeId: string }
  | { type: 'edit-node'; nodeId: string }
  | { type: 'bar-from'; nodeId: string }
  | { type: 'copy'; items?: readonly Selection[] }
  | { type: 'paste-start' }
  | { type: 'paste-loads'; target: GeometrySelection }
  | { type: 'split-start'; barId: string; hinge?: true }
  | { type: 'moment-releases'; barId: string; releaseI: boolean; releaseJ: boolean }
  | { type: 'split-bar'; barId: string; s: number }
  | { type: 'reverse-bar'; barId: string }
  | { type: 'repeat' }
  | { type: 'finish' }
  | { type: 'pick-origin' }
  | { type: 'toggle-snap'; system: 'grid' | 'objects' }
  | { type: 'toggle-snap-reference'; reference: ObjectReference }
  | { type: 'snap-settings'; step: Point; tolerancePx?: number }
  | { type: 'coordinates'; mode: CoordinateMode; first: number; second: number }
  | { type: 'ucs'; frame: CoordinateFrame }
  | { type: 'error'; message: string }
  | { type: 'cancel' }
  | { type: 'delete'; items?: readonly Selection[] }

export const INITIAL_EDITOR: Editor = {
  model: EMPTY_STRUCTURE, interaction: { tool: 'select' }, selection: [], activeLoadId: null, loadDraft: null,
  clipboard: null, lastTool: null,
  ucs: GLOBAL_FRAME, snap: DEFAULT_SNAP, error: null,
}

export function acceptsPoint(interaction: Interaction): boolean {
  return interaction.tool === 'node' || interaction.tool === 'bar' || interaction.tool === 'reference' ||
    (interaction.tool === 'paste' && !interaction.target) || interaction.tool === 'split' || interaction.tool === 'edit-node'
    || (interaction.tool === 'move' && interaction.stage === 'place')
}

export function referencePoint(editor: Editor): Point | undefined {
  const { interaction } = editor
  if (interaction.tool === 'bar' && interaction.stage === 'end') return interaction.start.point
  if (interaction.tool === 'move' && interaction.stage === 'place') return getNode(editor.model, interaction.referenceId)
  if (interaction.tool === 'paste' && editor.clipboard?.kind === 'geometry') return editor.clipboard.anchor
}

function startMove(editor: Editor, id: string): Editor {
  if (!getNode(editor.model, id)) return editor
  const selected = editor.selection.filter(item => item.kind === 'node').map(item => item.id)
  const alreadySelected = selected.includes(id)
  return {
    ...editor,
    interaction: { tool: 'move', stage: 'place', referenceId: id, nodeIds: alreadySelected ? selected : [id] },
    selection: alreadySelected ? editor.selection : [{ kind: 'node', id }],
    activeLoadId: null, loadDraft: null,
    error: null,
  }
}

function setFrame(editor: Editor, ucs: CoordinateFrame): Editor {
  if (!isModelPoint(ucs.origin) || !Number.isFinite(ucs.angle)) {
    return { ...editor, error: 'Introduce un origen válido dentro del rango del modelo y un ángulo finito.' }
  }
  const interaction = editor.interaction.tool === 'reference' ? { tool: 'select' } as const : editor.interaction
  return { ...editor, ucs, interaction, error: null }
}

function placePoint(editor: Editor, end: Endpoint): Editor {
  const interaction = editor.interaction
  if (interaction.tool === 'reference') return setFrame(editor, { ...editor.ucs, origin: end.point })
  if (interaction.tool === 'paste' && editor.clipboard?.kind === 'geometry') {
    const result = pasteGeometry(editor.model, editor.clipboard, end.point)
    if ('error' in result) return { ...editor, error: result.error }
    return { ...editor, model: result.model, selection: result.item, interaction: { tool: 'select' }, error: null }
  }
  if (interaction.tool === 'split') {
    const geometry = loadBarGeometry(editor.model, interaction.barId)
    return geometry ? edit(editor, { type: 'split-bar', barId: interaction.barId, s: fromGlobal(end.point, geometry.frame).x }) : editor
  }
  if (interaction.tool === 'edit-node') {
    const result = moveNodes(editor.model, [interaction.nodeId], interaction.nodeId, end.point)
    if ('error' in result) return { ...editor, error: result.error }
    return { ...editor, model: result.model, selection: [{ kind: 'node', id: interaction.nodeId }],
      interaction: { tool: 'select' }, error: null }
  }
  if (interaction.tool === 'move' && interaction.stage === 'place') {
    const result = moveNodes(editor.model, interaction.nodeIds, interaction.referenceId, end.point)
    if ('error' in result) return { ...editor, error: result.error }
    return { ...editor, model: result.model, lastTool: 'move', interaction: { tool: 'move', stage: 'pick' }, error: null }
  }
  if (interaction.tool === 'node') {
    const result = createNode(editor.model, end)
    if ('error' in result) return { ...editor, error: result.error }
    return { ...editor, model: result.model, lastTool: 'node', selection: [{ kind: 'node', id: result.item.id }], error: null }
  }
  if (interaction.tool !== 'bar') return editor
  if (interaction.stage === 'start') {
    if (!isModelPoint(end.point)) return { ...editor, error: 'El extremo inicial está fuera del rango de coordenadas del modelo.' }
    return { ...editor, interaction: { tool: 'bar', stage: 'end', start: end }, selection: [], error: null }
  }

  const result = createBar(editor.model, interaction.start, end)
  if ('error' in result) return { ...editor, error: result.error }
  return {
    ...editor, model: result.model, lastTool: 'bar', interaction: { tool: 'bar', stage: 'start' },
    selection: [{ kind: 'bar', id: result.item.id }], error: null,
  }
}

function updateSelection(current: readonly Selection[], items: readonly Selection[], mode?: SelectionMode) {
  if (!mode) return items
  const selected = new Map(current.map(item => [item.id, item]))
  for (const item of items) {
    if (mode === 'toggle' && selected.has(item.id)) selected.delete(item.id)
    else selected.set(item.id, item)
  }
  return [...selected.values()]
}

export function edit(editor: Editor, action: Action): Editor {
  switch (action.type) {
    case 'tool':
      if (editor.interaction.tool === action.tool) return editor
      if (action.tool === 'move') {
        const selected = editor.selection.find(item => item.kind === 'node')
        if (selected) return startMove(editor, selected.id)
        return { ...editor, activeLoadId: null, loadDraft: null, interaction: { tool: 'move', stage: 'pick' }, error: null }
      }
      return {
        ...editor, activeLoadId: null, loadDraft: null, interaction: action.tool === 'bar' ? { tool: 'bar', stage: 'start' } : { tool: action.tool },
        error: null,
      }
    case 'select':
      return { ...editor, selection: updateSelection(editor.selection, action.items, action.mode), activeLoadId: null, loadDraft: null, error: null }
    case 'select-load':
      return { ...editor, activeLoadId: action.id, loadDraft: null, error: null }
    case 'edit-node':
    case 'bar-from': {
      const node = getNode(editor.model, action.nodeId)
      if (!node) return editor
      const interaction: Interaction = action.type === 'edit-node' ? { tool: 'edit-node', nodeId: node.id }
        : { tool: 'bar', stage: 'end', start: { point: node, nodeId: node.id } }
      return { ...editor, interaction, loadDraft: null, activeLoadId: null, error: null }
    }
    case 'copy': {
      const clipboard = copyEntities(editor.model, action.items ?? editor.selection)
      return 'error' in clipboard ? { ...editor, error: clipboard.error } : { ...editor, clipboard, error: null }
    }
    case 'paste-start':
      return editor.clipboard
        ? { ...editor, interaction: { tool: 'paste', target: editor.clipboard.kind === 'loads' ? editor.clipboard.target : undefined },
          activeLoadId: null, loadDraft: null, error: null }
        : { ...editor, error: 'Copia entidades antes de pegar.' }
    case 'paste-loads': {
      if (editor.clipboard?.kind !== 'loads') return editor
      const result = duplicateLoads(editor.model, editor.clipboard, action.target)
      return 'error' in result ? { ...editor, error: result.error }
        : { ...editor, model: result.model, selection: result.item, interaction: { tool: 'select' }, error: null }
    }
    case 'split-start':
      return { ...editor, interaction: { tool: 'split', barId: action.barId, hinge: action.hinge },
        activeLoadId: null, loadDraft: null, error: null }
    case 'split-bar': {
      const result = splitBar(editor.model, action.barId, action.s, {
        hinge: editor.interaction.tool === 'split' && editor.interaction.barId === action.barId && editor.interaction.hinge,
      })
      return 'error' in result ? { ...editor, error: result.error }
        : { ...editor, model: result.model, interaction: { tool: 'select' }, error: null,
          selection: result.item.bars.map(bar => ({ kind: 'bar', id: bar.id })) }
    }
    case 'reverse-bar': {
      const result = reverseBar(editor.model, action.barId)
      return 'error' in result ? { ...editor, error: result.error } : { ...editor, model: result.model, error: null }
    }
    case 'moment-releases': {
      const result = setMomentReleases(editor.model, action.barId, action.releaseI, action.releaseJ)
      return 'error' in result ? { ...editor, error: result.error } : { ...editor, model: result.model, error: null }
    }
    case 'repeat':
      return editor.lastTool ? edit({ ...editor, interaction: { tool: 'select' } }, { type: 'tool', tool: editor.lastTool }) : editor
    case 'finish':
      return { ...editor, interaction: { tool: 'select' }, loadDraft: null, activeLoadId: null, error: null }
    case 'support-preset':
    case 'load-preset': {
      const target = action.type === 'support-preset' ? 'node' : loadPresetTarget(action.preset)
      const selection = editor.selection.length === 1 && editor.selection[0]?.kind === target ? editor.selection : []
      const interaction: Interaction = action.type === 'support-preset'
        ? { tool: 'support', preset: action.preset }
        : { tool: 'load', preset: action.preset }
      return { ...editor, interaction, selection, activeLoadId: null, loadDraft: null, error: null }
    }
    case 'preview-load':
      return editor.loadDraft === action.definition ? editor : { ...editor, loadDraft: action.definition }
    case 'save-load': {
      const result = saveLoad(editor.model, action.definition, action.id)
      if ('error' in result) return { ...editor, error: result.error }
      return { ...editor, model: result.model, activeLoadId: result.item.id, loadDraft: null, error: null }
    }
    case 'delete-load':
      return { ...editor, model: deleteSelection(editor.model, { kind: 'load', id: action.id }),
        selection: editor.selection.filter(item => item.id !== action.id), activeLoadId: null, loadDraft: null, error: null }
    case 'support': {
      const result = changeNodeSupport(editor.model, action.nodeId, action.definition, action.expected)
      if ('error' in result) return { ...editor, error: result.error }
      return { ...editor, model: result.model, error: null }
    }
    case 'library': {
      const result = editLibrary(editor.model, action.change)
      return 'error' in result ? { ...editor, error: result.error } : { ...editor, model: result.model, error: null }
    }
    case 'mechanics': {
      const result = editMechanicalValues(editor.model, action.barIds, action.patch)
      return 'error' in result ? { ...editor, error: result.error } : { ...editor, model: result.model, error: null }
    }
    case 'selection-label': {
      if (editor.selection.filter(item => item.kind !== 'load').length < 2) return editor
      const result = relabelSelection(editor.model, editor.selection, action.label)
      if ('error' in result) return { ...editor, error: result.error }
      return { ...editor, model: result.model, error: null }
    }
    case 'move-start':
      return startMove(editor, action.nodeId)
    case 'pick-origin':
      return { ...editor, interaction: { tool: 'reference' }, loadDraft: null, error: null }
    case 'toggle-snap':
      return { ...editor, snap: { ...editor.snap, [action.system]: !editor.snap[action.system] } }
    case 'toggle-snap-reference':
      return { ...editor, snap: { ...editor.snap, references: {
        ...editor.snap.references, [action.reference]: !editor.snap.references[action.reference],
      } } }
    case 'snap-settings': {
      const tolerancePx = action.tolerancePx ?? editor.snap.tolerancePx
      if (!isSnapStep(action.step.x) || !isSnapStep(action.step.y) || !isSnapTolerance(tolerancePx)) return editor
      return { ...editor, snap: { ...editor.snap, step: action.step, tolerancePx } }
    }
    case 'point':
      return placePoint(editor, action.end)
    case 'coordinates': {
      const { first, second, mode } = action
      if (mode === 'global') return placePoint(editor, { point: { x: first, y: second } })
      if (mode === 'ucs') return placePoint(editor, { point: toGlobal({ x: first, y: second }, editor.ucs) })
      const anchor = referencePoint(editor)
      if (!anchor) return editor
      if (mode === 'relative') return placePoint(editor, {
        point: relativeToGlobal(anchor, { x: first, y: second }, editor.ucs.angle),
      })
      if (first <= 0) return { ...editor, error: 'La distancia polar debe ser mayor que cero.' }
      return placePoint(editor, { point: polarToGlobal(anchor, first, second, editor.ucs.angle) })
    }
    case 'ucs':
      return setFrame(editor, action.frame)
    case 'error':
      return { ...editor, error: action.message }
    case 'cancel':
      if (editor.interaction.tool === 'bar' && editor.interaction.stage === 'end') {
        return { ...editor, interaction: { tool: 'bar', stage: 'start' }, error: null }
      }
      if (editor.interaction.tool === 'move' && editor.interaction.stage === 'place') {
        return { ...editor, interaction: { tool: 'move', stage: 'pick' }, error: null }
      }
      return { ...editor, interaction: { tool: 'select' }, selection: [], activeLoadId: null, loadDraft: null, error: null }
    case 'delete':
      if (!(action.items ?? editor.selection).length) return editor
      const model = deleteSelection(editor.model, ...(action.items ?? editor.selection))
      const ids = new Set([...model.nodes, ...model.bars, ...model.loads].map(item => item.id))
      return {
        ...editor, model, selection: editor.selection.filter(item => ids.has(item.id)), activeLoadId: null, loadDraft: null, error: null,
        interaction: editor.interaction.tool === 'move' ? { tool: 'move', stage: 'pick' } : editor.interaction,
      }
  }
}
