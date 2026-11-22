import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Structure } from '../domain/structure'
import type { DesignSettings } from '../design/contracts'
import { projectStore } from '../infrastructure/projectStore'
import type { ProjectDocument, ProjectView } from './document'

export type WorkspaceProject = { readonly document: ProjectDocument; readonly revision: number | null }

export function messageFor(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Error desconocido de almacenamiento local.'
}

function sameContents(a: ProjectDocument, b: ProjectDocument) {
  return a.model === b.model && a.name === b.name && a.design === b.design &&
    a.view.grid === b.view.grid && a.view.dimensions === b.view.dimensions
}

export function useProjectSave(initial: WorkspaceProject, name: string, model: Structure, view: ProjectView, design?: DesignSettings) {
  const { grid, dimensions } = view
  const snapshot = useMemo(() => ({ ...initial.document, name, model, view: { grid, dimensions }, design }),
    [initial.document, name, model, grid, dimensions, design])
  const latest = useRef(snapshot)
  latest.current = snapshot
  const committed = useRef(initial.document)
  const revision = useRef(initial.revision)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const queued = useRef(0)
  const alive = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(initial.document)
  const [hasStorage, setHasStorage] = useState(initial.revision !== null)
  const dirty = !sameContents(saved, snapshot)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const save = useCallback((force = false): Promise<void> => {
    const requested = latest.current
    queued.current++
    const write = queue.current.then(async () => {
      const changed = !sameContents(committed.current, requested)
      if (!force && !changed) return
      if (alive.current) { setSaving(true); setError('') }
      try {
        const modifiedAt = changed ? new Date(Math.max(Date.now(), Date.parse(committed.current.modifiedAt))).toISOString()
          : committed.current.modifiedAt
        const stored = await projectStore.save({ ...requested, modifiedAt }, revision.current, revision.current === null)
        revision.current = stored.revision
        committed.current = { ...requested, modifiedAt }
        if (alive.current) { setSaved(requested); setHasStorage(true) }
      } catch (cause) {
        if (alive.current) setError(messageFor(cause))
        throw cause
      } finally {
        if (alive.current) setSaving(false)
      }
    }).finally(() => { queued.current-- })
    queue.current = write.catch(() => undefined)
    return write
  }, [])

  useEffect(() => {
    if (!dirty || error) return
    const timer = setTimeout(() => { void save().catch(() => undefined) }, 450)
    return () => clearTimeout(timer)
  }, [dirty, error, save, snapshot])

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (queued.current || !sameContents(committed.current, latest.current)) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden' && !sameContents(committed.current, latest.current)) {
        void save().catch(() => undefined)
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [save])

  const status = error ? 'Error de guardado local' : saving ? 'Guardando localmente…'
    : dirty ? 'Cambios pendientes' : hasStorage ? 'Guardado local' : 'Proyecto en memoria'
  function exportSnapshot(): ProjectDocument {
    const document = latest.current
    const previous = committed.current
    return sameContents(previous, document) ? previous
      : { ...document, modifiedAt: new Date(Math.max(Date.now(), Date.parse(previous.modifiedAt))).toISOString() }
  }
  return { snapshot, save, status, dirty, error, exportSnapshot, settle: () => queue.current }
}
