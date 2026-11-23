import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { ProjectDocument } from '../../src/projects/document'
import { makeProject } from '../../src/projects/document'
import { EMPTY_STRUCTURE } from '../../src/domain/structure'
import type { Structure } from '../../src/domain/structure'
type LegacyProject = Omit<ProjectDocument, 'schemaVersion'> & { schemaVersion: 2 }

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const legend = (page: Page) => page.locator('.avm-legend')
const state = (page: Page) => page.getByRole('status', { name: 'Estado de análisis' })
const view = (page: Page) => page.locator('[data-avm-view]')
const layer = (page: Page) => page.locator('[data-avm-layer]')
const effort = (page: Page, field: string) => layer(page).locator(`[data-avm-bar="B1"][data-effort="${field}"] .avm-line`)

async function options(page: Page) {
  const trigger = button(page, 'Opciones AVM')
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
  return page.getByRole('group', { name: 'Vistas y capas AVM' })
}

async function choose(page: Page, label: string) {
  await (await options(page)).getByRole('button', { name: label, exact: true }).click()
}

async function analyze(page: Page, expected = 'Resultado vigente') {
  await button(page, 'Analizar estructura').click()
  await expect(state(page)).toHaveText(expected)
}

async function pick(page: Page, id: string) {
  const target = id.startsWith('N') ? page.locator(`[data-node-id="${id}"] .joint-mark`)
    : page.locator(`[data-bar-id="${id}"] .member-line`)
  const bounds = (await target.boundingBox())!
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

async function coordinate(page: Page, x: number, y: number, action: string) {
  await page.getByLabel('X (m)', { exact: true }).fill(String(x))
  await page.getByLabel('Y (m)', { exact: true }).fill(String(y))
  await button(page, action).click()
}

async function capture(page: Page, file: string) {
  if (process.env.AULA_AVM_CAPTURES) await page.screenshot({ path: `docs/media/hito-4.6-${file}.png`, animations: 'disabled' })
  if (process.env.AULA_NEW_CAPTURES && ['rotula-interna', 'viga-continua', 'portico-compacto', 'portico-movil',
    'gerber', 'portico-liberacion-unilateral', 'etiquetas-antes', 'etiquetas-despues'].includes(file)) {
    await page.screenshot({ path: `docs/media/rotulas-avm-${file}.png`, animations: 'disabled' })
  }
}

async function importInclined(page: Page, { unstable = false, pending = false, axial = false } = {}) {
  const document: LegacyProject = {
    schemaVersion: 2, id: 'avm-inclinada', name: 'Voladizo inclinado', createdAt: '2026-11-21T12:00:00.000Z',
    modifiedAt: '2026-11-21T12:00:00.000Z', view: { grid: true, dimensions: 'hidden' },
    model: {
      nodes: [{ id: 'N1', x: 0, y: 0, label: 'N1' }, { id: 'N2', x: 3, y: 4, label: 'N2' }],
      bars: [{ id: 'B1', startId: 'N1', endId: 'N2', label: 'B1' }],
      loads: [{ kind: 'nodal', nodeId: 'N2', id: 'C1', force: { x: axial ? 4800 : 0, y: axial ? 6400 : -8000 }, moment: 0 }],
      supports: unstable ? [] : axial ? [{ kind: 'fixed', nodeId: 'N1' }, {
        kind: 'roller', nodeId: 'N2', surfaceAngle: Math.atan2(4, 3),
      }] : [{ kind: 'fixed', nodeId: 'N1' }],
      mechanics: { version: 1, assignments: pending ? [] : [axial ? { barId: 'B1', kind: 'truss2d', E: 2e11, A: .02 }
        : { barId: 'B1', kind: 'frame2d', E: 2e11, A: .02, I: 1e-5 }] },
      nextBar: 2, nextLoad: 2, nextNode: 3,
    },
  }
  await button(page, 'Proyectos').click()
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'avm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)),
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('edita y restaura una rótula en CAD, e inserta una interior en una transacción', async ({ page }) => {
  await page.goto('./')
  await importInclined(page)
  await pick(page, 'B1')
  await page.getByRole('checkbox', { name: 'Liberar extremo final (j)' }).check()
  await expect(page.locator('[data-bar-id="B1"] [data-release="j"]')).toHaveCount(1)
  await analyze(page)
  await button(page, 'Volver al Inspector').click()
  await page.getByRole('checkbox', { name: 'Liberar extremo final (j)' }).uncheck()
  await button(page, 'Insertar rótula interior').click()
  await button(page, 'Insertar rótula en el punto medio').click()
  await expect(page.locator('[data-bar-id] [data-release]')).toHaveCount(2)
  await capture(page, 'rotula-interna')
  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-bar-id="B1"]')).toHaveCount(1)
  await expect(page.locator('[data-bar-id] [data-release]')).toHaveCount(0)
})

test('importa la Gerber y el pórtico articulado y conserva resultados y símbolos de extremo', async ({ page }) => {
  await page.goto('./')
  const frame = (barId: string) => ({ barId, kind: 'frame2d' as const, E: 200e9, A: .02, I: 8e-6 })
  async function show(name: string, model: Structure) {
    await button(page, 'Proyectos').click()
    await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
      name: 'rotulas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeProject(name, model))),
    })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await analyze(page)
    await choose(page, 'AVM · Combinada')
  }
  const roller = (nodeId: string) => ({ nodeId, kind: 'roller' as const, surfaceAngle: 0 })
  const nodes = (values: readonly (readonly [number, number])[]) =>
    values.map(([x, y], i) => ({ id: `N${i + 1}`, label: `N${i + 1}`, x, y }))
  const B1 = { id: 'B1', label: 'B1', startId: 'N1', endId: 'N2' }
  const B2 = { id: 'B2', label: 'B2', startId: 'N2', endId: 'N3' }
  const B3 = { id: 'B3', label: 'B3', startId: 'N3', endId: 'N4' }
  await show('Viga Gerber', { ...EMPTY_STRUCTURE, nodes: nodes([[0, 0], [4, 0], [6, 0], [10, 0]]),
    bars: [B1, { ...B2, releaseJ: true }, { ...B3, releaseI: true }],
    supports: [{ nodeId: 'N1', kind: 'pinned' }, roller('N2'), roller('N4')],
    loads: [{ id: 'C1', kind: 'point', barId: 'B3', s: 2, frame: 'global', force: { x: 0, y: -12000 } }],
    mechanics: { version: 1, assignments: ['B1', 'B2', 'B3'].map(frame) }, nextBar: 4, nextNode: 5, nextLoad: 2,
  })
  const panel = page.getByRole('region', { name: 'Diagramas AVM separados' })
  await expect(panel).toHaveAttribute('data-avm-presentation', 'developed')
  const reactions = page.getByRole('table', { name: 'Reacciones de apoyo' })
  await expect(reactions.getByRole('row', { name: /N1/ })).toContainText('-3')
  await expect(reactions.getByRole('row', { name: /N2/ })).toContainText('9')
  await expect(reactions.getByRole('row', { name: /N4/ })).toContainText('6')
  await expect(page.locator('.model-canvas [data-release]')).toHaveCount(2)
  await button(page, 'Ajustar vista').click()
  await panel.scrollIntoViewIfNeeded()
  await capture(page, 'gerber')
  await choose(page, 'M · Momento')
  await (await options(page)).getByLabel('Distribución automática').uncheck()
  await page.keyboard.press('Escape')
  await capture(page, 'etiquetas-antes')
  await (await options(page)).getByLabel('Distribución automática').check()
  await page.keyboard.press('Escape')
  await capture(page, 'etiquetas-despues')
  await show('Pórtico con articulación unilateral', { ...EMPTY_STRUCTURE,
    nodes: nodes([[0, 0], [0, 3], [4, 3]]), bars: [B1, { ...B2, releaseI: true }],
    supports: [{ nodeId: 'N1', kind: 'fixed' }, roller('N3')],
    loads: [{ id: 'C1', kind: 'point', barId: 'B2', s: 2, frame: 'global', force: { x: 0, y: -12000 } }],
    mechanics: { version: 1, assignments: ['B1', 'B2'].map(frame) }, nextBar: 3, nextNode: 4, nextLoad: 2,
  })
  await expect(panel).toHaveAttribute('data-avm-presentation', 'compact')
  await expect(page.locator('.model-canvas [data-bar-id="B2"] [data-release="i"]')).toHaveCount(1)
  await capture(page, 'portico-liberacion-unilateral')
})

