import { useState } from 'react'
import type { Material, LibraryEdit } from '../../domain/library'
import { materialIssue } from '../../domain/library'
import { fromMechanicalDisplay, toMechanicalDisplay } from '../../domain/mechanics'
import { decimal } from './fields'

export function MaterialEditor({ material, linked, edit, select }: {
  material?: Material; linked: number; edit: (change: LibraryEdit) => void; select: (id: string) => void
}) {
  const [draft, setDraft] = useState({
    name: material?.name ?? '', category: material?.category ?? '', description: material?.description ?? '',
    E: material ? String(toMechanicalDisplay('E', material.E)) : '',
    nu: material?.nu === undefined ? '' : String(material.nu),
    density: material?.density === undefined ? '' : String(material.density),
    source: material?.source ?? '', illustrative: material?.illustrative ?? false,
  })
  const [update, setUpdate] = useState(false)
  const [error, setError] = useState('')
  const canEdit = material?.editable !== false

  function save() {
    const entry: Material = { ...draft, id: material?.id ?? crypto.randomUUID(), name: draft.name.trim(), category: draft.category.trim(),
      E: draft.E === (material ? String(toMechanicalDisplay('E', material.E)) : '') && material
        ? material.E : fromMechanicalDisplay('E', decimal(draft.E)),
      nu: draft.nu.trim() ? decimal(draft.nu) : undefined, density: draft.density.trim() ? decimal(draft.density) : undefined,
      source: draft.source.trim(), revisedAt: new Date().toISOString(), editable: true }
    const issue = materialIssue(entry)
    setError(issue ?? '')
    if (issue) return
    edit({ type: 'save-material', material: entry, updateLinked: update })
    select(entry.id)
  }

  return <form className="precision-form library-form" noValidate onSubmit={event => { event.preventDefault(); save() }}>
    <fieldset disabled={!canEdit} className="library-fields">
      <legend>{material ? 'Editar material' : 'Nuevo material'}</legend>
      <div className="library-field-grid">
        {([['name', 'Nombre del material'], ['category', 'Categoría'], ['E', 'Módulo E (GPa)'],
          ['nu', 'Poisson ν (opcional)'], ['density', 'Densidad (kg/m³)'], ['source', 'Fuente']] as const).map(([key, label]) =>
          <label key={key}>{label}<input value={draft[key]} inputMode={['E', 'nu', 'density'].includes(key) ? 'decimal' : undefined}
            onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
      </div>
      <label>Descripción<textarea rows={2} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <label className="library-check"><input type="checkbox" checked={draft.illustrative}
        onChange={event => setDraft({ ...draft, illustrative: event.target.checked })} />Valores ilustrativos</label>
    </fieldset>
    {material && <p className="field-help">Revisión {material.revisedAt.slice(0, 10)} · {canEdit ? 'Editable' : 'Solo lectura'}</p>}
    {linked > 0 && canEdit && <label className="library-check"><input type="checkbox" checked={update}
      onChange={event => setUpdate(event.target.checked)} />Actualizar las {linked} barras vinculadas al confirmar</label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {canEdit && <button type="submit" className="button primary">Guardar material</button>}
  </form>
}
