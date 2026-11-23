import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { EMPTY_STRUCTURE } from '../../src/domain/structure'
import type { Structure } from '../../src/domain/structure'
import type { StructuralLoad } from '../../src/domain/load'
import type { ProjectDocument } from '../../src/projects/document'
import { DEFAULT_LIBRARY } from '../../src/domain/library'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const state = (page: Page) => page.getByRole('status', { name: 'Estado de análisis' })
const results = (page: Page) => page.getByRole('complementary', { name: 'Resultados del análisis' })
const panel = (page: Page) => page.getByRole('complementary', { name: 'Inspector' })
const saved = (page: Page) => page.getByRole('status', { name: 'Estado de guardado' })
const E = 200e9
const FIX = { kind: 'fixed', nodeId: 'N1' } as const
const PIN = { kind: 'pinned', nodeId: 'N1' } as const
const ROLL = { kind: 'roller', nodeId: 'N2', surfaceAngle: 0 } as const

function force(nodeId: string, x: number, y: number, id = 'C1'): StructuralLoad {
  return { id, kind: 'nodal', nodeId, force: { x, y }, moment: 0 }
}

type LegacyProject = Omit<ProjectDocument, 'schemaVersion'> & { schemaVersion: 2 }

function project(key: string, points: readonly (readonly [number, number])[], connections: readonly (readonly [number, number])[],
  supports: Structure['supports'], loads: Structure['loads'], kind: 'truss2d' | 'frame2d', I = 8e-6): LegacyProject {
  const bars = connections.map(([start, end], index) => ({
    id: `B${index + 1}`, label: `B${index + 1}`, startId: `N${start}`, endId: `N${end}`,
  }))
  return { id: `reference-${key.replace(/[^a-zA-Z0-9_-]+/g, '-')}`, name: key, schemaVersion: 2,
    createdAt: '2026-11-21T12:00:00.000Z', modifiedAt: '2026-11-21T12:00:00.000Z', view: { grid: true, dimensions: 'hidden' },
    model: { ...EMPTY_STRUCTURE, nodes: points.map(([x, y], i) => ({ id: `N${i + 1}`, label: `N${i + 1}`, x, y })),
      bars, supports, loads, nextNode: points.length + 1, nextBar: bars.length + 1, nextLoad: loads.length + 1,
      mechanics: { version: 1, assignments: bars.map(({ id }) => kind === 'truss2d'
        ? { barId: id, kind, E, A: .001 } : { barId: id, kind, E, A: .02, I }) } } }
}

async function importFile(page: Page, file: unknown) {
  await button(page, 'Proyectos').click()
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'referencia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)),
  })
}

async function openProject(page: Page, fixture: LegacyProject) {
  await page.goto('./')
  await importFile(page, fixture)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.document-title strong')).toHaveText(fixture.name)
}

async function exportFile(page: Page) {
  await button(page, 'Proyectos').click()
  const pending = page.waitForEvent('download')
  await button(page, 'Exportar JSON').click()
  const path = await (await pending).path()
  if (!path) throw new Error('Se esperaba el JSON exportado')
  const data = JSON.parse(await readFile(path, 'utf8')) as ProjectDocument
  await button(page, 'Cerrar proyectos').click()
  return data
}

async function run(page: Page, expected = 'Resultado vigente') {
  await button(page, 'Analizar estructura').click()
  await expect(state(page)).toHaveText(expected)
}

async function pickBar(page: Page, barId: string, modifiers: ('Control' | 'Shift')[] = []) {
  const line = page.locator(`[data-bar-id="${barId}"] .member-line`)
  const box = await line.boundingBox()
  if (!box) throw new Error(`La barra ${barId} no es visible`)
  for (const key of modifiers) await page.keyboard.down(key)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  for (const key of modifiers) await page.keyboard.up(key)
}