test('dibuja, asigna, calcula y consulta el salto AVM con la tabla sincronizada', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible()
  await page.keyboard.press('b')
  await coordinate(page, 0, 0, 'Fijar inicio')
  await coordinate(page, 6, 0, 'Crear barra')
  for (const [label, node] of [['Articulado', 'N1'], ['Rodillo', 'N2']] as const) {
    await button(page, 'Apoyo').click()
    await page.getByRole('menuitemradio', { name: label, exact: true }).click()
    await pick(page, node)
    await button(page, 'Asignar apoyo').click()
  }
  await page.keyboard.press('v')
  await pick(page, 'B1')
  await page.getByText('Propiedades mecánicas', { exact: true }).click()
  await page.getByLabel('Tipo resistente').selectOption('frame2d')
  await page.getByLabel('E (GPa)', { exact: true }).fill('200')
  await page.getByLabel('A (cm²)', { exact: true }).fill('200')
  await page.getByLabel('I (cm⁴)', { exact: true }).fill('800')
  await button(page, 'Guardar propiedades').click()
  await button(page, 'Carga').click()
  await page.getByRole('menuitemradio', { name: 'Carga puntual sobre barra' }).click()
  await pick(page, 'B1')
  await page.getByLabel('Distancia s (m)').fill('3')
  await page.getByLabel('Fx (kN)', { exact: true }).fill('3')
  await page.getByLabel('Fy (kN)', { exact: true }).fill('-12')
  await button(page, 'Crear carga').click()
  await page.keyboard.press('v')
  await button(page, 'AVM').click()
  await expect(view(page)).toHaveAttribute('data-avm-view', 'N')
  await expect(legend(page)).toContainText('Sin análisis')
  await expect(layer(page)).toHaveCount(0)

  await analyze(page)
  const controls = button(page, 'AVM')
  await expect(effort(page, 'N')).toHaveCount(1)
  for (const expected of ['V', 'M', 'combined', 'deformed', 'model']) {
    await controls.click()
    await expect(view(page)).toHaveAttribute('data-avm-view', expected)
  }
  await expect(layer(page)).toHaveCount(0)
  await choose(page, 'M · Momento')
  await expect(effort(page, 'N')).toHaveCount(0)
  await expect(effort(page, 'V')).toHaveCount(0)
  await expect(effort(page, 'M')).not.toHaveAttribute('d', / L /)
  const settings = await options(page)
  const slider = settings.getByRole('slider', { name: 'Amplitud AVM' })
  const originalM = await effort(page, 'M').getAttribute('d')
  await slider.press('ArrowRight')
  await expect(effort(page, 'M')).not.toHaveAttribute('d', originalM!)
  await expect(legend(page)).toContainText('18 kN·m ↔ 122.5 px')
  await slider.press('ArrowLeft')
  await settings.getByLabel('Reacciones', { exact: true }).check()
  await page.keyboard.press('Escape')
  await choose(page, 'AVM · Combinada')
  const bands = page.getByRole('region', { name: 'Diagramas AVM separados' })
  const chart = bands.locator('svg')
  for (const [f, text] of [['N', '3 kN'], ['V', '6 kN'], ['M', '18 kN·m']]) {
    await expect(effort(page, f!)).toHaveCount(0)
    const band = bands.locator(`[data-avm-band="${f}"]`)
    await expect(band.locator('path')).toHaveCount(1)
    const [magnitude, unit] = text!.split(' ')
    await expect(band).toContainText(unit!)
    await expect(band).toContainText(`+${magnitude}`)
  }
  await expect(layer(page).locator('[data-reaction-node]')).toHaveCount(2)
  await expect(bands.locator('[data-avm-band="V"] path')).toHaveAttribute('d', / L .* C /)
  await expect(bands.locator('[data-avm-band="M"] path')).not.toHaveAttribute('d', / L /)
  const initialWidth = (await chart.boundingBox())!.width
  await button(page, 'Ampliar panel de resultados').click()
  await expect.poll(async () => (await chart.boundingBox())!.width).toBeGreaterThan(initialWidth)
  await button(page, 'Restaurar ancho del panel').click()
  const bounds = (await chart.boundingBox())!
  await chart.click({ position: { x: bounds.width * (88 + 607 / 2) / 720, y: bounds.height * 232 / 401 } })
  const guide = chart.locator('[data-station-guide]')
  await expect(guide).toHaveAttribute('data-station-guide', '3')
  expect(await guide.getAttribute('x1')).toBe(await guide.getAttribute('x2'))
  await expect(bands.getByLabel('Consulta en las franjas')).toContainText('V izq. +6 / der. -6 kN')
  await expect(page.getByLabel('Estación s (m)')).toHaveValue('3')
  await capture(page, 'avm')

  await choose(page, 'V · Cortante')
  await (await options(page)).getByLabel('Consultar en el lienzo').check()
  await page.keyboard.press('Escape')
  await pick(page, 'B1')
  const readout = page.getByLabel('Consulta en el diagrama')
  await expect(readout).toContainText('s = 3 m')
  await expect(readout).toContainText('V izq. 6 / der. -6 kN')
  await expect(readout).toContainText('Cargas hasta el corte C1')
  await expect(page.getByLabel('Estación s (m)')).toHaveValue('3')
  await expect(page.locator('[data-bar-id="B1"]')).toHaveClass(/is-selected/)
  await expect(page.getByRole('table', { name: 'Valores de sección' })).toContainText('-6')
  if (process.env.AULA_AVM_CAPTURES) await page.getByRole('table', { name: 'Valores de sección' }).scrollIntoViewIfNeeded()
  await capture(page, 'consulta')
  await page.getByLabel('Estación s (m)').fill('1')
  await page.getByLabel('Estación s (m)').press('Enter')
  await expect(readout).toContainText('s = 1 m')
  await button(page, 'Resolver').click()
  await expect(readout).not.toContainText('Cargas hasta el corte')
  await expect(state(page)).toHaveText('Resultado vigente')
})

