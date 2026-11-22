import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const state = (page: Page) => page.getByRole('status', { name: 'Estado de análisis' })

async function openExercise(page: Page, name: string) {
  await page.goto('./')
  await button(page, 'Proyectos').click()
  await button(page, 'Ejemplos').click()
  await button(page, name).click()
  await button(page, 'Abrir copia editable').click()
  await expect(page.locator('.document-title strong')).toHaveText(`${name} (copia)`)
  await button(page, 'Resultados').click()
}

async function exportProject(page: Page) {
  await button(page, 'Proyectos').click()
  const pending = page.waitForEvent('download')
  await button(page, 'Exportar JSON').click()
  const path = await (await pending).path()
  if (!path) throw new Error('No se descargó el proyecto')
  const snapshot: unknown = JSON.parse(await readFile(path, 'utf8'))
  await button(page, 'Cerrar proyectos').click()
  return snapshot
}

test('trabajo virtual en la sección central con tramos, campos, CAD y vigencia', async ({ page }) => {
  await openExercise(page, 'Viga simplemente apoyada')
  const original = await exportProject(page)
  await page.getByLabel('Método de análisis').selectOption('virtual')
  await button(page, 'Ajustar vista').click()
  const segment = page.locator('.model-canvas [data-bar-id="B1"] .member-line')
  const box = (await segment.boundingBox())!
  await page.mouse.click(box.x + box.width * .25, box.y)
  await button(page, 'Usar selección CAD').click()
  await expect(page.getByLabel('Barra objetivo')).toHaveValue('B1')
  const station = page.getByLabel('Estación objetivo s (m)', { exact: true })
  await expect(station).toHaveValue('3')
  await button(page, 'Analizar estructura').click()
  await expect(state(page)).toHaveText('Resultado vigente')
  const work = page.getByRole('region', { name: 'Trabajo virtual', exact: true })
  await expect(work.getByRole('table', { name: 'Verificación de trabajo virtual' })).toContainText('-0.03375 m')
  await expect(work.getByRole('img', { name: 'Sistema real', exact: true })).toBeVisible()
  await expect(work.getByRole('img', { name: 'Sistema virtual', exact: true })).toBeVisible()
  await button(page, 'Consultar integral de B1').click()
  await expect(page.locator('.model-canvas [data-bar-id="B1"]')).toHaveClass(/is-selected/)
  await work.getByLabel('Intervalo de B1').selectOption({ label: '3–6 m' })
  await expect(work.getByRole('img', { name: 'Diagrama m del intervalo', exact: true })).toBeVisible()
  await work.getByText('Muestras y pesos de integración', { exact: true }).click()
  await expect(work.getByRole('table', { name: 'Campos del intervalo' }).getByRole('row')).toHaveCount(7)
  if (process.env.AULA_HITO7_CAPTURES) {
    await work.getByRole('table', { name: 'Trabajo por barra' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/media/hito-7.1-trabajo-virtual.png' })
  }
  await button(page, 'Acercar').click()
  await expect(state(page)).toHaveText('Resultado vigente')
  await button(page, 'Resolver').click()
  await expect(work.getByRole('table', { name: 'Verificación de trabajo virtual' })).toBeVisible()
  await expect(work.getByRole('table', { name: 'Trabajo por barra' })).toHaveCount(0)
  expect(await exportProject(page)).toEqual(original)
  await station.fill('2')
  await expect(state(page)).toHaveText('Resultado desactualizado')
  await expect(work).toHaveCount(0)
  await expect(button(page, 'Deshacer')).toBeDisabled()
})

test('fuerzas: selecciona restricciones gráficas y recupera redundantes, AVM y compatibilidad', async ({ page }) => {
  await openExercise(page, 'Pórtico simple')
  await page.getByLabel('Método de análisis').selectOption('forces')
  await button(page, 'Ajustar vista').click()
  const first = page.getByRole('checkbox', { name: 'CAD N1:rotation · Giro +Z', exact: true })
  const second = page.getByRole('checkbox', { name: 'CAD N4:rotation · Giro +Z', exact: true })
  await first.click()
  await second.press('Enter')
  await expect(first).toHaveAttribute('aria-checked', 'true')
  await expect(second).toHaveAttribute('aria-checked', 'true')
  await button(page, 'Analizar estructura').click()
  await expect(state(page)).toHaveText('Resultado vigente')
  const result = page.getByRole('region', { name: 'Método de las fuerzas', exact: true })
  const table = result.getByRole('table', { name: 'Acciones redundantes recuperadas' })
  for (const id of ['N1:rotation', 'N4:rotation']) {
    const row = table.getByRole('row').filter({ has: button(page, id) })
    await expect(row).toContainText('11435.91 N·m')
  }
  const matrix = result.getByRole('table', { name: 'Matriz de flexibilidad' })
  await expect(matrix).toBeVisible()
  await expect(result.getByText('Primaria hiperestática de grado 1 con las liberaciones seleccionadas.')).toBeVisible()
  await button(page, 'Consultar coeficiente 1, 2').click()
  await expect(result.getByRole('columnheader', { name: 'Total (rad/(N·m))', exact: true })).toBeVisible()
  await expect(result.getByRole('img', { name: /^Unitario N4:rotation/ })).toBeVisible()
  await button(page, 'Consultar integral de B2').click()
  await expect(page.locator('.model-canvas [data-bar-id="B2"]')).toHaveClass(/is-selected/)
  if (process.env.AULA_HITO7_CAPTURES) {
    await matrix.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/media/hito-7.2-flexibilidad.png' })
  }
  await button(page, 'Opciones AVM').click()
  await button(page, 'M · Momento').click()
  await expect(page.locator('.model-canvas [data-effort="M"][data-avm-bar]')).toHaveCount(3)
  await button(page, 'Resolver').click()
  await expect(table).toBeVisible()
  await expect(matrix).toHaveCount(0)
  await first.press('Space')
  await expect(state(page)).toHaveText('Resultado desactualizado')
  await expect(button(page, 'Deshacer')).toBeDisabled()
})

test('fuerzas: advierte un mecanismo primario y conserva la geometría', async ({ page }) => {
  await openExercise(page, 'Voladizo')
  await page.getByLabel('Método de análisis').selectOption('forces')
  await page.getByRole('region', { name: 'Configuración del método' })
    .getByRole('checkbox', { name: /N1:rotation/ }).check()
  await button(page, 'Analizar estructura').click()
  await expect(state(page)).toHaveText('Análisis fallido')
  await expect(page.getByText(/primaria liberada.*no es estable/)).toBeVisible()
  await expect(page.locator('.model-canvas [data-support-node-id="N1"]')).toHaveAttribute('data-support-kind', 'fixed')
  await expect(button(page, 'Deshacer')).toBeDisabled()
})
