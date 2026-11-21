import { useLayoutEffect, useRef, useState } from 'react'
import { catalogOf } from '../../domain/library'
import type { LibraryEdit } from '../../domain/library'
import type { Structure } from '../../domain/structure'
import { Icon } from '../Icon'
import { MaterialEditor } from './MaterialEditor'
import { SectionEditor } from './SectionEditor'

export function LibraryDialog({ model, edit, close, error }: {
  model: Structure; edit: (change: LibraryEdit) => void; close: () => void; error: string | null
}) {
  const library = catalogOf(model)
  const modal = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<'material' | 'section'>('material')
  const [selected, setSelected] = useState(library.materials[0]?.id)
  const [search, setSearch] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const isMaterial = tab === 'material'
  const material = isMaterial ? library.materials.find(item => item.id === selected) : undefined
  const section = isMaterial ? undefined : library.sections.find(item => item.id === selected)
  const current = material ?? section
  const entries = isMaterial ? library.materials : library.sections
  const defaultId = isMaterial ? library.defaultMaterialId : library.defaultSectionId
  const linked = model.mechanics.assignments.filter(item =>
    current && (isMaterial ? item.materialId : item.sectionId) === current.id).length

  useLayoutEffect(() => {
    const target = modal.current!
    const previous = document.activeElement
    target.showModal()
    return () => {
      target.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  function choose(id?: string) {
    setSelected(id)
    setAttempted(false)
    setConfirming(false)
  }

  function change(next: LibraryEdit) {
    setAttempted(true)
    edit(next)
  }

  function duplicate() {
    if (!current) return
    const id = crypto.randomUUID()
    const name = `${current.name.slice(0, 72)} (copia)`
    if (material) change({ type: 'save-material', material: { ...material, id, name, editable: true,
      revisedAt: new Date().toISOString() }, updateLinked: false })
    if (section) change({ type: 'save-section', id, name, geometry: section.geometry, updateLinked: false })
    setSelected(id)
  }

  return <dialog ref={modal} className="workspace-dialog library-dialog" aria-labelledby="library-heading"
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => { if (event.currentTarget === event.target) close() }}>
    <div className="dialog-surface">
      <header className="dialog-heading"><Icon name="book" size={20} /><h2 id="library-heading">Biblioteca del proyecto</h2>
        <button type="button" className="icon-button" aria-label="Cerrar biblioteca" onClick={close}><Icon name="close" size={18} /></button>
      </header>
      <div className="dialog-content library-content">
        <div className="library-tabs" role="group" aria-label="Tipos de biblioteca">
          <button className="button secondary" aria-pressed={isMaterial} type="button" onClick={() => {
            if (!isMaterial) { setTab('material'); setSearch(''); choose(library.materials[0]?.id) }
          }}>Materiales</button>
          <button className="button secondary" aria-pressed={!isMaterial} type="button" onClick={() => {
            if (isMaterial) { setTab('section'); setSearch(''); choose(library.sections[0]?.id) }
          }}>Secciones</button>
        </div>
        <div className="library-workarea">
          <aside className="library-list precision-form" aria-label={isMaterial ? 'Catálogo de materiales' : 'Catálogo de secciones'}>
            <label>Buscar {isMaterial ? 'material' : 'sección'}<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <button type="button" className="button secondary" onClick={() => choose()}>{isMaterial ? 'Nuevo material' : 'Nueva sección'}</button>
            <ul>{entries.filter(item => [item.name, 'category' in item ? item.category : item.geometry.kind].join(' ')
              .toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(item => <li key={item.id}>
              <button type="button" className="button secondary" aria-pressed={item.id === selected} onClick={() => choose(item.id)}>
                {item.name}{item.id === defaultId && <small>Predeterminado</small>}
                {'illustrative' in item && item.illustrative && <small>Ilustrativo</small>}
              </button>
            </li>)}</ul>
          </aside>
          <div className="library-entry">
            {attempted && error && <p className="form-error" role="alert">{error}</p>}
            {current && <div className="library-actions library-entry-actions">
              <button type="button" className="button secondary" onClick={duplicate}>{isMaterial ? 'Duplicar material' : 'Duplicar sección'}</button>
              <button type="button" className="button secondary" onClick={() => change({ type: 'default', category: tab,
                id: defaultId === current.id ? undefined : current.id })}>
                {defaultId === current.id ? 'Quitar predeterminado' : 'Usar como predeterminado'}</button>
              <button type="button" className="button secondary" onClick={() => { setConfirming(true); setAttempted(false) }}>Eliminar entrada</button>
            </div>}
            {current && confirming && <div className="library-confirm">
              <p>¿Eliminar «{current.name}» de este proyecto?</p>
              <div className="library-actions"><button type="button" className="button secondary" onClick={() => setConfirming(false)}>Cancelar eliminación</button>
                <button type="button" className="button primary" onClick={() => {
                  change({ type: 'delete', category: tab, id: current.id }); setConfirming(false)
                }}>Confirmar eliminación</button></div>
            </div>}
            {isMaterial
              ? <MaterialEditor key={material?.id ?? 'new-material'} material={material} linked={linked} edit={change} select={setSelected} />
              : <SectionEditor key={section?.id ?? 'new-section'} section={section} linked={linked} edit={change} select={setSelected} />}
          </div>
        </div>
      </div>
    </div>
  </dialog>
}