function cells(page: Page, table: string, id: string) {
  return page.getByRole('table', { name: table, exact: true }).getByRole('row')
    .filter({ has: button(page, id) }).getByRole('cell')
}

async function numericalCell(page: Page, table: string, id: string, column: number, expected: number, tolerance: number) {
  const value = await cells(page, table, id).nth(column).innerText()
  expect(Math.abs(Number(value) - expected)).toBeLessThanOrEqual(tolerance)
}

test('resuelve las referencias de armadura axial, triangular y rodillo inclinado en la interfaz', async ({ page }) => {
  const axial = project('Barra axial', [[0, 0], [2, 0]], [[1, 2]], [PIN, ROLL], [force('N2', 10000, 0)], 'truss2d')
  const styles = page.waitForResponse(response =>
    new URL(response.url()).pathname.startsWith('/aula-estructural/assets/') && response.request().resourceType() === 'stylesheet')
  await openProject(page, axial)
  expect((await styles).ok()).toBe(true)
  expect(new URL(page.url()).pathname).toBe('/aula-estructural/')
  await expect(page.getByText('Beta 0.2', { exact: true })).toBeVisible()
  await expect(page.getByText('Uso educativo. No utilizar para diseño profesional.', { exact: true })).toBeVisible()
  await expect(page.locator('.brand-mark svg')).toBeVisible()
  await expect(page.locator('svg [data-bar-id="B1"] .member-line')).toHaveCSS('stroke', 'rgb(138, 224, 240)')
  const workerResponse = page.waitForResponse(response =>
    /\/aula-estructural\/assets\/analysis\.worker-[^/]+\.js$/.test(new URL(response.url()).pathname))
  await run(page)
  const worker = await workerResponse
  expect(worker.ok()).toBe(true)
  expect(new URL(worker.url()).origin).toBe(new URL(page.url()).origin)
  expect(worker.headers()['content-type']).toMatch(/javascript/)
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 0, .1, 1e-8)
  await numericalCell(page, 'Reacciones de apoyo', 'N1', 0, -10, 1e-8)
  await expect(results(page).getByText('Armadura 2D · Tracción')).toBeVisible()
  await expect(results(page).getByText('4 / 1', { exact: true })).toBeVisible()

  const triangle = project('Armadura triangular', [[0, 0], [4, 0], [2, 3]], [[1, 2], [1, 3], [2, 3]], [PIN, ROLL],
    [force('N3', 0, -12000)], 'truss2d')
  await openProject(page, triangle)
  await run(page)
  await numericalCell(page, 'Desplazamientos nodales', 'N3', 1, -.182907221937, 1e-7)
  await numericalCell(page, 'Reacciones de apoyo', 'N1', 1, 6, 1e-8)
  await numericalCell(page, 'Reacciones de apoyo', 'N2', 1, 6, 1e-8)
  await results(page).getByLabel('Barra de resultados').selectOption('B2')
  await expect(page.locator('[data-bar-id="B2"]')).toHaveClass(/is-selected/)
  await expect(results(page).getByText('Armadura 2D · Compresión')).toBeVisible()
  await pickBar(page, 'B3')
  await expect(results(page).getByLabel('Barra de resultados')).toHaveValue('B3')

  const roller = project('Rodillo inclinado', [[0, 0], [2, 0]], [[1, 2]], [PIN, { ...ROLL, surfaceAngle: Math.PI / 4 }],
    [force('N2', 0, -10000)], 'truss2d')
  await openProject(page, roller)
  await run(page)
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 0, -.1, 1e-8)
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 1, -.1, 1e-8)
  await numericalCell(page, 'Reacciones de apoyo', 'N2', 0, -10, 1e-8)
  await numericalCell(page, 'Reacciones de apoyo', 'N2', 1, 10, 1e-8)
})

