import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { ProjectDocument } from '../../src/projects/document'

const button = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Biblioteca del proyecto' })
const analysis = (page: Page) => page.getByRole('status', { name: 'Estado de análisis' })
const saveState = (page: Page) => page.getByRole('status', { name: 'Estado de guardado' })

async function open(page: Page) {
  const direct = button(page, 'Biblioteca de materiales y secciones')
  if (!await direct.isVisible()) await button(page, 'Proyectos').click()
  await direct.click()
  await expect(dialog(page)).toBeVisible()
}

async function capture(page: Page, file: string) {
  if (process.env.AULA_LIBRARY_CAPTURES) await page.screenshot({ path: `docs/media/${file}.png`, animations: 'disabled' })
}

async function importProject(page: Page, file: unknown) {
  await button(page, 'Proyectos').click()
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'biblioteca.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)),
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function exportProject(page: Page) {
  await button(page, 'Proyectos').click()
  const event = page.waitForEvent('download')
  await button(page, 'Exportar JSON').click()
  const path = await (await event).path()
  if (!path) throw new Error('El archivo del proyecto no se descargó')
  const result = JSON.parse(await readFile(path, 'utf8')) as ProjectDocument
  await button(page, 'Cerrar proyectos').click()
  return result
}

async function selectBar(page: Page, id: string, multiple = false) {
  const target = page.locator(`[data-bar-id="${id}"] .member-line`)
  const box = (await target.boundingBox())!
  if (multiple) await page.keyboard.down('Control')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  if (multiple) await page.keyboard.up('Control')
}

test('crea, edita, busca, duplica y elimina materiales con validación y confirmación', async ({ page }) => {
  await page.goto('./')
  await expect(button(page, 'Proyectos')).toBeVisible()
  await open(page)
  const library = dialog(page)
  const search = library.getByLabel('Buscar material')
  await search.fill('aluminio')
  await expect(library.getByRole('button', { name: /Aluminio/ })).toHaveCount(1)
  await expect(library.getByRole('button', { name: /Acero estructural/ })).toHaveCount(0)
  await search.clear()
  await expect(library.getByRole('button', { name: /Material personalizado.*Ilustrativo/ })).toBeVisible()
  await button(page, 'Nuevo material').click()
  await library.getByLabel('Nombre del material').fill('Acero de laboratorio')
  await library.getByLabel('Categoría').fill('Metal')
  await library.getByLabel('Fuente').fill('Ficha de laboratorio del ejercicio')
  await library.getByLabel('Módulo E (GPa)').fill('210')
  await library.getByLabel('Poisson ν (opcional)').fill('.5')
  await button(page, 'Guardar material').click()
  await expect(library.getByRole('alert')).toContainText('−1 < ν < 0,5')
  await library.getByLabel('Poisson ν (opcional)').fill('0,29')
  await library.getByLabel('Densidad (kg/m³)').fill('7850')
  await button(page, 'Guardar material').click()
  await library.getByRole('button', { name: 'Acero de laboratorio', exact: true }).click()
  await button(page, 'Usar como predeterminado').click()
  await expect(library.getByRole('button', { name: /Acero de laboratorio.*Predeterminado/ })).toBeVisible()
  await capture(page, 'hito-5.2-materiales')
  await button(page, 'Duplicar material').click()
  await expect(library.getByLabel('Nombre del material')).toHaveValue('Acero de laboratorio (copia)')
  await button(page, 'Eliminar entrada').click()
  await button(page, 'Cancelar eliminación').click()
  await expect(library.getByLabel('Nombre del material')).toHaveValue('Acero de laboratorio (copia)')
  await button(page, 'Eliminar entrada').click()
  await button(page, 'Confirmar eliminación').click()
  await expect(library.getByRole('button', { name: 'Acero de laboratorio (copia)', exact: true })).toHaveCount(0)
  await button(page, 'Cerrar biblioteca').click()
  await expect(saveState(page)).toHaveText('Guardado local')
  await page.reload()
  await expect(button(page, 'Proyectos')).toBeVisible()
  await open(page)
  await expect(library.getByRole('button', { name: /Acero de laboratorio.*Predeterminado/ })).toBeVisible()
})

test('migra v2, asigna en lote, compara el análisis y recupera la biblioteca en el esquema actual', async ({ page }) => {
  await page.goto('./')
  const I = .4 * .2 ** 3 / 12
  const fixture = {
    schemaVersion: 2, id: 'biblioteca-viga', name: 'Viga con biblioteca', createdAt: '2026-11-21T12:00:00.000Z',
    modifiedAt: '2026-11-21T12:00:00.000Z', view: { grid: true, dimensions: 'hidden' },
    model: { nodes: [0, 2, 4].map((x, i) => ({ id: `N${i + 1}`, label: `N${i + 1}`, x, y: 0 })),
      bars: [1, 2].map(i => ({ id: `B${i}`, label: `B${i}`, startId: `N${i}`, endId: `N${i + 1}` })),
      supports: [{ kind: 'fixed', nodeId: 'N1' }],
      loads: [{ id: 'C1', kind: 'nodal', nodeId: 'N3', force: { x: 0, y: -8000 }, moment: 0 }],
      mechanics: { version: 1, assignments: [1, 2].map(i => ({ barId: `B${i}`, kind: 'frame2d', E: 2e11, A: .08, I })) },
      nextNode: 4, nextBar: 3, nextLoad: 2 },
  }
  await importProject(page, fixture)
  const migrated = await exportProject(page)
  expect(migrated.schemaVersion).toBe(6)
  expect(migrated.model.mechanics).toEqual(fixture.model.mechanics)
  expect(migrated.model.nodes).toEqual(fixture.model.nodes)
  const solve = async () => {
    await button(page, 'Analizar estructura').click()
    await expect(analysis(page)).toHaveText('Resultado vigente')
    const n3 = page.getByRole('table', { name: 'Desplazamientos nodales' }).getByRole('row').filter({ has: button(page, 'N3') })
    const result = Number(await n3.getByRole('cell').nth(1).innerText())
    expect(result).toBeCloseTo(-8000 * 4 ** 3 / (3 * 2e11 * I) * 1e3, 4)
    return result
  }
  const manual = await solve()
  await button(page, 'Opciones AVM').click()
  await button(page, 'M · Momento').click()
  const moment = page.locator('[data-avm-bar="B1"][data-effort="M"] .avm-line')
  const manualCurve = (await moment.getAttribute('d'))!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number)
  await button(page, 'Volver al Inspector').click()
  await open(page)
  await button(page, 'Secciones').click()
  const library = dialog(page)
  await library.getByLabel('Nombre de la sección').fill('Rectangular 200 × 400')
  await library.getByLabel('Ancho b (mm)').fill('200')
  await library.getByLabel('Altura h (mm)').fill('400')
  await expect(library.locator('[data-section-centroid]')).toBeVisible()
  await expect(library.locator('.section-properties')).toContainText('800')
  await button(page, 'Guardar sección').click()
  await expect(library.getByRole('button', { name: 'Rectangular 200 × 400', exact: true })).toBeVisible()
  await capture(page, 'hito-5.3-seccion')
  await button(page, 'Usar como predeterminado').click()
  await button(page, 'Cerrar biblioteca').click()
  await selectBar(page, 'B1')
  await selectBar(page, 'B2', true)
  await page.getByText('Propiedades mecánicas', { exact: true }).click()
  await page.getByText('Asignación desde biblioteca', { exact: true }).click()
  await button(page, 'Elegir predeterminados del proyecto').click()
  await page.getByLabel('Material de biblioteca').selectOption('acero')
  await expect(button(page, 'Confirmar asignación de biblioteca')).toBeDisabled()
  await page.getByLabel('Eje de flexión para el pórtico').selectOption('y')
  await button(page, 'Confirmar asignación de biblioteca').click()
  await expect(page.getByText('Inercia asignada', { exact: true })).toBeVisible()
  await button(page, 'Resultados').click()
  await expect(analysis(page)).toHaveText('Resultado desactualizado')
  expect(await solve()).toBeCloseTo(manual, 5)
  const curve = (await moment.getAttribute('d'))!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number)
  expect(curve).toHaveLength(manualCurve.length)
  curve.forEach((value, i) => expect(value).toBeCloseTo(manualCurve[i]!, 6))
  const linked = await exportProject(page)
  expect(linked.model.mechanics.assignments).toMatchObject([1, 2].map(i => ({ barId: `B${i}`, materialId: 'acero', sectionAxis: 'y' })))
  await button(page, 'Deshacer').click()
  expect((await exportProject(page)).model.mechanics).toEqual(fixture.model.mechanics)
  await button(page, 'Rehacer').click()
  await expect(saveState(page)).toHaveText('Guardado local')
  await page.reload()
  expect((await exportProject(page)).model).toEqual(linked.model)
  await importProject(page, linked)
  const imported = await exportProject(page)
  expect(imported.id).not.toBe(linked.id)
  expect(imported.model).toEqual(linked.model)
  await solve()
  await open(page)
  await button(page, 'Secciones').click()
  await library.getByLabel('Ancho b (mm)').fill('250')
  await button(page, 'Guardar sección').click()
  await expect(library.getByRole('alert')).toContainText('Confirma la actualización')
  await library.getByLabel('Actualizar las 2 barras vinculadas al confirmar').check()
  await button(page, 'Guardar sección').click()
  await expect(library.getByRole('alert')).toHaveCount(0)
  await button(page, 'Cerrar biblioteca').click()
  await expect(analysis(page)).toHaveText('Resultado desactualizado')
})

