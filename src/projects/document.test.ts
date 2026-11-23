import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createBar, EMPTY_STRUCTURE } from '../domain/structure'
import { changeNodeSupport } from '../domain/support'
import { saveLoad } from '../domain/load'
import type { Edit } from '../domain/structure'
import { importProject, makeProject, readProject } from './document'
import { DEFAULT_LIBRARY, makeSection } from '../domain/library'

function ok<T>(result: Edit<T>) {
  if ('error' in result) throw new Error(result.error)
  return result.model
}

function project() {
  let model = ok(createBar(EMPTY_STRUCTURE, { point: { x: 0, y: 0 } }, { point: { x: 8, y: 0 } }))
  model = ok(changeNodeSupport(model, 'N1', { kind: 'roller', surfaceAngle: Math.PI / 6 }, undefined))
  model = ok(saveLoad(model, { kind: 'nodal', nodeId: 'N2', force: { x: 2, y: -30 }, moment: 40 }))
  model = ok(saveLoad(model, { kind: 'point', barId: 'B1', frame: 'local', s: 4, force: { x: 1000, y: -1000 } }))
  model = ok(saveLoad(model, { kind: 'distributed', barId: 'B1', frame: 'global', profile: 'linear', s0: 1, s1: 8,
    q0: { x: 1, y: 10 }, q1: { x: 1, y: 20 } }))
  return makeProject('Modelo de prueba', model, { grid: false, dimensions: 'selection' })
}