test('amplifica la deformada inclinada y alterna capas sin modificar el historial', async ({ page }) => {
  await page.goto('./')
  await importInclined(page)
  await analyze(page)
  await expect(view(page)).toHaveAttribute('data-avm-view', 'N')
  await choose(page, 'Deformada')
  const path = layer(page).locator('[data-deformed-bar="B1"]')
  const original = page.locator('[data-node-id="N2"] .joint-mark')
  const originalPoint = [await original.getAttribute('cx'), await original.getAttribute('cy')]
  await expect(path).toHaveAttribute('d', / L /)
  await expect(legend(page)).toContainText('Auto')
  const autoPath = await path.getAttribute('d')
  const menu = await options(page)
  await menu.getByLabel('Amplificación automática').uncheck()
  await menu.getByLabel('Factor manual').fill('15')
  await menu.getByRole('button', { name: 'Aplicar factor' }).click()
  await expect(layer(page).locator('[data-deformation-factor]')).toHaveAttribute('data-deformation-factor', '15')
  await expect(path).not.toHaveAttribute('d', autoPath!)
  await expect(layer(page).locator('[data-deformed-rotation="N2"]')).toHaveCount(1)
  await menu.getByLabel('Cargas aplicadas').uncheck()
  await expect(page.locator('[data-load-id="C1"]')).toHaveCount(0)
  await menu.getByLabel('Reacciones', { exact: true }).check()
  await expect(layer(page).locator('[data-reaction-node="N1"]')).toHaveCount(1)
  await menu.getByLabel('Etiquetas de valores').uncheck()
  await expect(layer(page).locator('[data-reaction-node="N1"] text')).toHaveCount(0)
  await menu.getByLabel('Geometría original').uncheck()
  await expect(original).toHaveCount(0)
  await expect(path).toHaveCount(1)
  await menu.getByLabel('Geometría deformada').uncheck()
  await expect(path).toHaveCount(0)
  await menu.getByLabel('Geometría deformada').check()
  await menu.getByLabel('Geometría original').check()
  await menu.getByLabel('Etiquetas de valores').check()
  await menu.getByLabel('Cargas aplicadas').check()
  await page.keyboard.press('Escape')
  expect([await original.getAttribute('cx'), await original.getAttribute('cy')]).toEqual(originalPoint)
  await expect(button(page, 'Deshacer')).toBeDisabled()
  await expect(state(page)).toHaveText('Resultado vigente')
  await capture(page, 'deformada')
})

