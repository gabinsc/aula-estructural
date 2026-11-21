import { readProject } from '../projects/document'
import type { ProjectDocument } from '../projects/document'

export interface StoredProject {
  readonly document: ProjectDocument
  readonly revision: number
}

const DATABASE = 'aula-estructural-projects'
const DATABASE_VERSION = 1
const PROJECTS = 'projects'
const SETTINGS = 'settings'
const LAST = 'last-project'

let database: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error('IndexedDB no está disponible en este navegador.'))
        return
      }
      // La evolución de los documentos no requiere cambiar los almacenes de IndexedDB.
      const open = indexedDB.open(DATABASE, DATABASE_VERSION)
      open.onupgradeneeded = () => {
        open.result.createObjectStore(PROJECTS, { keyPath: 'id' })
        open.result.createObjectStore(SETTINGS)
      }
      let blocked = false
      open.onblocked = () => {
        blocked = true
        reject(new Error('Otra pestaña está bloqueando la base de proyectos.'))
      }
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        if (blocked) { db.close(); return }
        const close = () => { db.close(); database = undefined }
        db.onversionchange = close
        db.onclose = close
        resolve(db)
      }
    }).catch((error: unknown) => { database = undefined; throw error })
  }
  return database
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result)
    operation.onerror = () => reject(operation.error)
  })
}

async function transaction<T>(names: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const db = await openDatabase()
  const tx = db.transaction(names, mode)
  const finished = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('La transacción local fue cancelada.'))
    tx.onerror = () => reject(tx.error ?? new Error('Error al escribir en IndexedDB.'))
  })
  try {
    const [value] = await Promise.all([run(tx), finished])
    return value
  } catch (error) {
    try { tx.abort() } catch { /* La transacción ya terminó. */ }
    throw error
  }
}

interface Row { id: string; document: unknown; revision: number }
function decode(row: Row | undefined): StoredProject | null {
  if (!row) return null
  const document = readProject(row.document)
  if (row.id !== document.id || !Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new Error('El registro local es inconsistente.')
  }
  return { document, revision: row.revision }
}

export const projectStore = {
  async last(): Promise<StoredProject | null> {
    return transaction([PROJECTS, SETTINGS], 'readonly', async tx => {
      const id: unknown = await request(tx.objectStore(SETTINGS).get(LAST))
      return typeof id === 'string' ? decode(await request(tx.objectStore(PROJECTS).get(id))) : null
    })
  },
  async open(id: string): Promise<StoredProject> {
    return transaction([PROJECTS, SETTINGS], 'readwrite', async tx => {
      const row = decode(await request(tx.objectStore(PROJECTS).get(id)))
      if (!row) throw new Error('El proyecto local ya no existe.')
      await request(tx.objectStore(SETTINGS).put(id, LAST))
      return row
    })
  },
  async list(): Promise<readonly Pick<ProjectDocument, 'id' | 'name' | 'modifiedAt'>[]> {
    return transaction([PROJECTS], 'readonly', async tx => {
      const rows: Row[] = await request(tx.objectStore(PROJECTS).getAll())
      return rows.map(row => decode(row)!.document)
        .map(({ id, name, modifiedAt }) => ({ id, name, modifiedAt }))
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name))
    })
  },
  async save(document: ProjectDocument, expected: number | null, activate = false): Promise<StoredProject> {
    const valid = readProject(document)
    return transaction(activate ? [PROJECTS, SETTINGS] : [PROJECTS], 'readwrite', async tx => {
      const store = tx.objectStore(PROJECTS)
      const row: Row | undefined = await request(store.get(valid.id))
      if ((row?.revision ?? null) !== expected) {
        throw new Error('El proyecto cambió en otra pestaña o fue eliminado. Exporta tus cambios o guarda una copia.')
      }
      if (row) decode(row)
      const revision = (expected ?? 0) + 1
      await request(store.put({ id: valid.id, document: valid, revision }))
      if (activate) await request(tx.objectStore(SETTINGS).put(valid.id, LAST))
      return { document: valid, revision }
    })
  },
  async import(document: ProjectDocument): Promise<StoredProject> {
    const valid = readProject(document)
    return transaction([PROJECTS, SETTINGS], 'readwrite', async tx => {
      const store = tx.objectStore(PROJECTS)
      const occupied = await request(store.getKey(valid.id)) !== undefined
      const imported = occupied ? { ...valid, id: crypto.randomUUID() } : valid
      await request(store.add({ id: imported.id, document: imported, revision: 1 }))
      await request(tx.objectStore(SETTINGS).put(imported.id, LAST))
      return { document: imported, revision: 1 }
    })
  },
  async remove(id: string): Promise<void> {
    return transaction([PROJECTS, SETTINGS], 'readwrite', async tx => {
      const settings = tx.objectStore(SETTINGS)
      const last: unknown = await request(settings.get(LAST))
      await request(tx.objectStore(PROJECTS).delete(id))
      if (last === id) await request(settings.delete(LAST))
    })
  },
}
