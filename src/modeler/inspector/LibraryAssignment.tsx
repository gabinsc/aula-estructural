import { useState } from 'react'
import type { Dispatch } from 'react'
import { catalogOf } from '../../domain/library'
import type { SectionAxis } from '../../domain/library'
import type { MechanicalAssignment } from '../../domain/mechanics'
import type { Structure } from '../../domain/structure'
import type { Action } from '../tools/editor'

export function LibraryAssignment({ model, assignments, barIds, dispatch }: {
  model: Structure; assignments: readonly (MechanicalAssignment | undefined)[]; barIds: readonly string[]; dispatch: Dispatch<Action>
}) {
  const library = catalogOf(model)
  const [material, setMaterial] = useState('')
  const [section, setSection] = useState('')
  const [axis, setAxis] = useState<SectionAxis | ''>('')
  const selectedFrame = assignments.some(item => item?.kind === 'frame2d')
  const ready = assignments.every(Boolean)
  const currentAxes = [...new Set(assignments.map(item => item?.sectionAxis))]
  const title = (category: 'materialId' | 'sectionId') => {
    const values = [...new Set(assignments.map(item => item?.[category]))]
    if (values.length > 1) return 'Valores diferentes'
    const names = category === 'materialId' ? library.materials : library.sections
    const linked = names.find(item => item.id === values[0])
    if (linked) return linked.name
    const physical = [...new Set(assignments.map(item => item?.[category === 'materialId' ? 'E' : 'A'] !== undefined))]
    return physical.length > 1 ? 'Manual y pendiente' : physical[0] ? 'Manual' : 'Pendiente'
  }
  return <details className="mechanical-library">
    <summary>Asignación desde biblioteca</summary>
    <dl className="properties"><dt>Material actual</dt><dd>{title('materialId')}</dd>
      <dt>Sección actual</dt><dd>{title('sectionId')}</dd>
      {currentAxes.some(Boolean) && <><dt>Inercia asignada</dt><dd>{currentAxes.length > 1 ? 'Diferente por barra' : currentAxes[0] === 'x' ? 'Ixx' : 'Iyy'}</dd></>}</dl>
    {!ready && <p className="field-help">Confirma primero el tipo resistente de cada barra.</p>}
    <form className="precision-form" onSubmit={event => {
      event.preventDefault()
      dispatch({ type: 'library', change: { type: 'assign', barIds, materialId: material || undefined,
        sectionId: section || undefined, axis: axis || undefined } })
    }}>
      <label>Material de biblioteca<select value={material} onChange={event => setMaterial(event.target.value)}>
        <option value="">Conservar actual</option>{library.materials.map(item =>
          <option key={item.id} value={item.id}>{item.name}{item.illustrative ? ' · ilustrativo' : ''}</option>)}
      </select></label>
      <label>Sección de biblioteca<select value={section} onChange={event => setSection(event.target.value)}>
        <option value="">Conservar actual</option>{library.sections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      {section && selectedFrame && <label>Eje de flexión para el pórtico<select value={axis} onChange={event => setAxis(event.target.value as SectionAxis | '')}>
        <option value="">Elige qué eje corresponde a z local</option>
        <option value="x">x centroidal → z local · usar Ixx</option>
        <option value="y">y centroidal → z local · usar Iyy</option>
      </select></label>}
      {(library.defaultMaterialId || library.defaultSectionId) && <button type="button" className="button secondary" onClick={() => {
        setMaterial(library.defaultMaterialId ?? '')
        setSection(library.defaultSectionId ?? '')
      }}>Elegir predeterminados del proyecto</button>}
      <button type="submit" className="button primary" disabled={!ready || (!material && !section) || (!!section && selectedFrame && !axis)}>
        Confirmar asignación de biblioteca</button>
      <p className="field-help">La asignación reemplaza los campos elegidos. Guardar E manual separa el material. Guardar A o I manual separa la sección.</p>
    </form>
  </details>
}
