import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { projectStore } from '../infrastructure/projectStore'
import { importProject, makeProject, projectName } from '../projects/document'
import type { ProjectDocument } from '../projects/document'
import { copyAcademicExample } from '../projects/academicExamples'
import { messageFor } from '../projects/useProjectSave'
import type { useProjectSave, WorkspaceProject } from '../projects/useProjectSave'
import { Icon } from './Icon'
import { AcademicCatalog } from './academic/AcademicCatalog'
import { ProjectHelp } from './academic/AcademicHelp'

type SaveState = ReturnType<typeof useProjectSave>

export function ProjectMenu({ open, close, storage, rename, activate, openLibrary }: {
  open: boolean
  close: () => void
  storage: SaveState
  rename: (name: string) => void
  activate: (project: WorkspaceProject) => void
  openLibrary: () => void
}) {
  if (!open) return null
  return <ProjectDialog close={close} storage={storage} rename={rename} activate={activate} openLibrary={openLibrary} />
}

function ProjectDialog({ close, storage, rename, activate, openLibrary }: Omit<Parameters<typeof ProjectMenu>[0], 'open'>) {
  const { snapshot, save, settle, exportSnapshot } = storage
  const dialog = useRef<HTMLDialogElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof projectStore.list>>>([])
  const [name, setName] = useState(snapshot.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  useLayoutEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    let current = true
    void projectStore.list().then(values => { if (current) setProjects(values) })
      .catch(cause => { if (current) setError(messageFor(cause)) })
    return () => { current = false }
  }, [])

  async function run(operation: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await operation() }
    catch (cause) { setError(messageFor(cause)) }
    finally { setBusy(false) }
  }

  async function canLeave() {
    try { await save(); return true }
    catch (cause) {
      return window.confirm(`Hay cambios sin guardar. ${messageFor(cause)} ¿Salir de todos modos?`)
    }
  }

  async function begin(document: ProjectDocument) {
    const result = await projectStore.save(document, null, true)
    activate(result)
  }

  function exportFile() {
    const json = new Blob([JSON.stringify(exportSnapshot(), null, 2) + '\n'], { type: 'application/json' })
    const href = URL.createObjectURL(json)
    const link = document.createElement('a')
    link.href = href
    link.download = `${snapshot.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  return <dialog className="workspace-dialog project-dialog" ref={dialog} aria-labelledby="project-menu-heading"
    onCancel={event => { event.preventDefault(); if (!busy) close() }}
    onClick={event => { if (event.target === event.currentTarget && !busy) close() }}>
    <div className="dialog-surface">
      <header className="dialog-heading"><Icon name="layers" size={20} />
        <h2 id="project-menu-heading">Proyectos locales</h2>
        <button type="button" className="icon-button" aria-label="Cerrar proyectos" disabled={busy} onClick={close}><Icon name="close" size={18} /></button>
      </header>
      <div className="dialog-content project-controls">
        <p className="field-help">IndexedDB guarda en este navegador. Exporta un archivo JSON para llevar una copia fuera del navegador.</p>
        {(error || storage.error) && <p className="form-error" role="alert">{error || storage.error}</p>}
        <div className="project-actions">
          <button type="button" className="button secondary" disabled={busy}
            aria-expanded={catalogOpen} aria-controls="academic-projects" onClick={() => setCatalogOpen(!catalogOpen)}>
            {catalogOpen ? 'Volver a proyectos' : 'Ejemplos'}
          </button>
        </div>
        <div id="academic-projects" hidden={!catalogOpen}>
          {catalogOpen && <AcademicCatalog busy={busy} openCopy={example => void run(async () => {
            if (await canLeave()) await begin(copyAcademicExample(example))
          })} />}
        </div>
        {!catalogOpen && <>
        <div className="project-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={() => { close(); openLibrary() }}>Biblioteca de materiales y secciones</button>
          <button className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => {
            if (await canLeave()) await begin(makeProject())
          })}>Nuevo proyecto</button>
          <button className="button primary" type="button" disabled={busy} onClick={() => void run(async () => {
            await save(true)
            setProjects(await projectStore.list())
          })}>Guardar proyecto</button>
          <button className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => {
            await begin(makeProject(`${snapshot.name.slice(0, 72)} (copia)`, snapshot.model, snapshot.view, snapshot.design))
          })}>Guardar como copia</button>
          <button className="button secondary" type="button" disabled={busy} onClick={exportFile}>Exportar JSON</button>
          <button className="button secondary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Importar JSON</button>
          <input hidden type="file" accept=".json,application/json" ref={fileInput} aria-label="Archivo de proyecto JSON" onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file) return
            void run(async () => {
              const imported = importProject(await file.text())
              if (await canLeave()) activate(await projectStore.import(imported))
            })
          }} />
        </div>
        <form className="precision-form" onSubmit={event => {
          event.preventDefault()
          void run(async () => { rename(projectName(name)); close() })
        }}>
          <label>Nombre del proyecto activo<input value={name} maxLength={80}
            onChange={event => setName(event.target.value)} /></label>
          <button className="button secondary" type="submit" disabled={busy}>Renombrar proyecto</button>
        </form>
        <h3>Proyectos guardados</h3>
        {projects.length ? <ul className="local-project-list">
          {projects.map(project => <li key={project.id}>
            <span><strong>{project.name}</strong><small>{new Date(project.modifiedAt).toLocaleString('es')}</small></span>
            {project.id === snapshot.id ? <small>Activo</small> : <button type="button" className="button secondary" disabled={busy}
              aria-label={`Abrir ${project.name}`} onClick={() => void run(async () => {
                if (await canLeave()) activate(await projectStore.open(project.id))
              })}>Abrir</button>}
            <button type="button" className="button secondary" disabled={busy} aria-label={`Eliminar ${project.name}`}
              onClick={() => void run(async () => {
                if (!window.confirm(`¿Eliminar «${project.name}» de este navegador?`)) return
                await settle()
                await projectStore.remove(project.id)
                if (project.id === snapshot.id) activate({ document: makeProject(), revision: null })
                else setProjects(await projectStore.list())
              })}>Eliminar</button>
          </li>)}
        </ul> : <p className="field-help">Aún no hay proyectos guardados.</p>}
        <ProjectHelp />
        </>}
      </div>
    </div>
  </dialog>
}
