import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { DEFAULT_LIBRARY, makeSection } from '../../src/domain/library'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const panel = (page: Page) => page.getByRole('complementary', { name: 'Diseño estructural', exact: true })

async function openDesign(page: Page) {
  await button(page, 'Diseño estructural').click()
  await panel(page).getByLabel('Barra de diseño').selectOption('B1')
}

test('diseño consume el corte vigente y recupera resistencias y criterio mediante IndexedDB y JSON v4', async ({ page }) => {
  const section = makeSection('s1', 'Rectangular del ejercicio', { kind: 'rectangle', dimensions: { b: .2, h: .4 } })
  const date = '2026-11-21T00:00:00.000Z'
  const project = { schemaVersion: 3, id: 'diseno-test', name: 'Viga para diseño', createdAt: date, modifiedAt: date,
    view: { grid: true, dimensions: 'hidden' }, model: {
      nodes: [{ id: 'N1', label: 'N1', x: 0, y: 0 }, { id: 'N2', label: 'N2', x: 4, y: 0 }],
      bars: [{ id: 'B1', label: 'B1', startId: 'N1', endId: 'N2' }],
      supports: [{ nodeId: 'N1', kind: 'pinned' }, { nodeId: 'N2', kind: 'roller', surfaceAngle: 0 }],
      loads: [{ id: 'C1', kind: 'point', barId: 'B1', s: 2, frame: 'global', force: { x: 0, y: -12000 } }],
      library: { ...DEFAULT_LIBRARY, sections: [section] }, mechanics: { version: 1,
        assignments: [{ barId: 'B1', kind: 'frame2d', materialId: 'acero', sectionId: 's1', sectionAxis: 'x',
          E: 200e9, A: section.values.A, I: section.values.Ixx }] },
      nextNode: 3, nextBar: 2, nextLoad: 2,
    } }
  await page.goto('./')
  await button(page, 'Proyectos').click()
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'viga-v3.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)),
  })
  await expect(page.locator('.document-title strong')).toHaveText(project.name)
  await openDesign(page)
  const design = panel(page)
  const stresses = design.getByRole('table', { name: 'Tensiones de la sección' })
  await expect(stresses).toHaveCount(0)
  await button(page, 'Analizar estructura').click()
  await expect(design.getByRole('status')).toHaveText('Resultado vigente')
  await expect(stresses.getByRole('row', { name: /Fibra \+y local/ })).toContainText('-2.25')
  await expect(stresses.getByRole('row', { name: /Fibra −y local/ })).toContainText('2.25')
  const actions = design.getByRole('table', { name: 'Acciones de diseño' })
  await expect(actions.getByRole('row').nth(1).getByRole('cell').nth(1)).toHaveText('-6')
  await design.getByLabel('Lado de la sección').selectOption('left')
  await expect(actions.getByRole('row').nth(1).getByRole('cell').nth(1)).toHaveText('6')
  await design.getByLabel('Estación de diseño (m)').fill('1')
  await expect(actions.getByRole('row').nth(1).getByRole('cell').nth(2)).toHaveText('6')
  await design.getByRole('button', { name: 'Ver sección en AVM' }).click()
  await expect(page.getByRole('complementary', { name: 'Resultados del análisis' })).toBeVisible()
  await button(page, 'Diseño estructural').click()
  await expect(design.getByLabel('Estación de diseño (m)')).toHaveValue('1')
  await design.getByText('Editar resistencias del material', { exact: true }).click()
  await design.getByLabel('Fuente resistente').fill('Ficha del ejercicio')
  await design.getByLabel('fy (MPa)').fill('250')
  await button(page, 'Guardar resistencias').click()
  await expect(design.getByText(/fy 250 MPa/)).toBeVisible()
  await design.getByLabel('fy (MPa)').fill('275')
  await button(page, 'Guardar resistencias').click()
  await expect(design.getByText(/fy 275 MPa/)).toBeVisible()
  await design.getByText('Editar criterio del proyecto', { exact: true }).click()
  await design.getByLabel('Nombre del criterio').fill('Ensayo elástico')
  await design.getByLabel('Límite de tracción (MPa)').fill('2')
  await design.getByLabel('Límite de compresión (MPa)').fill('3')
  await design.getByLabel('Límite transversal en la estación (mm)').fill('0,1')
  await button(page, 'Guardar criterio').click()
  const comparisons = design.getByRole('table', { name: 'Comparaciones con el criterio' })
  await expect(comparisons.getByRole('row', { name: /Tracción en la barra/ })).toContainText('Excede el límite declarado')
  await expect(comparisons.getByRole('row', { name: /Compresión en la barra/ })).toContainText('Dentro del límite declarado')
  await expect(comparisons.getByRole('row', { name: /Flecha relativa en la estación/ })).toBeVisible()

  await button(page, 'Resultados').click()
  await page.getByText('Caso activo · Todas las cargas').click()
  await page.getByLabel('Incluir automáticamente todas las cargas').uncheck()
  await page.getByLabel('C1 · B1').uncheck()
  await button(page, 'Diseño estructural').click()
  await expect(design.getByRole('status')).toHaveText('Resultado desactualizado')
  await expect(stresses).toHaveCount(0)
  await expect(comparisons).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'Estado de guardado' })).toHaveText('Guardado local')
  await page.reload()
  await openDesign(page)
  await expect(design.getByText(/fy 275 MPa/)).toBeVisible()
  await expect(design.getByText('Ensayo elástico', { exact: true })).toBeVisible()
  await expect(stresses).toHaveCount(0)
  await button(page, 'Proyectos').click()
  const download = page.waitForEvent('download')
  await button(page, 'Exportar JSON').click()
  const path = await (await download).path()
  const json = await readFile(path!, 'utf8')
  const exported = JSON.parse(json)
  expect(exported.schemaVersion).toBe(4)
  expect(exported.design.materials[0].fy).toBe(275e6)
  expect(exported.design.criterion).toMatchObject({ tension: 2e6, compression: 3e6,
    service: { limit: .0001, reference: 'relative-chord' } })
  expect(exported.design).not.toHaveProperty('results')
  expect(exported.model.mechanics).toEqual(project.model.mechanics)
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'viga-v4.json', mimeType: 'application/json', buffer: Buffer.from(json),
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await openDesign(page)
  await expect(design.getByText(/fy 275 MPa/)).toBeVisible()
  await expect(design.getByText('Ensayo elástico', { exact: true })).toBeVisible()
})

test('el acceso a diseño funciona a 320 px y mantiene el foco al cerrar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('./')
  const entry = button(page, 'Diseño estructural')
  await entry.press('Enter')
  await expect(panel(page)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await button(page, 'Cerrar diseño').click()
  await expect(entry).toBeFocused()
})
