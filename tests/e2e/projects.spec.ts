import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { ProjectDocument } from '../../src/projects/document'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const status = (page: Page) => page.getByRole('status', { name: 'Estado de guardado' })
const name = (page: Page) => page.locator('.document-title strong')
const menu = (page: Page) => button(page, 'Proyectos').click()
const close = (page: Page) => button(page, 'Cerrar proyectos').click()

async function point(page: Page, x: number, y: number, action: string) {
  await page.getByLabel('X (m)', { exact: true }).fill(String(x))
  await page.getByLabel('Y (m)', { exact: true }).fill(String(y))
  await button(page, action).click()
}

async function pick(page: Page, id: string) {
  const locator = id.startsWith('N') ? page.locator(`[data-node-id="${id}"] .joint-mark`)
    : page.locator(`[data-bar-id="${id}"] .member-line`)
  const box = (await locator.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

async function loadType(page: Page, label: string) {
  await button(page, 'Carga').click()
  await page.getByRole('menuitemradio', { name: label, exact: true }).click()
}

async function exportDocument(page: Page): Promise<ProjectDocument> {
  await menu(page)
  const event = page.waitForEvent('download')
  await button(page, 'Exportar JSON').click()
  const download = await event
  const path = await download.path()
  if (!path) throw new Error('Descarga ausente')
  const model = JSON.parse(await readFile(path, 'utf8')) as ProjectDocument
  await close(page)
  return model
}

async function rename(page: Page, value: string) {
  await menu(page)
  await page.getByLabel('Nombre del proyecto activo').fill(value)
  await button(page, 'Renombrar proyecto').click()
  await expect(name(page)).toHaveText(value)
}

test('autoguarda y recupera el modelo físico completo al recargar y al importar con otro ID', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await menu(page)
  await button(page, 'Nuevo proyecto').click()
  await expect(status(page)).toHaveText('Guardado local')
  await rename(page, 'Pórtico local')
  await page.keyboard.press('b')
  await point(page, 0, 0, 'Fijar inicio')
  await point(page, 8, 0, 'Crear barra')
  await button(page, 'Apoyo').click()
  await page.getByRole('menuitemradio', { name: 'Rodillo' }).click()
  await pick(page, 'N1')
  await page.getByLabel('Inclinación de la superficie (°)').fill('30')
  await button(page, 'Asignar apoyo').click()
  await loadType(page, 'Fuerza nodal')
  await pick(page, 'N2')
  await page.getByLabel('Magnitud P (kN)').fill('2')
  await button(page, 'Crear carga').click()
  await loadType(page, 'Carga puntual sobre barra')
  await pick(page, 'B1')
  await page.getByLabel('Sistema de la carga').selectOption('local')
  await page.getByLabel('Distancia s (m)').fill('3')
  await page.getByLabel('Fx′ (kN)').fill('4')
  await page.getByLabel('Fy′ (kN)').fill('-5')
  await button(page, 'Crear carga').click()
  await loadType(page, 'Carga distribuida variable')
  await page.getByLabel('q₀y (kN/m)').fill('-10')
  await page.getByLabel('q₁y (kN/m)').fill('-30')
  await button(page, 'Crear carga').click()
  await page.keyboard.press('v')
  await pick(page, 'N2')
  await page.keyboard.press('m')
  await point(page, 10, 0, 'Mover nudo')
  await page.getByLabel('Modo de cotas').selectOption('all')
  await expect(status(page)).toHaveText('Guardado local')
  const original = await exportDocument(page)
  expect(original.model.nodes[1]).toMatchObject({ id: 'N2', x: 10, y: 0 })
  expect(original.model.bars).toMatchObject([{ id: 'B1', startId: 'N1', endId: 'N2' }])
  expect(original.model.supports).toMatchObject([{ nodeId: 'N1', kind: 'roller', surfaceAngle: Math.PI / 6 }])
  expect(original.model.loads).toMatchObject([
    { id: 'C1', nodeId: 'N2', force: { x: 0, y: -2000 } },
    { id: 'C2', barId: 'B1', s: 3, frame: 'local', force: { x: 4000, y: -5000 } },
    { id: 'C3', barId: 'B1', s0: 0, s1: 8, frame: 'global', profile: 'linear', q0: { y: -10000 }, q1: { y: -30000 } },
  ])

  await loadType(page, 'Fuerza nodal')
  await pick(page, 'N2')
  await page.getByLabel('Magnitud P (kN)').fill('9')
  await expect(page.locator('[data-load-preview]')).toBeVisible()
  await expect(status(page)).toHaveText('Guardado local')
  await page.reload()
  await expect(name(page)).toHaveText('Pórtico local')
  await expect(button(page, 'Deshacer')).toBeDisabled()
  await expect(page.getByLabel('Modo de cotas')).toHaveValue('all')
  await expect(page.locator('[data-load-preview]')).toHaveCount(0)
  const resumed = await exportDocument(page)
  expect(resumed.id).toBe(original.id)
  expect(resumed.model).toEqual(original.model)
  await menu(page)
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'modelo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original)),
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const imported = await exportDocument(page)
  expect(imported.id).not.toBe(original.id)
  expect(imported.model).toEqual(original.model)
  expect(errors).toEqual([])
})

test('gestiona proyectos vacíos, copias y borrado confirmado, y rechaza importaciones inválidas', async ({ page }) => {
  await page.goto('./')
  await rename(page, 'Base CAD')
  await expect(status(page)).toHaveText('Guardado local')
  await menu(page)
  const file = page.getByLabel('Archivo de proyecto JSON')
  await file.setInputFiles({ name: 'roto.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByRole('alert')).toContainText('JSON válido')
  await expect(name(page)).toHaveText('Base CAD')
  await button(page, 'Guardar como copia').click()
  await expect(name(page)).toHaveText('Base CAD (copia)')
  const copy = await exportDocument(page)
  await menu(page)
  await button(page, 'Abrir Base CAD').click()
  await expect(name(page)).toHaveText('Base CAD')
  const base = await exportDocument(page)
  expect(base.id).not.toBe(copy.id)
  expect(base.model).toEqual(copy.model)
  await menu(page)
  page.once('dialog', dialog => dialog.dismiss())
  await button(page, 'Eliminar Base CAD (copia)').click()
  await expect(button(page, 'Abrir Base CAD (copia)')).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await button(page, 'Eliminar Base CAD (copia)').click()
  await expect(button(page, 'Abrir Base CAD (copia)')).toHaveCount(0)
  await close(page)
  await page.reload()
  await expect(name(page)).toHaveText('Base CAD')
})

test('dibuja y conserva el modelo en memoria cuando falla IndexedDB', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined }))
  await page.goto('./')
  await expect(status(page)).toHaveText('Recuperación local fallida')
  await page.keyboard.press('n')
  await point(page, 2, 3, 'Crear nudo')
  await expect(status(page)).toHaveText('Error de guardado local')
  await expect(page.locator('[data-node-id="N1"]')).toHaveCount(1)
  const data = await exportDocument(page)
  expect(data.model.nodes).toMatchObject([{ id: 'N1', x: 2, y: 3 }])
})

test('una pestaña atrasada no sobrescribe la revisión local de otra', async ({ page, context }) => {
  await page.goto('./')
  await rename(page, 'Proyecto simultáneo')
  await expect(status(page)).toHaveText('Guardado local')
  const peer = await context.newPage()
  await peer.goto(page.url())
  await expect(name(peer)).toHaveText('Proyecto simultáneo')
  await page.keyboard.press('n')
  await point(page, 1, 2, 'Crear nudo')
  await expect(status(page)).toHaveText('Guardado local')
  await peer.keyboard.press('n')
  await point(peer, 3, 4, 'Crear nudo')
  await expect(status(peer)).toHaveText('Error de guardado local')
  const unsaved = await exportDocument(peer)
  expect(unsaved.model.nodes[0]).toMatchObject({ x: 3, y: 4 })
  await page.reload()
  const persisted = await exportDocument(page)
  expect(persisted.id).toBe(unsaved.id)
  expect(persisted.model.nodes[0]).toMatchObject({ x: 1, y: 2 })
})
