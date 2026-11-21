import { describe, expect, it } from 'vitest'
import { reverseBar, splitBar } from './barEdition'
import { copyEntities, duplicateLoads, pasteGeometry } from './clipboard'
import { globalLoadVector, loadBarGeometry, saveLoad } from './load'
import type { LoadDefinition, StructuralLoad } from './load'
import { createBar, EMPTY_STRUCTURE } from './structure'
import type { Edit, Structure } from './structure'
import { changeNodeSupport } from './support'

function ok<T>(edit: Edit<T>) {
  if ('error' in edit) throw new Error(edit.error)
  return edit
}

const point = { kind: 'point', barId: 'B1', s: 3, frame: 'local', force: { x: 2000, y: -5000 } } satisfies LoadDefinition
const ramp = {
  kind: 'distributed', barId: 'B1', s0: 0, s1: 8, frame: 'local', profile: 'linear',
  q0: { x: 0, y: 10000 }, q1: { x: 0, y: 30000 },
} satisfies LoadDefinition

function fixture() {
  let model = EMPTY_STRUCTURE
  for (const [x0, x1] of [[0, 8], [8, 12], [12, 16], [16, 20]] as const) {
    model = ok(createBar(model, { point: { x: x0, y: 0 } }, { point: { x: x1, y: 0 } })).model
  }
  model = ok(changeNodeSupport(model, 'N1', { kind: 'pinned' }, undefined)).model
  model = ok(changeNodeSupport(model, 'N5', { kind: 'roller', surfaceAngle: Math.PI / 6 }, undefined)).model
  return model
}

function loadsOn(model: Structure, id: string) {
  return model.loads.filter(load => load.kind !== 'nodal' && load.barId === id)
}

function integral(load: Extract<StructuralLoad, { kind: 'distributed' }>, origin: number) {
  const length = load.s1 - load.s0
  const force = length * (load.q0.y + load.q1.y) / 2
  const moment = (origin + load.s0) * force + length ** 2 * (load.q0.y + 2 * load.q1.y) / 6
  return { force, moment }
}

