import { expect, test } from '@playwright/test'
import { makeProject } from '../../src/projects/document'
import { EMPTY_STRUCTURE } from '../../src/domain/structure'
import type { Structure } from '../../src/domain/structure'

test('dibuja, consulta y analiza una cadena de 240 barras con Worker', async ({ page }) => {
  // La cadena tiene solución cerrada P·L/(E·A) y comprueba un modelo mayor que los ejemplos.
  const count = 240
  const nodes = Array.from({ length: count + 1 }, (_, index) => ({
    id: `N${index + 1}`, label: `N${index + 1}`, x: index, y: 0,
  }))
  const bars = nodes.slice(1).map((node, i) => ({
    id: `B${i + 1}`, label: `B${i + 1}`, startId: nodes[i]!.id, endId: node.id,
  }))
  const model: Structure = { ...EMPTY_STRUCTURE, nodes, bars, nextNode: nodes.length + 1, nextBar: count + 1, nextLoad: 2,
    supports: nodes.map(({ id: nodeId }, index) => index === 0 ? { nodeId, kind: 'pinned' }
      : { nodeId, kind: 'roller', surfaceAngle: 0 }),
    loads: [{ kind: 'nodal', id: 'C1', nodeId: nodes.at(-1)!.id, force: { x: 1000, y: 0 }, moment: 0 }],
    mechanics: { version: 1, assignments: bars.map(({ id: barId }) => ({ barId, kind: 'truss2d', E: 200e9, A: .001 })) },
  }
  const fixture = makeProject('Cadena de verificación', model)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('./')
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click()
  const imported = performance.now()
  await page.getByLabel('Archivo de proyecto JSON').setInputFiles({
    name: 'cadena.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)),
  })
  await expect(page.locator('[data-bar-id]')).toHaveCount(count)
  const importMs = performance.now() - imported
  const svgElements = await page.locator('.model-canvas *').count()
  const canvas = (await page.locator('.model-canvas').boundingBox())!
  await page.mouse.move(canvas.x + 35, canvas.y + 60)
  await page.mouse.move(canvas.x + canvas.width - 35, canvas.y + 95, { steps: 15 })
  const started = performance.now()
  await page.getByRole('button', { name: 'Analizar estructura', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Estado de análisis' })).toHaveText('Resultado vigente', { timeout: 15_000 })
  const elapsedMs = performance.now() - started
  const last = page.getByRole('table', { name: 'Desplazamientos nodales' }).getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'N241', exact: true }) })
  await expect(last.getByRole('cell').nth(0)).toHaveText('1.2')
  expect(errors).toEqual([])
  if (process.env.AULA_HITO6_METRICS) {
    const heap = await page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } })
      .memory?.usedJSHeapSize)
    console.log(JSON.stringify({ bars: count, svgElements, importMs: Math.round(importMs),
      analyzeAndRenderMs: Math.round(elapsedMs), heapBytes: heap ?? null }))
  }
})