test('oculta diagramas desactualizados, conserva zoom y pan y deja dibujar con la consulta activa', async ({ page }) => {
  await page.goto('./')
  await importInclined(page)
  await analyze(page)
  await choose(page, 'M · Momento')
  await (await options(page)).getByLabel('Consultar en el lienzo').check()
  await page.keyboard.press('Escape')
  const first = await effort(page, 'M').getAttribute('d')
  const canvas = (await page.locator('.model-canvas').boundingBox())!
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2)
  await page.mouse.wheel(0, -140)
  await expect(effort(page, 'M')).not.toHaveAttribute('d', first!)
  const zoom = await effort(page, 'M').getAttribute('d')
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(canvas.x + canvas.width / 2 + 45, canvas.y + canvas.height / 2 - 25, { steps: 3 })
  await page.mouse.up({ button: 'middle' })
  await expect(effort(page, 'M')).not.toHaveAttribute('d', zoom!)
  await expect(state(page)).toHaveText('Resultado vigente')
  await expect(button(page, 'Deshacer')).toBeDisabled()

  await button(page, 'Volver al Inspector').click()
  await page.keyboard.press('n')
  await page.mouse.click(canvas.x + 115, canvas.y + 200)
  await expect(page.locator('[data-node-id="N3"]')).toHaveCount(1)
  await expect(legend(page)).toContainText('Resultado desactualizado')
  await expect(layer(page)).toHaveCount(0)
  await button(page, 'Deshacer').click()
  await expect(layer(page)).toHaveCount(0)
  await analyze(page)
  await expect(effort(page, 'M')).toHaveCount(1)
  await expect(page.getByRole('status', { name: 'Estado de guardado' })).toHaveText('Guardado local')
  await page.reload()
  await choose(page, 'M · Momento')
  await expect(layer(page)).toHaveCount(0)
  await analyze(page)
  await expect(effort(page, 'M')).toHaveCount(1)
})