test('previsualiza una sección compuesta con un vacío y bloquea un solape', async ({ page }) => {
  await page.goto('./')
  await expect(button(page, 'Proyectos')).toBeVisible()
  await open(page)
  const library = dialog(page)
  await button(page, 'Secciones').click()
  await library.getByLabel('Nombre de la sección').fill('Rectángulo con vacío y disco')
  await library.getByLabel('Tipo geométrico').selectOption('compound')
  await button(page, 'Agregar rectángulo').click()
  await library.getByLabel('Ancho b (mm) · región 1').fill('200')
  await library.getByLabel('Altura h (mm) · región 1').fill('200')
  await button(page, 'Agregar círculo').click()
  await library.getByLabel('X (mm) · región 2').fill('180')
  await library.getByLabel('Y (mm) · región 2').fill('100')
  await library.getByLabel('Radio r (mm) · región 2').fill('40')
  await expect(library.locator('[data-section-svg]')).toHaveCount(0)
  await button(page, 'Guardar sección').click()
  await expect(library.getByRole('alert')).toContainText('superpone')
  await library.getByLabel('X (mm) · región 2').fill('300')
  await button(page, 'Agregar círculo').click()
  await library.getByLabel('X (mm) · región 3').fill('100')
  await library.getByLabel('Y (mm) · región 3').fill('100')
  await library.getByLabel('Radio r (mm) · región 3').fill('20')
  await library.getByRole('group', { name: 'Región 3 · Círculo' }).getByLabel('Vacío interior').check()
  await expect(library.locator('.section-void')).toHaveCount(1)
  await expect(library.locator('[data-section-centroid]')).toHaveCount(1)
  await button(page, 'Guardar sección').click()
  await expect(library.getByRole('alert')).toHaveCount(0)
  await expect(library.getByRole('button', { name: 'Rectángulo con vacío y disco', exact: true })).toBeVisible()
  await capture(page, 'hito-5.3-compuesta')
})