describe('Transformaciones físicas del Hito 2', () => {
  it('divide el ejemplo de 8 m y conserva resultante y momento estático', () => {
    let model = ok(saveLoad(fixture(), ramp)).model
    for (const s of [1, 3, 6]) model = ok(saveLoad(model, { ...point, s })).model
    const divided = ok(splitBar(model, 'B1', 3))
    expect(divided.item.bars.map(({ startId, endId }) => [startId, endId])).toEqual([['N1', 'N6'], ['N6', 'N2']])
    expect(divided.model.supports).toBe(model.supports)
    const [left, right] = divided.item.bars.map(bar => loadsOn(divided.model, bar.id).find(load => load.kind === 'distributed')!)
    expect(left).toMatchObject({ s0: 0, s1: 3, q0: { y: 10000 }, q1: { y: 17500 } })
    expect(right).toMatchObject({ s0: 0, s1: 5, q0: { y: 17500 }, q1: { y: 30000 } })
    const first = integral(left!, 0)
    const second = integral(right!, 3)
    expect(first.force + second.force).toBeCloseTo(160000, 7)
    expect(first.moment + second.moment).toBeCloseTo(746666.6666666667, 7)
    expect(divided.model.loads).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'point', id: 'C2', barId: 'B5', s: 1 }),
      expect.objectContaining({ kind: 'nodal', id: 'C3', nodeId: 'N6', force: point.force }),
      expect.objectContaining({ kind: 'point', id: 'C4', barId: 'B6', s: 3 }),
    ]))
    expect(splitBar(model, 'B1', 0)).toHaveProperty('error')
    expect(splitBar(model, 'B1', 8)).toHaveProperty('error')
  })

  it('conserva distribuciones de un solo lado e invierte cargas oblicuas preservando sus vectores', () => {
    let model = fixture()
    model = ok(saveLoad(model, { ...ramp, s0: 1, s1: 2 })).model
    model = ok(saveLoad(model, { ...ramp, s0: 5, s1: 8, profile: 'uniform', frame: 'global', q1: ramp.q0 })).model
    model = ok(saveLoad(model, point)).model
    model = ok(saveLoad(model, { ...point, frame: 'global' })).model
    const reversed = ok(reverseBar(model, 'B1')).model
    expect(ok(reverseBar(model, 'B2')).item).toMatchObject({ id: 'B2', startId: 'N3', endId: 'N2' })
    expect(reversed.loads[0]).toMatchObject({ s0: 6, s1: 7, q0: { y: -30000 }, q1: { y: -10000 } })
    expect(reversed.loads[1]).toMatchObject({ s0: 0, s1: 3, q0: ramp.q0, q1: ramp.q0 })
    const vector = globalLoadVector({ x: -2000, y: 5000 }, 'local', loadBarGeometry(reversed, 'B1')!.angle)
    expect(vector.x).toBeCloseTo(point.force.x)
    expect(vector.y).toBeCloseTo(point.force.y)
    expect(reversed.loads[2]).toMatchObject({ s: 5, force: { x: -2000, y: 5000 } })
    expect(reversed.loads[3]).toMatchObject({ s: 5, force: point.force })
    const divided = ok(splitBar(model, 'B1', 4)).model
    expect(divided.loads[0]).toMatchObject({ id: 'C1', barId: 'B5', s0: 1, s1: 2 })
    expect(divided.loads[1]).toMatchObject({ id: 'C2', barId: 'B6', s0: 1, s1: 4 })
  })

  it('remapea un conjunto conectado con apoyos y cargas sin unir nudos coincidentes', () => {
    let model = ok(saveLoad(fixture(), point)).model
    model = ok(saveLoad(model, ramp)).model
    model = ok(saveLoad(model, { kind: 'nodal', nodeId: 'N1', force: { x: 0, y: -2000 }, moment: 1000 })).model
    const copied = copyEntities(model, model.bars.map(bar => ({ kind: 'bar', id: bar.id })))
    if ('error' in copied || copied.kind !== 'geometry') throw new Error('Copia inválida')
    const pasted = ok(pasteGeometry(model, copied, { x: 0, y: 0 })).model
    expect(pasted.nodes).toHaveLength(10)
    expect(pasted.bars.slice(4).map(bar => [bar.startId, bar.endId])).toEqual([
      ['N6', 'N7'], ['N7', 'N8'], ['N8', 'N9'], ['N9', 'N10'],
    ])
    expect(pasted.supports.slice(2).map(item => item.nodeId)).toEqual(['N6', 'N10'])
    expect(pasted.loads.slice(3)).toMatchObject([{ id: 'C4', barId: 'B5', s: 3 }, { id: 'C5', barId: 'B5' }, { id: 'C6', nodeId: 'N6' }])
    expect(pasteGeometry(model, copied, { x: 1e9, y: 0 })).toHaveProperty('error')
    const lone = copyEntities(model, [{ kind: 'node', id: 'N3' }])
    if ('error' in lone || lone.kind !== 'geometry') throw new Error('Copia inválida')
    expect(ok(pasteGeometry(model, lone, { x: 18, y: 5 })).model.nodes.at(-1)).toMatchObject({ id: 'N6', x: 18, y: 5 })
    const action = copyEntities(model, [{ kind: 'load', id: 'C1' }])
    if ('error' in action || action.kind !== 'loads') throw new Error('Copia inválida')
    expect(duplicateLoads(model, action, { kind: 'node', id: 'N1' })).toHaveProperty('error')
    expect(ok(duplicateLoads(model, action, { kind: 'bar', id: 'B2' })).model.loads.at(-1)).toMatchObject({ id: 'C4', barId: 'B2', s: 3 })
  })
})