test('verifica viga, voladizo y pórtico, consulta una sección y navega por bloques de traza', async ({ page, context }) => {
  const beam = project('Viga simplemente apoyada', [[0, 0], [6, 0]], [[1, 2]], [PIN, ROLL],
    [{ kind: 'point', id: 'C1', barId: 'B1', s: 3, frame: 'global', force: { x: 0, y: -12000 } }], 'frame2d')
  await openProject(page, beam)
  await run(page)
  await numericalCell(page, 'Reacciones de apoyo', 'N1', 1, 6, 1e-8)
  await results(page).getByLabel('Estación s (m)').fill('3')
  const section = results(page).getByRole('table', { name: 'Valores de sección' })
  const values = section.locator('tbody td')
  await expect(values.nth(1)).toHaveText('-6')
  await expect(values.nth(2)).toHaveText('18')
  await expect(values.nth(4)).toHaveText('-33.75')
  await results(page).getByLabel('Lado del corte').selectOption('left')
  await expect(values.nth(1)).toHaveText('6')
  await results(page).getByRole('table', { name: 'Desplazamientos nodales' }).getByRole('button', { name: 'N2' }).click()
  await expect(page.locator('[data-node-id="N2"]')).toHaveClass(/is-selected/)
  if (process.env.AULA_ANALYSIS_CAPTURES) {
    await section.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/media/hito-4.4-seccion.png', animations: 'disabled' })
  }

  const cantilever = project('Voladizo', [[0, 0], [3, 0]], [[1, 2]], [FIX], [force('N2', 0, -8000)], 'frame2d', 1e-5)
  await openProject(page, cantilever)
  await run(page)
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 1, -36, 1e-7)
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 2, -.018, 1e-10)
  await numericalCell(page, 'Reacciones de apoyo', 'N1', 2, 24, 1e-7)

  const portal = project('Pórtico de referencia', [[0, 0], [0, 2], [2, 2], [2, 0]], [[1, 2], [2, 3], [4, 3]],
    [FIX, { ...FIX, nodeId: 'N4' }], [force('N2', 10000, 0), force('N3', 10000, 0, 'C2')], 'frame2d', 2e-5)
  await openProject(page, portal)
  await run(page)
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 0, 2.38462270435, 1e-6)
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 1, .00428204396232, 1e-9)
  await numericalCell(page, 'Desplazamientos nodales', 'N3', 2, -.000717956037682, 1e-10)
  await numericalCell(page, 'Reacciones de apoyo', 'N4', 2, 11.43591207536, 1e-5)
  const step = results(page).getByLabel('Paso de cálculo')
  await step.selectOption('K')
  const matrix = results(page).getByRole('table', { name: 'Matriz global K' })
  await expect(matrix.getByRole('row')).toHaveCount(7)
  await page.getByLabel('Comienzo de filas').selectOption('6')
  await expect(matrix.getByRole('rowheader', { name: 'N3.ux' })).toBeVisible()
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await button(page, 'Copiar bloque').click()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(/N3\.ux\t/)
  if (process.env.AULA_ANALYSIS_CAPTURES) {
    await matrix.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/media/hito-4.4-traza.png', animations: 'disabled' })
  }
  for (const [value, heading] of [['local', 'Rigidez local k'], ['transform', 'Transformación T'],
    ['element', 'Aporte al ensamblaje'], ['F', 'Vector global F'], ['Q', 'Restricciones Q'], ['Kr', 'Matriz reducida Kr']]) {
    await step.selectOption(value!)
    await expect(results(page).getByRole('table', { name: heading!, exact: true })).toBeVisible()
  }
  await button(page, 'Resolver').click()
  await expect(step).toHaveCount(0)
  await expect(state(page)).toHaveText('Resultado vigente')
  await page.setViewportSize({ width: 390, height: 740 })
  await expect(button(page, 'Analizar estructura')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})

