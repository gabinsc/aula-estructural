import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { DEFAULT_LIBRARY, makeSection } from '../../src/domain/library'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const date = '2026-11-22T00:00:00.000Z'
const fixture = {
  schemaVersion: 4, id: 'acero-traccion', name: 'Tracción en acero', createdAt: date, modifiedAt: date,
  view: { grid: true, dimensions: 'hidden' },
  model: {
    nodes: [{ id: 'N1', label: 'N1', x: 0, y: 0 }, { id: 'N2', label: 'N2', x: 3, y: 0 }],
    bars: [{ id: 'B1', label: 'B1', startId: 'N1', endId: 'N2' }],
    supports: [{ nodeId: 'N1', kind: 'pinned' }, { nodeId: 'N2', kind: 'roller', surfaceAngle: 0 }],
    loads: [{ id: 'C1', kind: 'nodal', nodeId: 'N2', force: { x: 1000000, y: 0 }, moment: 0 }],
    mechanics: { version: 1, assignments: [{ barId: 'B1', kind: 'truss2d', materialId: 'acero', E: 200e9, A: .01 }] },
    library: DEFAULT_LIBRARY, nextNode: 3, nextBar: 2, nextLoad: 2,
  },
  design: { materials: [{ materialId: 'acero', origin: 'declared', source: 'Datos del ejercicio', fy: 250e6, fu: 400e6 }] },
}

async function openSteel(page: Page) {
  await button(page, 'Diseño estructural').click()
  await button(page, 'Acero').click()
  await page.getByLabel('Barra de diseño').selectOption('B1')
  return page.getByRole('region', { name: 'Verificación de acero' })
}

test('acero separa factores y clasificación, invalida el caso y conserva parámetros al recargar v5', async ({ page }) => {
  await page.goto('./')
  await button(page, 'Proyectos').click()
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'ejercicio-acero-v4.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)),
  })
  await expect(page.locator('.document-title strong')).toHaveText(fixture.name)
  const steel = await openSteel(page)
  const table = steel.getByRole('table', { name: 'Estados límite de acero' })
  const gross = table.getByRole('row', { name: /Fluencia en área bruta/ })
  const fracture = table.getByRole('row', { name: /Fractura en área neta efectiva/ })
  await expect(table).toContainText('Resultado desactualizado')
  await button(page, 'Analizar estructura').click()
  await expect(steel.getByText('Sin relación demanda/capacidad evaluada en esta estación.')).toBeVisible()
  await steel.getByText('Parámetros de acero de la barra', { exact: true }).click()
  await steel.getByLabel('Grado declarado').selectOption('ASTM A36')
  await button(page, 'Guardar parámetros de acero').click()
  await expect(gross).toContainText('2250 kN')
  await expect(gross).toContainText('No evaluado')
  await expect(fracture).toContainText('No evaluado')
  await steel.getByLabel('Transferencia de la conexión').selectOption('partial-bolted')
  await steel.getByLabel('Área neta An (cm²)').fill('80')
  await steel.getByLabel('Excentricidad de conexión (mm)').fill('20')
  await steel.getByLabel('Longitud de conexión (mm)').fill('100')
  await button(page, 'Guardar parámetros de acero').click()
  await steel.getByText('Parámetros de acero de la barra', { exact: true }).click()
  await steel.getByText('Clasificar demanda del caso', { exact: true }).click()
  await steel.getByLabel('Naturaleza de las acciones').selectOption('lrfd-combination')
  await steel.getByLabel('Identificación y base de la combinación').fill('Combinación LRFD del ejercicio')
  await button(page, 'Confirmar clasificación del caso').click()
  await expect(fracture).toContainText('1920 kN')
  await expect(fracture).toContainText('Cumple la verificación realizada')
  await expect(steel.getByText(/Gobierna entre las comprobaciones calculadas: Fractura/)).toBeVisible()
  await expect(steel.getByRole('heading', { name: 'Verificación parcial' })).toBeVisible()
  await steel.getByText(/Fractura en área neta efectiva ·/).click()
  await expect(steel.getByText('Ae = U·An · Pn = Fu·Ae', { exact: true })).toBeVisible()
  if (process.env.AULA_STEEL_CAPTURE) {
    await button(page, 'Ampliar panel de diseño').click()
    await table.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/media/hito-8.2-acero.png', animations: 'disabled' })
    await button(page, 'Restaurar panel de diseño').click()
  }
  await steel.getByText('Parámetros de acero de la barra', { exact: true }).click()
  await steel.getByLabel('Método de acero').selectOption('ASD')
  await button(page, 'Guardar parámetros de acero').click()
  await expect(fracture).toContainText('1280 kN')
  await expect(fracture).toContainText('No evaluado')
  await steel.getByLabel('Naturaleza de las acciones').selectOption('asd-combination')
  await steel.getByLabel('Identificación y base de la combinación').fill('Combinación ASD del ejercicio')
  await button(page, 'Confirmar clasificación del caso').click()
  await expect(fracture).toContainText('0.78125')
  await button(page, 'Resultados').click()
  await page.getByText('Caso activo · Todas las cargas').click()
  await page.getByLabel('Incluir automáticamente todas las cargas').uncheck()
  await page.getByLabel('C1 · N2').uncheck()
  await openSteel(page)
  await expect(table).toContainText('Resultado desactualizado')
  await expect(table).not.toContainText('1280 kN')
  await expect(page.getByRole('status', { name: 'Estado de guardado' })).toHaveText('Guardado local')
  await page.reload()
  await openSteel(page)
  await expect(steel.getByRole('heading', { name: 'Acero · ASD' })).toBeVisible()
  await expect(steel.getByText('Demanda sin clasificación vigente · clasificación de sesión')).toBeVisible()
  await button(page, 'Proyectos').click()
  const download = page.waitForEvent('download')
  await button(page, 'Exportar JSON').click()
  const json = JSON.parse(await readFile((await (await download).path())!, 'utf8'))
  expect(json.schemaVersion).toBe(5)
  expect(json.design.steel[0]).toMatchObject({ barId: 'B1', method: 'ASD', grade: 'ASTM A36',
    connection: { kind: 'partial-bolted', netArea: .008, eccentricity: .02, length: .1 } })
  expect(json.design.steel[0]).not.toHaveProperty('demand')
  expect(json.model.mechanics).toEqual(fixture.model.mechanics)
  json.model.nodes[1].x = 4
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'barra-editada-v5.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)),
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const changed = await openSteel(page)
  await button(page, 'Analizar estructura').click()
  await expect(changed.getByRole('alert')).toContainText('Cambió la barra o su asignación.')
  const staleGross = changed.getByRole('row', { name: /Fluencia en área bruta/ })
  await expect(staleGross).toContainText('No evaluado')
  await expect(staleGross).not.toContainText('1500 kN')
})