describe('Documento de proyecto versionado', () => {
  it('migra v5 con extremos rígidos y valida las liberaciones de pórtico en v6', () => {
    const data = project()
    const bar = data.model.bars[0]!
    const rigid = readProject({ ...data, schemaVersion: 5 })
    expect(rigid.model.bars[0]).toEqual(bar)
    const articulated = { ...data.model, bars: [{ ...bar, releaseJ: true }],
      mechanics: { version: 1, assignments: [{ barId: bar.id, kind: 'frame2d', E: 200e9, A: .02, I: 8e-6 }] } }
    const saved = importProject(JSON.stringify({ ...data, model: articulated }))
    expect(saved.model.bars[0]).toEqual({ ...bar, releaseJ: true })
    expect(() => readProject({ ...data, schemaVersion: 5, model: articulated })).toThrow('Liberaciones inválidas')
    expect(() => readProject({ ...data, model: { ...articulated, mechanics: data.model.mechanics } }))
      .toThrow('Solo las barras de pórtico')
  })
  it.each(['vacio.json', 'portico.json'])('migra el ejemplo v1 %s sin cambiar el modelo ni sus metadatos', file => {
    const source = readFileSync(new URL(`../../examples/${file}`, import.meta.url), 'utf8')
    const original = JSON.parse(source)
    expect(original.schemaVersion).toBe(1)
    expect(importProject(source)).toEqual({ ...original, schemaVersion: 6,
      model: { ...original.model, mechanics: { version: 1, assignments: [] }, library: DEFAULT_LIBRARY } })
  })
  it('admite un modelo vacío y conserva íntegro el modelo físico de un JSON completo', () => {
    const empty = makeProject()
    expect(importProject(JSON.stringify(empty))).toEqual(empty)
    const data = project()
    expect(importProject(JSON.stringify(data))).toEqual(data)
    const duplicate = makeProject(data.name, data.model, data.view)
    expect(duplicate.id).not.toBe(data.id)
    expect(duplicate.model).toEqual(data.model)
  })

  it('rechaza JSON corrupto, versión incompatible y números no finitos', () => {
    expect(() => importProject('{?')).toThrow('JSON válido')
    expect(() => readProject({ ...project(), schemaVersion: 7 })).toThrow('Versión de esquema')
    const data = project()
    const [node] = data.model.nodes
    expect(() => readProject({ ...data, model: { ...data.model, nodes: [{ ...node, x: Infinity }] } })).toThrow('finito')
  })

  it('conserva asignaciones v2 completas y parciales, sin completar propiedades automáticamente', () => {
    const data = project()
    const assignments = [{ barId: 'B1', kind: 'frame2d', E: 200e9, I: 8e-6 }] as const
    const withValues = { ...data, model: { ...data.model, mechanics: { version: 1 as const, assignments } } }
    expect(importProject(JSON.stringify(withValues))).toEqual(withValues)
    const complete = { ...withValues, model: { ...withValues.model, mechanics: {
      version: 1, assignments: [{ ...assignments[0], A: .02 }],
    } } }
    expect(importProject(JSON.stringify(complete))).toEqual(complete)
    const { library: _, ...legacy } = complete.model
    expect(readProject({ ...complete, schemaVersion: 2, model: legacy })).toEqual(complete)
  })

  it('conserva el vínculo v3 y rechaza catálogos, geometría o vínculos inconsistentes', () => {
    const data = project()
    const section = makeSection('s1', 'Rectangular', { kind: 'rectangle', dimensions: { b: .2, h: .4 } })
    const library = { ...DEFAULT_LIBRARY, sections: [section], defaultSectionId: 's1' }
    const entry = { barId: 'B1', kind: 'frame2d', materialId: 'acero', sectionId: 's1', sectionAxis: 'y',
      E: 200e9, A: section.values.A, I: section.values.Iyy }
    const model = { ...data.model, library, mechanics: { version: 1, assignments: [entry] } }
    expect(readProject({ ...data, schemaVersion: 3, model })).toEqual({ ...data, model })
    expect(importProject(JSON.stringify({ ...data, model }))).toEqual({ ...data, model })
    expect(() => readProject({ ...data, model: { ...model, mechanics: { version: 1,
      assignments: [{ ...entry, sectionId: 'ausente' }] } } })).toThrow('inexistente')
    expect(() => readProject({ ...data, model: { ...model, library: { ...library, sections: [
      { ...section, values: { ...section.values, A: 5 } },
    ] } } })).toThrow('inconsistentes')
  })

  it('migra los datos de diseño SI desde v4 y valida los metadatos resistentes', () => {
    const data = project()
    const design = { materials: [{ materialId: 'acero', origin: 'normative-verified', source: 'Referencia de prueba', fy: 250e6, fu: 410e6 }],
      criterion: { id: 'explicit', name: 'Criterio del ejercicio', tension: 95e6,
        service: { reference: 'relative-chord', limit: .012 } } } as const
    expect(importProject(JSON.stringify({ ...data, design }))).toEqual({ ...data, design })
    expect(readProject({ ...data, schemaVersion: 4, design })).toEqual({ ...data, design })
    expect(readProject({ ...data, schemaVersion: 3, design })).toEqual(data)
    expect(() => readProject({ ...data, design: { ...design, materials: [...design.materials, ...design.materials] } })).toThrow('duplicadas')
    expect(() => readProject({ ...data, design: { ...design, materials: [{ ...design.materials[0], fy: -1 }] } })).toThrow('fy')
    expect(() => readProject({ ...data, design: { ...design, criterion: { ...design.criterion, service: { ...design.criterion.service,
      reference: 'global' } } } })).toThrow('referencia')
  })

  it('valida y recupera parámetros de acero v5 sin alterar el modelo', () => {
    const data = project()
    const steel = [{ barId: 'B1', method: 'LRFD', grade: 'ASTM A36', x: { length: 4, k: .8, ends: 'Ejercicio' },
      connection: { kind: 'partial-bolted', netArea: .008, eccentricity: .02, length: .1 } }] as const
    const design = { materials: [], steel }
    expect(importProject(JSON.stringify({ ...data, design }))).toEqual({ ...data, design })
    expect(readProject({ ...data, schemaVersion: 4, design })).toEqual({ ...data, design: { materials: [] } })
    expect(() => readProject({ ...data, design: { materials: [], steel: [...steel, ...steel] } })).toThrow('duplicadas')
    expect(() => readProject({ ...data, design: { materials: [], steel: [{ ...steel[0], x: { ...steel[0].x, k: 0 } }] } })).toThrow('K x')
  })

  it('rechaza la sección mecánica inválida sin aceptar una parte del documento', () => {
    const data = project()
    const entry = { barId: 'B1', kind: 'frame2d', E: 200e9, A: .02, I: 8e-6 }
    const withEntries = (assignments: unknown[]) => ({
      ...data, model: { ...data.model, mechanics: { version: 1, assignments } },
    })
    expect(() => readProject(withEntries([entry, entry]))).toThrow('repetidos')
    expect(() => readProject(withEntries([{ ...entry, barId: 'B99' }]))).toThrow('barra inexistente B99')
    expect(() => readProject(withEntries([{ ...entry, kind: 'truss2d' }]))).toThrow('pórtico')
    for (const value of [null, -1, 0, Infinity, NaN]) {
      expect(() => readProject(withEntries([{ ...entry, I: value }]))).toThrow()
    }
    expect(() => readProject({ ...data, model: { ...data.model, mechanics: { version: 2, assignments: [] } } })).toThrow('incompatible')
  })

  it('rechaza IDs duplicados, contadores antiguos, referencias y cargas inválidas', () => {
    const data = project()
    const { model } = data
    const [bar] = model.bars
    expect(() => readProject({ ...data, model: { ...model, nodes: [...model.nodes, model.nodes[0]] } })).toThrow('repetidos')
    expect(() => readProject({ ...data, model: { ...model, nextLoad: 3 } })).toThrow('Contador')
    expect(() => readProject({ ...data, model: { ...model, bars: [{ ...bar, endId: 'N8' }] } })).toThrow('inexistentes')
    const [a, b, c] = model.loads
    expect(() => readProject({ ...data, model: { ...model, loads: [a, { ...b, s: 9 }, c] } })).toThrow('distancia')
    expect(() => readProject({ ...data, model: { ...model, loads: [a, b, { ...c, s0: 8 }] } })).toThrow('intervalo')
    expect(() => readProject({ ...data, model: { ...model, supports: [{ ...model.supports[0], surfaceAngle: 7 }] } })).toThrow('Orientación')
  })
})
