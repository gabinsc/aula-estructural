import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ACADEMIC_EXAMPLES } from '../../src/projects/academicExamples'
import type { ProjectDocument } from '../../src/projects/document'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const title = (page: Page) => page.locator('.document-title strong')
const saved = (page: Page) => page.getByRole('status', { name: 'Estado de guardado' })
const analysis = (page: Page) => page.getByRole('status', { name: 'Estado de análisis' })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Proyectos locales' })

async function catalog(page: Page) {
  await button(page, 'Proyectos').click()
  await button(page, 'Ejemplos').click()
}

async function openExercise(page: Page, name: string) {
  await catalog(page)
  await button(page, name).click()
  await button(page, 'Abrir copia editable').click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(title(page)).toHaveText(`${name} (copia)`)
  await expect(saved(page)).toHaveText('Guardado local')
}

async function exportProject(page: Page): Promise<ProjectDocument> {
  await button(page, 'Proyectos').click()
  const pending = page.waitForEvent('download')
  await button(page, 'Exportar JSON').click()
  const file = await (await pending).path()
  const project = JSON.parse(await readFile(file!, 'utf8')) as ProjectDocument
  await button(page, 'Cerrar proyectos').click()
  return project
}

for (const example of ACADEMIC_EXAMPLES) {
  test(`abre y analiza ${example.title} desde el catálogo`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('./')
    await openExercise(page, example.title)
    await expect(page.locator('[data-node-id]')).toHaveCount(example.model.nodes.length)
    await expect(page.locator('[data-bar-id]')).toHaveCount(example.model.bars.length)
    await button(page, 'Analizar estructura').click()
    await expect(analysis(page)).toHaveText('Resultado vigente')
    await expect(page.getByRole('table', { name: 'Desplazamientos nodales' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Reacciones de apoyo' })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('recorrido del estudiante, AVM y Aprender, copia local y recuperación sin sobrescribir', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('./')
  await button(page, 'Proyectos').click()
  await page.getByText('Guía rápida', { exact: true }).press('Enter')
  await expect(page.getByText('Dibuja nudos y barras', { exact: false })).toBeVisible()
  await page.getByText('Aviso de Beta 0.2', { exact: true }).press('Enter')
  await expect(page.getByText('Verifica los resultados de forma independiente.', { exact: false })).toBeVisible()
  await button(page, 'Ejemplos').press('Enter')
  await button(page, 'Viga simplemente apoyada').press('Enter')
  await page.getByText('Resultados de referencia', { exact: true }).press('Enter')
  await expect(page.getByText('V en 3⁻ m')).toBeVisible()
  if (process.env.AULA_HITO6_CAPTURES) await page.screenshot({ path: 'docs/media/hito-6-catalogo.png' })
  await button(page, 'Abrir copia editable').press('Enter')
  await expect(title(page)).toHaveText('Viga simplemente apoyada (copia)')
  const initial = await exportProject(page)
  await button(page, 'Analizar estructura').click()
  await expect(analysis(page)).toHaveText('Resultado vigente')
  await button(page, 'Opciones AVM').click()
  await button(page, 'AVM · Combinada').click()
  await expect(page.locator('.avm-bands')).toBeVisible()
  await button(page, 'Desarrollo').click()
  await expect(page.getByRole('region', { name: 'Detalle matemático' })).toBeVisible()
  if (process.env.AULA_HITO6_CAPTURES) {
    await button(page, 'Ajustar vista').click()
    await page.getByLabel('Paso de cálculo').selectOption('K')
    await page.screenshot({ path: 'docs/media/hito-6-aprender.png' })
  }
  await button(page, 'Resolver').click()
  await expect(page.getByRole('region', { name: 'Detalle matemático' })).toHaveCount(0)
  await button(page, 'Aprender').click()
  await expect(page.getByRole('region', { name: 'Detalle matemático' })).toBeVisible()
  await button(page, 'Opciones AVM').click()
  await button(page, 'Deformada').click()
  await expect(page.locator('[data-deformed-bar="B1"]')).toHaveCount(1)
  await button(page, 'Volver al Inspector').click()
  await button(page, 'Nudo').click()
  await page.keyboard.press('Escape')
  await button(page, 'Resultados').click()
  await expect(analysis(page)).toHaveText('Resultado vigente')
  await page.reload()
  await expect(title(page)).toHaveText(initial.name)
  expect(await exportProject(page)).toEqual(initial)
  await openExercise(page, 'Viga simplemente apoyada')
  const second = await exportProject(page)
  expect(second.id).not.toBe(initial.id)
  expect(second.model).toEqual(initial.model)
  await catalog(page)
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(button(page, 'Proyectos')).toBeFocused()
  await button(page, 'Proyectos').click()
  await button(page, `Abrir ${initial.name}`).click()
  await expect(dialog(page)).toHaveCount(0)
  expect(await exportProject(page)).toEqual(initial)
})

test('mantiene acceso por teclado al catálogo y no desborda a 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 720 })
  await page.goto('./')
  await button(page, 'Proyectos').press('Enter')
  await button(page, 'Ejemplos').press('Enter')
  await button(page, 'Pórtico simple').press('Enter')
  await expect(button(page, 'Pórtico simple')).toHaveAttribute('aria-pressed', 'true')
  expect(await dialog(page).evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(360)
  await button(page, 'Abrir copia editable').press('Enter')
  await expect(saved(page)).toHaveText('Guardado local')
})
