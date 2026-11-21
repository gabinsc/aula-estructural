import { useCallback, useState } from 'react'
import { Icon } from './Icon'
import type { LoadPreset, SupportPreset, Tool } from '../modeler/tools/editor'
import { ToolMenu } from './ToolMenu'
import type { ToolOption } from './ToolMenu'

export const tools = [
  { id: 'select', label: 'Seleccionar', key: 'V' },
  { id: 'node', label: 'Nudo', key: 'N' },
  { id: 'bar', label: 'Barra', key: 'B' },
  { id: 'move', label: 'Mover', key: 'M' },
  { id: 'support', label: 'Apoyo', key: 'A' },
  { id: 'load', label: 'Carga', key: 'C' },
  { id: 'pan', label: 'Desplazar', key: 'H' },
] as const

const supportOptions: readonly ToolOption<SupportPreset>[] = [
  { id: 'pinned', label: 'Articulado', shortLabel: 'Articulado' },
  { id: 'roller', label: 'Rodillo', shortLabel: 'Rodillo' },
  { id: 'fixed', label: 'Empotrado', shortLabel: 'Empotrado' },
]

const loadOptions: readonly ToolOption<LoadPreset>[] = [
  { id: 'nodal', label: 'Fuerza nodal', shortLabel: 'Nodal' },
  { id: 'moment', label: 'Momento nodal', shortLabel: 'Momento' },
  { id: 'point', label: 'Carga puntual sobre barra', shortLabel: 'Puntual' },
  { id: 'uniform', label: 'Carga distribuida uniforme', shortLabel: 'Uniforme' },
  { id: 'linear', label: 'Carga distribuida variable', shortLabel: 'Variable' },
]

export function Tools({ current, setTool, fit, loadPreset, chooseLoad, supportPreset, chooseSupport }: {
  current: Tool | null
  setTool: (tool: Tool) => void
  fit: () => void
  loadPreset?: LoadPreset
  chooseLoad: (preset: LoadPreset) => void
  supportPreset?: SupportPreset
  chooseSupport: (preset: SupportPreset) => void
}) {
  const [open, setOpen] = useState<'support' | 'load' | null>(null)
  const openSupport = useCallback((value: boolean) => setOpen(current => value ? 'support' : current === 'support' ? null : current), [])
  const openLoad = useCallback((value: boolean) => setOpen(current => value ? 'load' : current === 'load' ? null : current), [])

  return <nav className="tools" aria-label="Herramientas de dibujo">
    {tools.map(({ id, label, key }) => {
      if (id === 'support') return <ToolMenu key={id} name={label} shortcut={key} icon={id} options={supportOptions}
        active={current === id} preset={supportPreset} open={open === id} setOpen={openSupport} choose={chooseSupport} />
      if (id === 'load') return <ToolMenu key={id} name={label} shortcut={key} icon={id} options={loadOptions}
        active={current === id} preset={loadPreset} open={open === id} setOpen={openLoad} choose={chooseLoad} />
      return <button key={id} type="button" aria-pressed={current === id}
      title={`${label} (${key})`} onClick={() => setTool(id)}>
      <Icon name={id} size={21} /><span>{label}</span>
      </button>
    })}
    <div className="tool-divider" />
    <button type="button" title="Ajustar vista (F)" onClick={fit}><Icon name="fit" size={21} /><span>Ajustar</span></button>
  </nav>
}