test('avisa de propiedades pendientes y migración v1, edita en lote, deshace y guarda en esquema actual', async ({ page }) => {
  const source = project('Proyecto histórico', [[0, 0], [3, 0], [6, 0]], [[1, 2], [2, 3]], [FIX], [], 'frame2d')
  const { mechanics, ...oldModel } = source.model
  await page.goto('./')
  await importFile(page, { ...source, schemaVersion: 1, model: oldModel })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const migrated = await exportFile(page)
  expect(migrated).toMatchObject({ id: source.id, schemaVersion: 6, createdAt: source.createdAt, modifiedAt: source.modifiedAt })
  expect(migrated.model).toEqual({ ...oldModel, mechanics: { version: 1, assignments: [] }, library: DEFAULT_LIBRARY })
  await run(page, 'Datos incompletos')
  await expect(results(page).getByRole('list', { name: 'Diagnósticos de análisis' }).getByRole('button', { name: 'B1' })).toBeVisible()
  await button(page, 'Volver al Inspector').click()
  await pickBar(page, 'B1')
  await panel(page).getByText('Propiedades mecánicas', { exact: true }).click()
  await panel(page).getByLabel('Tipo resistente').selectOption('frame2d')
  await panel(page).getByLabel('E (GPa)', { exact: true }).fill('200')
  await panel(page).getByLabel('A (cm²)', { exact: true }).fill('200')
  await panel(page).getByLabel('I (cm⁴)', { exact: true }).fill('-1')
  await button(page, 'Guardar propiedades').click()
  await expect(panel(page).getByRole('alert')).toHaveText('I debe ser finito y mayor que cero.')
  await expect(button(page, 'Deshacer')).toBeDisabled()
  await panel(page).getByLabel('I (cm⁴)', { exact: true }).fill('800')
  await button(page, 'Guardar propiedades').click()
  await expect(panel(page).getByText('EA (N)', { exact: true })).toBeVisible()
  await expect(panel(page).getByText('EI (N·m²)', { exact: true })).toBeVisible()
  if (process.env.AULA_ANALYSIS_CAPTURES) {
    await panel(page).getByText('Propiedades mecánicas', { exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/media/hito-4.5-propiedades.png', animations: 'disabled' })
  }
  await panel(page).getByLabel('A (cm²)', { exact: true }).fill('999')
  await button(page, 'Cancelar cambios').click()
  await expect(panel(page).getByLabel('A (cm²)', { exact: true })).toHaveValue('200')

  await pickBar(page, 'B2', ['Control'])
  await panel(page).getByText('Propiedades mecánicas', { exact: true }).click()
  await expect(panel(page).getByLabel('E (GPa)', { exact: true })).toHaveAttribute('placeholder', 'Valores diferentes')
  await panel(page).getByLabel('Tipo resistente').selectOption('frame2d')
  await panel(page).getByLabel('E (GPa)', { exact: true }).fill('210')
  await panel(page).getByLabel('A (cm²)', { exact: true }).fill('250')
  await panel(page).getByLabel('I (cm⁴)', { exact: true }).fill('900')
  await button(page, 'Aplicar a las barras seleccionadas').click()
  await button(page, 'Deshacer').click()
  await expect(panel(page).getByLabel('E (GPa)', { exact: true })).toHaveAttribute('placeholder', 'Valores diferentes')
  await button(page, 'Rehacer').click()
  await expect(panel(page).getByLabel('E (GPa)', { exact: true })).toHaveValue('210')
  await expect(saved(page)).toHaveText('Guardado local')
  const expected = mechanics.assignments.map(item => ({ ...item, E: 210e9, A: .025, I: 9e-6 }))
  const after = await exportFile(page)
  expect(after.model.mechanics.assignments).toEqual(expected)
  await page.reload()
  expect((await exportFile(page)).model.mechanics.assignments).toEqual(expected)
  await importFile(page, { ...after, model: { ...after.model, mechanics: { version: 1,
    assignments: [{ ...expected[0], barId: 'B99' }] } } })
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('barra inexistente B99')
  await button(page, 'Cerrar proyectos').click()
  expect((await exportFile(page)).model.mechanics.assignments).toEqual(expected)
})

test('mantiene la vigencia con zoom y pan, cambia el caso activo y muestra el diagnóstico de un mecanismo', async ({ page }) => {
  const ready = project('Vigencia física', [[0, 0], [2, 0]], [[1, 2]], [PIN, ROLL], [force('N2', 10000, 0)], 'truss2d')
  await openProject(page, ready)
  await run(page)
  const bar = page.locator('[data-bar-id="B1"] .member-line')
  const initial = (await bar.boundingBox())!
  await page.mouse.move(initial.x + initial.width / 2, initial.y)
  await page.mouse.wheel(0, -160)
  await expect.poll(async () => (await bar.boundingBox())!.width).not.toBe(initial.width)
  const zoomed = (await bar.boundingBox())!
  await page.mouse.move(zoomed.x + zoomed.width / 2, zoomed.y)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(zoomed.x + zoomed.width / 2 + 60, zoomed.y + 30, { steps: 3 })
  await page.mouse.up({ button: 'middle' })
  await expect.poll(async () => (await bar.boundingBox())!.x).not.toBe(zoomed.x)
  await page.keyboard.press('F9')
  await expect(state(page)).toHaveText('Resultado vigente')

  await results(page).getByText('Caso activo · Todas las cargas').click()
  await results(page).getByLabel('Incluir automáticamente todas las cargas').uncheck()
  await results(page).getByLabel('C1 · N2').uncheck()
  await expect(state(page)).toHaveText('Resultado desactualizado')
  await expect(results(page).getByRole('table', { name: 'Desplazamientos nodales' })).toHaveCount(0)
  await run(page)
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 0, 0, 1e-8)

  await button(page, 'Volver al Inspector').click()
  await pickBar(page, 'B1')
  await panel(page).getByText('Propiedades mecánicas', { exact: true }).click()
  await panel(page).getByLabel('E (GPa)', { exact: true }).fill('210')
  await button(page, 'Guardar propiedades').click()
  await button(page, 'Resultados').click()
  await expect(state(page)).toHaveText('Resultado desactualizado')
  await button(page, 'Deshacer').click()
  await expect(state(page)).toHaveText('Resultado desactualizado')
  await run(page)

  const mechanism = project('Mecanismo de prueba', [[0, 0], [2, 0]], [[1, 2]], [PIN], [], 'truss2d')
  await openProject(page, mechanism)
  await button(page, 'Resultados').click()
  await expect(state(page)).toHaveText('Sin análisis')
  await run(page, 'Análisis fallido')
  const diagnostics = results(page).getByRole('list', { name: 'Diagnósticos de análisis' })
  await expect(diagnostics).toContainText('Coordenada libre sin rigidez positiva')
  await expect(diagnostics.getByRole('button', { name: 'N2' })).toBeVisible()
  await expect(results(page).getByRole('table', { name: 'Desplazamientos nodales' })).toHaveCount(0)
})

test('descarta respuestas atrasadas al editar y al repetir el cálculo', async ({ page }) => {
  await page.addInitScript(() => {
    const WorkerBase = window.Worker
    let requests = 0
    let delayed = 0
    window.Worker = class extends WorkerBase {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        const ordinal = ++requests
        this.addEventListener('message', event => {
          if (!(event instanceof MessageEvent) || !event.isTrusted) return
          event.stopImmediatePropagation()
          const received = event.data
          setTimeout(() => {
            this.dispatchEvent(new MessageEvent('message', { data: received }))
            if (ordinal < 3) document.documentElement.dataset.analysisTestDelayed = String(++delayed)
            super.terminate()
          }, ordinal === 1 ? 1200 : ordinal === 2 ? 2400 : 30)
        })
      }
      // Emula una respuesta que ya estaba encolada al cancelar el trabajo.
      override terminate() {}
    }
  })
  const ready = project('Respuestas atrasadas', [[0, 0], [3, 0]], [[1, 2]], [FIX], [force('N2', 0, -8000)], 'frame2d', 1e-5)
  await openProject(page, ready)
  await run(page, 'Analizando…')
  await results(page).getByText('Caso activo · Todas las cargas').click()
  await results(page).getByLabel('Incluir automáticamente todas las cargas').uncheck()
  await results(page).getByLabel('C1 · N2').uncheck()
  await expect(state(page)).toHaveText('Resultado desactualizado')
  await run(page, 'Analizando…')
  await run(page)
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 1, 0, 1e-8)
  // Las dos primeras respuestas deben llegar sin cambiar el cálculo vigente.
  await expect(page.locator('html')).toHaveAttribute('data-analysis-test-delayed', '2')
  await expect(state(page)).toHaveText('Resultado vigente')
  await numericalCell(page, 'Desplazamientos nodales', 'N2', 1, 0, 1e-8)
})