test('diferencia armadura axial, mecanismo y propiedades pendientes', async ({ page }) => {
  await page.goto('./')
  await importInclined(page, { axial: true })
  await analyze(page)
  await choose(page, 'V · Cortante')
  await expect(legend(page)).toContainText('No aplicable en armaduras')
  await expect(effort(page, 'V')).toHaveCount(0)
  await choose(page, 'A · Axial')
  await expect(legend(page)).toContainText('8 kN')
  await expect(effort(page, 'N')).toHaveCount(1)
  await choose(page, 'AVM · Combinada')
  await expect(page.getByRole('region', { name: 'Diagramas AVM separados' })).toContainText('V y M no aplican a armaduras axiales.')
  await importInclined(page, { pending: true })
  await choose(page, 'AVM · Combinada')
  await analyze(page, 'Datos incompletos')
  await expect(legend(page)).toContainText('Datos incompletos')
  await expect(layer(page)).toHaveCount(0)
  await importInclined(page, { unstable: true })
  await choose(page, 'Deformada')
  await analyze(page, 'Análisis fallido')
  await expect(legend(page)).toContainText('Análisis fallido')
  await expect(layer(page)).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 650 })
  const menu = await options(page)
  const canvas = (await page.locator('.canvas-shell').boundingBox())!
  const popup = (await menu.boundingBox())!
  expect(popup.x).toBeGreaterThanOrEqual(canvas.x)
  expect(popup.x + popup.width).toBeLessThanOrEqual(canvas.x + canvas.width)
  expect(popup.y + popup.height).toBeLessThanOrEqual(canvas.y + canvas.height)
})

