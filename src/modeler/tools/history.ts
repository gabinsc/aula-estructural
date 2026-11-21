import type { Structure } from '../../domain/structure'
import { edit, INITIAL_EDITOR } from './editor'
import type { Action, Editor } from './editor'

export type WorkspaceAction = Action | { type: 'undo' } | { type: 'redo' }

interface History {
  readonly editor: Editor
  readonly past: readonly Structure[]
  readonly future: readonly Structure[]
}

export const HISTORY_LIMIT = 100
export const INITIAL_HISTORY: History = { editor: INITIAL_EDITOR, past: [], future: [] }

function restore(editor: Editor, model: Structure): Editor {
  const nodes = new Set(model.nodes.map(node => node.id))
  const bars = new Set(model.bars.map(bar => bar.id))
  const loads = new Set(model.loads.map(load => load.id))
  return {
    ...editor, model, interaction: { tool: 'select' }, error: null,
    activeLoadId: editor.activeLoadId && loads.has(editor.activeLoadId) ? editor.activeLoadId : null, loadDraft: null,
    selection: editor.selection.filter(item => (item.kind === 'node' ? nodes : item.kind === 'bar' ? bars : loads).has(item.id)),
  }
}

export function editWithHistory(history: History, action: WorkspaceAction): History {
  const { editor, past, future } = history
  if (action.type === 'undo') {
    const previous = past.at(-1)
    if (!previous) return history
    return { editor: restore(editor, previous), past: past.slice(0, -1), future: [...future, editor.model] }
  }
  if (action.type === 'redo') {
    const next = future.at(-1)
    if (!next) return history
    return { editor: restore(editor, next), past: [...past, editor.model], future: future.slice(0, -1) }
  }

  const edited = edit(editor, action)
  if (edited === editor) return history
  if (edited.model === editor.model) return { ...history, editor: edited }

  // El dominio confirma cada edición publicando un modelo nuevo e inmutable.
  return { editor: edited, past: [...past, editor.model].slice(-HISTORY_LIMIT), future: [] }
}
