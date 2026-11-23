import type { Dispatch } from 'react'
import { getNodeSupport } from '../../domain/support'
import { copyEntities } from '../../domain/clipboard'
import type { Selection } from '../../domain/structure'
import type { Action, Editor } from '../tools/editor'
import type { CadMenuItem } from './CadContextMenu'

export function cadActions(editor: Editor, dispatch: Dispatch<Action>, hit: Selection | null, supportId: string | undefined,
  behind: Selection | null, fit: () => void, configureGrid: () => void) {
  const entries: CadMenuItem[] = []
  const command = (label: string, action: Action) => entries.push({ label, run: () => dispatch(action) })
  const { interaction, selection } = editor
  if (interaction.tool !== 'select') {
    if (interaction.tool === 'node' || (interaction.tool === 'bar' && interaction.stage === 'start') || interaction.tool === 'pan') {
      command('Finalizar comando', { type: 'finish' })
      if (editor.lastTool && editor.lastTool !== interaction.tool) command('Repetir último comando', { type: 'repeat' })
    }
    command('Cancelar comando', { type: 'cancel' })
    if (interaction.tool === 'split') {
      const bar = editor.model.bars.find(item => item.id === interaction.barId)
      const start = editor.model.nodes.find(item => item.id === bar?.startId)
      const end = editor.model.nodes.find(item => item.id === bar?.endId)
      if (start && end) command('Cortar en el punto medio', {
        type: 'split-bar', barId: interaction.barId, s: Math.hypot(end.x - start.x, end.y - start.y) / 2,
      })
    }
    return { title: 'Comando activo', items: entries }
  }
  if (hit && selection.length > 1 && selection.some(item => item.id === hit.id)) {
    if (!('error' in copyEntities(editor.model, selection))) command('Copiar selección', { type: 'copy' })
    command('Eliminar selección', { type: 'delete' })
    return { title: `${selection.length} elementos seleccionados`, items: entries }
  }
  const support = supportId && getNodeSupport(editor.model, supportId)
  if (support) {
    const items = [{ kind: 'node' as const, id: support.nodeId }]
    command('Consultar apoyo', { type: 'select', items })
    entries.push({ label: 'Editar apoyo', run: () => {
      dispatch({ type: 'tool', tool: 'support' })
      dispatch({ type: 'select', items })
    } })
    command('Quitar apoyo', { type: 'support', nodeId: support.nodeId, expected: support, definition: null })
    return { title: `Apoyo de ${support.nodeId}`, items: entries }
  }
  if (hit) {
    command(hit.kind === 'load' ? 'Editar carga' : 'Consultar propiedades', { type: 'select', items: [hit] })
    if (hit.kind === 'node') {
      command('Editar coordenadas', { type: 'edit-node', nodeId: hit.id })
      command('Crear barra desde el nudo', { type: 'bar-from', nodeId: hit.id })
    }
    if (hit.kind === 'bar') {
      command('Dividir barra', { type: 'split-start', barId: hit.id })
      if (editor.model.mechanics.assignments.some(item => item.barId === hit.id && item.kind === 'frame2d')) {
        command('Insertar rótula interior', { type: 'split-start', barId: hit.id, hinge: true })
      }
      command('Invertir sentido', { type: 'reverse-bar', barId: hit.id })
    }
    if (hit.kind === 'load' && behind) {
      command(`Consultar ${behind.kind === 'bar' ? 'barra' : 'nudo'} ${behind.id}`, { type: 'select', items: [behind] })
      if (behind.kind === 'bar') {
        command(`Dividir barra ${behind.id}`, { type: 'split-start', barId: behind.id })
        command(`Invertir barra ${behind.id}`, { type: 'reverse-bar', barId: behind.id })
      }
    }
    command('Copiar', { type: 'copy', items: [hit] })
    command('Eliminar', { type: 'delete', items: [hit] })
    return { title: `${hit.kind === 'bar' ? 'Barra' : hit.kind === 'node' ? 'Nudo' : 'Carga'} ${hit.id}`, items: entries }
  }
  command('Crear nudo', { type: 'tool', tool: 'node' })
  if (editor.clipboard) command('Pegar', { type: 'paste-start' })
  if (editor.lastTool) command('Repetir último comando', { type: 'repeat' })
  entries.push({ label: 'Configurar cuadrícula', run: configureGrid }, { label: 'Ajustar vista', run: fit })
  if (selection.length) command('Limpiar selección', { type: 'select', items: [] })
  return { title: 'Lienzo', items: entries }
}