test('desarrolla tramos colineales y muestra los pórticos inclinados por barra', async ({ page }) => {
  await page.goto('./')
  function document(inclined: boolean): LegacyProject {
    const points = inclined ? [[0, 0], [1, 2], [4, 2], [6, 0]] : [[0, 0], [2, 0], [4, 0], [6, 0]]
    return {
      schemaVersion: 2, id: inclined ? 'portico-avm-tramos' : 'viga-avm-tramos',
      name: inclined ? 'Pórtico inclinado' : 'Viga continua', createdAt: '2026-11-21T12:00:00.000Z',
      modifiedAt: '2026-11-21T12:00:00.000Z', view: { grid: true, dimensions: 'hidden' },
      model: {
        nodes: points.map(([x, y], i) => ({ id: `N${i + 1}`, label: `N${i + 1}`, x: x!, y: y! })),
        bars: [
          { id: 'B1', label: 'B1', startId: 'N1', endId: 'N2' },
          { id: 'B2', label: 'B2', startId: 'N3', endId: 'N2' },
          { id: 'B3', label: 'B3', startId: 'N3', endId: 'N4' },
        ],
        loads: [
          { id: 'C1', kind: 'point', barId: 'B2', frame: 'global', s: 1, force: { x: 0, y: -8000 } },
          { id: 'C2', kind: 'distributed', barId: 'B3', frame: 'global', s0: .25, s1: 1.75,
            profile: 'uniform', q0: { x: 0, y: -3000 }, q1: { x: 0, y: -3000 } },
        ],
        supports: [{ kind: 'fixed', nodeId: 'N1' },
          { kind: 'roller', nodeId: 'N4', surfaceAngle: 0 }, ...inclined ? [] : [{ kind: 'roller' as const, nodeId: 'N3', surfaceAngle: 0 }]],
        mechanics: { version: 1, assignments: ['B1', 'B2', 'B3'].map(barId => ({ barId, kind: 'frame2d', E: 2e11, A: .02, I: 1e-5 })) },
        nextBar: 4, nextLoad: 3, nextNode: 5,
      },
    }
  }
  async function load(inclined: boolean, mixed = false) {
    const source = document(inclined)
    const model = source.model
    const fixture = mixed ? { ...source, id: 'viga-avm-mixta', model: { ...model,
      loads: [model.loads[0]!, { kind: 'nodal', id: 'C2', nodeId: 'N4', force: { x: 4500, y: 0 }, moment: 0 }],
      mechanics: { version: 1, assignments: model.mechanics.assignments.map(item =>
        item.barId === 'B3' ? { kind: 'truss2d', barId: item.barId, E: item.E, A: item.A } : item) } } } : source
    await button(page, 'Proyectos').click()
    await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
      name: 'tramos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)),
    })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await analyze(page)
    await choose(page, 'AVM · Combinada')
  }
  await load(false)
  const panel = page.getByRole('region', { name: 'Diagramas AVM separados' })
  await expect(panel).toHaveAttribute('data-avm-presentation', 'developed')
  const develop = panel.getByLabel('Desarrollar viga continua')
  const refs = panel.locator('[data-reference-bar]')
  const chart = panel.locator('svg')
  if (process.env.AULA_JUMP_BEFORE) await page.screenshot({ path: 'docs/media/hito-5.1-salto-antes.png', animations: 'disabled' })
  expect(await refs.evaluateAll(items => items.map(item => item.getAttribute('data-reference-bar')))).toEqual(['B1', 'B2', 'B3'])
  const joint = panel.locator('[data-avm-band="V"] line[data-avm-joint-jump="N3"]')
  await expect(joint).toHaveCount(1)
  expect(await joint.getAttribute('x1')).toBe(await joint.getAttribute('x2'))
  expect(await joint.getAttribute('y1')).not.toBe(await joint.getAttribute('y2'))
  await choose(page, 'V · Cortante')
  const cadJoint = layer(page).locator('line[data-avm-joint-jump="N3"]')
  await expect(cadJoint).toHaveCount(1)
  expect(await cadJoint.getAttribute('x1')).toBe(await cadJoint.getAttribute('x2'))
  expect(await cadJoint.getAttribute('y1')).not.toBe(await cadJoint.getAttribute('y2'))
  if (process.env.AULA_JUMP_CAPTURES) await page.screenshot({ path: 'docs/media/hito-5.1-salto-cad.png', animations: 'disabled' })
  await button(page, 'Acercar').click()
  await expect(cadJoint).toHaveCount(1)
  expect(await cadJoint.getAttribute('x1')).toBe(await cadJoint.getAttribute('x2'))
  await button(page, 'Alejar').click()
  await choose(page, 'AVM · Combinada')
  if (process.env.AULA_JUMP_CAPTURES) await page.screenshot({ path: 'docs/media/hito-5.1-salto-franjas.png', animations: 'disabled' })
  for (const field of ['N', 'V', 'M']) await expect(panel.locator(`[data-avm-band="${field}"] [data-band-bar]`)).toHaveCount(3)
  await (await options(page)).getByLabel('Cargas aplicadas').uncheck()
  await page.keyboard.press('Escape')
  await pick(page, 'B3')
  await expect(panel.getByLabel('Barra en franjas')).toHaveValue('B3')
  const box = (await chart.boundingBox())!
  await chart.click({ position: { x: box.width * (88 + 607 / 2) / 720, y: box.height * 232 / 401 } })
  await expect(chart.locator('[data-station-guide]')).toHaveAttribute('data-station-guide', '3')
  await expect(panel.getByLabel('Barra en franjas')).toHaveValue('B2')
  await expect(page.locator('[data-bar-id="B2"]')).toHaveClass(/is-selected/)
  await expect(panel.getByLabel('Consulta en las franjas')).toContainText('S = 3 m')
  await expect(page.getByLabel('Estación s (m)')).toHaveValue('1')
  await capture(page, 'viga-continua')
  await develop.uncheck()
  await expect(refs).toHaveCount(1)
  await develop.check()
  await expect(refs).toHaveCount(3)
  await (await options(page)).getByLabel('Etiquetas de valores').uncheck()
  await expect(panel.locator('.avm-band-mark')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('.model-canvas [data-avm-bar]')).toHaveCount(0)

  await load(false, true)
  await expect(panel.locator('[data-avm-band="N"] [data-band-bar]')).toHaveCount(3)
  await expect(panel.locator('[data-avm-band="V"] [data-band-bar]')).toHaveCount(2)
  await expect(panel.locator('[data-avm-band="M"]')).toContainText('B3 · M no aplica a armaduras')
  await load(true)
  await expect(panel).toHaveAttribute('data-avm-presentation', 'compact')
  await expect(panel.locator('[data-compact-member]')).toHaveCount(3)
  const axial = (await panel.locator('.avm-compact-N').boundingBox())!
  const reference = (await panel.locator('.avm-compact-model').boundingBox())!
  const shear = (await panel.locator('.avm-compact-V').boundingBox())!
  const moment = (await panel.locator('.avm-compact-M').boundingBox())!
  expect(axial.x).toBeLessThan(reference.x)
  expect(reference.x).toBeLessThan(shear.x)
  expect(moment.y).toBeGreaterThan(reference.y)
  await capture(page, 'portico-compacto')
  await panel.getByLabel('Presentación AVM').selectOption('developed')
  await expect(panel).toHaveAttribute('data-avm-presentation', 'developed')
  await panel.getByLabel('Presentación AVM').selectOption('auto')
  await page.setViewportSize({ width: 390, height: 820 })
  const mobileReference = (await panel.locator('.avm-compact-model').boundingBox())!
  const mobileAxial = (await panel.locator('.avm-compact-N').boundingBox())!
  expect(mobileReference.y).toBeLessThan(mobileAxial.y)
  if (process.env.AULA_NEW_CAPTURES) {
    await panel.locator('.avm-compact').screenshot({ path: 'docs/media/rotulas-avm-portico-movil.png', animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1920, height: 1080 })
  await expect(develop).toHaveCount(0)
  await expect(refs).toHaveCount(1)
  await (await options(page)).getByLabel('Cargas aplicadas').uncheck()
  await page.keyboard.press('Escape')
  await pick(page, 'B3')
  await expect(refs.first()).toHaveAttribute('data-reference-bar', 'B3')
  await expect(panel).toContainText('-45° en el CAD')
  await page.getByText('Caso activo · Todas las cargas', { exact: true }).click()
  await page.getByLabel('Incluir automáticamente todas las cargas').uncheck()
  await expect(state(page)).toHaveText('Resultado desactualizado')
  await expect(panel).toHaveCount(0)
})