test('acero lleva la estación extrema al AVM y mantiene pendiente el pandeo lateral sin Lb', async ({ page }) => {
  const section = makeSection('i-ejemplo', 'I soldada del ejercicio', { kind: 'I', dimensions: { b: .15, h: .30, tf: .02, tw: .01 } })
  const model = { ...fixture.model, supports: [{ nodeId: 'N1', kind: 'fixed' }],
    loads: [{ ...fixture.model.loads[0], force: { x: 0, y: -20000 } }],
    library: { ...DEFAULT_LIBRARY, sections: [section] },
    mechanics: { version: 1, assignments: [{
      ...fixture.model.mechanics.assignments[0], kind: 'frame2d', sectionId: section.id, sectionAxis: 'x',
      A: section.values.A, I: section.values.Ixx,
    }] },
  }
  await page.goto('./')
  await button(page, 'Proyectos').click()
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'voladizo-acero.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...fixture, id: 'acero-voladizo', name: 'Voladizo de acero', model })),
  })
  const steel = await openSteel(page)
  await button(page, 'Analizar estructura').click()
  await button(page, 'Mínimo M').click()
  await expect(page.getByLabel('Estación de diseño (m)')).toHaveValue('0')
  await expect(page.getByRole('table', { name: 'Acciones de diseño' })).toContainText('-60')
  await steel.getByText('Parámetros de acero de la barra', { exact: true }).click()
  await steel.getByLabel('Grado declarado').selectOption('ASTM A36')
  await steel.getByLabel(/Perfil I soldado homogéneo/).check()
  await steel.getByLabel(/Flexión simple en plano principal/).check()
  await steel.getByLabel(/Alma homogénea sin rigidizadores/).check()
  await button(page, 'Guardar parámetros de acero').click()
  const table = steel.getByRole('table', { name: 'Estados límite de acero' })
  const ltb = table.getByRole('row', { name: /Pandeo lateral-torsional/ })
  await expect(table.getByRole('row', { name: /Fluencia por flexión/ })).toContainText('227.025 kN·m')
  await expect(ltb).toContainText('No evaluado')
  await steel.getByLabel('Longitud lateral Lb (m)').fill('0.5')
  await button(page, 'Guardar parámetros de acero').click()
  await expect(ltb).toContainText('Condición geométrica verificada')
  await button(page, 'Ver sección en AVM').click()
  await expect(page.getByRole('complementary', { name: 'Resultados del análisis' })).toBeVisible()
  await button(page, 'Diseño estructural').click()
  await expect(page.getByLabel('Estación de diseño (m)')).toHaveValue('0')
})