test('migra IndexedDB v1 al guardar y conserva un registro de una versión posterior', async ({ page }) => {
  await page.goto('./')
  const source = project('Registro IndexedDB v1', [[0, 0], [2, 0]], [[1, 2]], [FIX], [force('N2', 0, -8000)], 'frame2d')
  const { mechanics: _, ...oldModel } = source.model
  const legacy = { ...source, schemaVersion: 1, model: oldModel }
  const seedStored = (document: unknown, revision: number) => page.evaluate(({ id, document, revision }) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('aula-estructural-projects', 1)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction(['projects', 'settings'], 'readwrite')
      tx.objectStore('projects').put({ id, document, revision })
      tx.objectStore('settings').put(id, 'last-project')
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
    open.onerror = () => reject(open.error)
  }), { id: source.id, document, revision })
  await seedStored(legacy, 3)
  await page.reload()
  await expect(page.locator('.document-title strong')).toHaveText(source.name)
  const readStored = () => page.evaluate(id => new Promise<{ revision: number; document: unknown }>((resolve, reject) => {
    const open = indexedDB.open('aula-estructural-projects', 1)
    open.onsuccess = () => {
      const db = open.result
      const record = db.transaction('projects').objectStore('projects').get(id)
      record.onsuccess = () => { db.close(); resolve(record.result) }
      record.onerror = () => { db.close(); reject(record.error) }
    }
    open.onerror = () => reject(open.error)
  }), source.id)
  expect(await readStored()).toEqual({ document: legacy, revision: 3, id: source.id })
  await button(page, 'Proyectos').click()
  await button(page, 'Guardar proyecto').click()
  await expect.poll(async () => (await readStored()).revision).toBe(4)
  const migrated = { ...legacy, schemaVersion: 6,
    model: { ...oldModel, mechanics: { version: 1, assignments: [] }, library: DEFAULT_LIBRARY } }
  expect((await readStored()).document).toEqual(migrated)
  const future = { ...migrated, schemaVersion: 7 }
  await seedStored(future, 5)
  await page.reload()
  await expect(saved(page)).toHaveText('Recuperación local fallida')
  expect(await readStored()).toEqual({ document: future, revision: 5, id: source.id })
})

test('Aprender guía los 15 pasos y enlaza los términos, cargas y secciones con el CAD', async ({ page, context }) => {
  const source = project('Rigideces educativas', [[0, 0], [2, 0], [4, 0]], [[1, 2], [2, 3]],
    [FIX, { ...ROLL, nodeId: 'N3', surfaceAngle: Math.PI / 4 }],
    [{ kind: 'point', id: 'C1', barId: 'B2', s: 1, frame: 'local', force: { x: 0, y: -12000 } },
      force('N2', 0, -1000, 'C2')], 'frame2d')
  await openProject(page, source)
  await run(page)
  await button(page, 'Desarrollo').click()
  const lesson = page.getByRole('region', { name: 'Detalle matemático' })
  const step = lesson.getByLabel('Paso de cálculo')
  await expect(lesson).toContainText('Paso 1 de 15')
  await expect(button(page, 'Anterior')).toBeDisabled()
  await lesson.getByRole('table', { name: 'Nudos del análisis' }).getByRole('button', { name: 'N2' }).click()
  await expect(page.locator('[data-node-id="N2"]')).toHaveClass(/is-selected/)
  await button(page, 'Siguiente').click()
  await expect(step).toHaveValue('dofs')
  await button(page, 'Siguiente').click()
  await expect(step).toHaveValue('supports')
  const supports = lesson.getByRole('table', { name: 'Restricciones por apoyo' })
  await expect(supports).toContainText('(-0.7071068, 0.7071068)')
  await expect(supports).toContainText('(0.7071068, 0.7071068)')
  await button(page, 'Anterior').click()
  await expect(step).toHaveValue('dofs')
  await step.selectOption('local')
  await lesson.getByLabel('Barra del desarrollo').selectOption('B2')
  await expect(lesson).toContainText('EA/L = (200000000000 × 0.02) / 2 = 2000000000 N/m')
  await expect(page.locator('[data-bar-id="B2"]')).toHaveClass(/is-selected/)
  await button(page, 'Ocultar detalle').click()
  await expect(lesson.getByRole('table', { name: 'Rigidez local k' })).toHaveCount(0)
  await button(page, 'Mostrar detalle').click()
  await expect(lesson.getByRole('table', { name: 'Rigidez local k' })).toBeVisible()
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await button(page, 'Copiar ecuación').click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('p = k d − fₑ')
  await step.selectOption('loads')
  await expect(lesson.getByRole('table', { name: 'Aportes de cargas de barra' })).toContainText('-6000')
  await step.selectOption('K')
  await lesson.getByRole('button', { name: 'Matriz global K, N2.rz, N2.rz' }).click()
  await expect(page.locator('[data-node-id="N2"]')).toHaveClass(/is-selected/)
  const terms = lesson.getByRole('table', { name: 'Aportes elementales' })
  for (const id of ['B1', 'B2']) await expect(terms.getByRole('button', { name: id, exact: true })).toBeVisible()
  await expect(lesson).toContainText('Suma verificada · 6400000 N·m/rad')
  await terms.getByRole('button', { name: 'B2', exact: true }).click()
  await expect(page.locator('[data-bar-id="B2"]')).toHaveClass(/is-selected/)
  if (process.env.AULA_LESSON_CAPTURES) {
    await terms.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/media/hito-5.1-ensamblaje.png', animations: 'disabled' })
  }
  await step.selectOption('Kr')
  await expect(lesson.getByRole('table', { name: 'Matriz reducida Kr' })).toBeVisible()
  await step.selectOption('z')
  await expect(lesson.getByRole('table', { name: 'Desplazamientos recuperados u' })).toBeVisible()
  await step.selectOption('recovery')
  await page.getByLabel('Estación s (m)').fill('1')
  await page.getByLabel('Estación s (m)').press('Enter')
  await expect(lesson).toContainText('Sección consultada B2 · s = 1 m')
  await button(page, 'Ver sección en AVM').click()
  await expect(page.getByRole('region', { name: 'Diagramas AVM separados' }).getByLabel('Consulta en las franjas')).toContainText('s = 1 m')
  await expect(button(page, 'Deshacer')).toBeDisabled()
  await button(page, 'Resolver').click()
  await expect(lesson).toHaveCount(0)
  await expect(state(page)).toHaveText('Resultado vigente')
  await button(page, 'Aprender').click()
  await page.getByText('Caso activo · Todas las cargas').click()
  await page.getByLabel('Incluir automáticamente todas las cargas').uncheck()
  await expect(state(page)).toHaveText('Resultado desactualizado')
  await expect(lesson).toHaveCount(0)
})
