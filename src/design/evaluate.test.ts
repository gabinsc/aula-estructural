import { describe, expect, it } from 'vitest'
import { solveAnalysis } from '../analysis'
import type { AnalysisInput } from '../analysis'
import { DEFAULT_LIBRARY, makeSection } from '../domain/library'
import { EMPTY_STRUCTURE } from '../domain/structure'
import type { Structure } from '../domain/structure'
import type { SectionGeometry } from '../geometry/sections'
import { PA_PER_MPA } from './contracts'
import type { DesignCase, DesignSettings } from './contracts'
import { evaluateDesign, sectionFibers } from './evaluate'
import { EMPTY_DESIGN } from './settings'

const E = 200e9, L = 4
const rectangle = { kind: 'rectangle', dimensions: { b: .2, h: .4 } } as const
const pinRoller = [{ nodeId: 'N1', kind: 'pinned' }, { nodeId: 'N2', kind: 'roller', surfaceAngle: 0 }] as const
const fixed = [{ nodeId: 'N1', kind: 'fixed' }] as const
const nodal = (x: number, y: number, moment: number) => ({ id: 'C1', kind: 'nodal', nodeId: 'N2', force: { x, y }, moment } as const)

function fixture(loads: Structure['loads'], geometry?: SectionGeometry,
  supports: Structure['supports'] = fixed, reverse = false): AnalysisInput {
  const section = geometry && makeSection('S1', 'Referencia', geometry)
  const simple = { barId: 'B1', E, A: section?.values.A ?? .02 }
  const property = section ? { ...simple, kind: 'frame2d' as const, I: section.values.Ixx } : { ...simple, kind: 'truss2d' as const }
  const definition = { version: 1 as const, assignments: [property] }
  const model: Structure = { ...EMPTY_STRUCTURE, nodes: [{ id: 'N1', label: 'N1', x: 0, y: 0 }, { id: 'N2', label: 'N2', x: L, y: 0 }],
    bars: [{ id: 'B1', label: 'B1', startId: reverse ? 'N2' : 'N1', endId: reverse ? 'N1' : 'N2' }],
    supports, loads, nextNode: 3, nextBar: 2, nextLoad: loads.length + 1,
    library: { ...DEFAULT_LIBRARY, sections: section ? [section] : [] },
    mechanics: { version: 1, assignments: [{ ...property, materialId: 'acero', ...(section && { sectionId: section.id, sectionAxis: 'x' as const }) }] } }
  return { model, definition, revision: 'analisis-a', loadCase: { id: 'caso-a' } }
}

function query(input: AnalysisInput, settings = EMPTY_DESIGN, overrides: Partial<DesignCase> = {}) {
  const result = solveAnalysis(input)
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return evaluateDesign(input.model, settings, { projectId: 'project-1', physicalRevision: 'fisica-a',
    analysisRevision: input.revision!, loadCaseId: input.loadCase.id, s: L / 2, side: 'right', barId: 'B1', ...overrides }, result)
}

describe('Diseño elástico nominal sobre resultados vigentes', () => {
  it.each([120000, -120000])('barra axial de 0,02 m²: la fuerza %d N conserva el signo y la unidad', P => {
    const result = query(fixture([nodal(P, 0, 0)], undefined, pinRoller))
    expect(result.stresses[0]!.stress / PA_PER_MPA).toBeCloseTo(P / .02 / 1e6, 10)
    expect(result.actions?.V).toBeUndefined()
    expect(result.actions?.M).toBeUndefined()
    expect(result.material).toBeUndefined()
    expect(result.checks).toHaveLength(0)
  })

  it.each([0, 160000])('rectángulo, flexión por par y aporte axial de %d N', P => {
    const result = query(fixture([nodal(P, 0, 12000)], rectangle), undefined, { s: .7 })
    const I = .2 * .4 ** 3 / 12
    expect(result.section?.positive.S).toBeCloseTo(I / .2, 12)
    expect(result.section?.negative.S).toBeCloseTo(I / .2, 12)
    expect(result.actions?.M).toBeCloseTo(12000, 5)
    expect(result.stresses[0]!.stress / PA_PER_MPA).toBeCloseTo(P / .08 / 1e6 - 2.25, 9)
    expect(result.stresses[1]!.stress / PA_PER_MPA).toBeCloseTo(P / .08 / 1e6 + 2.25, 9)
    expect(result.designCase.s).toBe(.7)
  })

  it('sección tipo I: contraste con el rectángulo exterior menos dos huecos laterales', () => {
    const b = .2, h = .4, tw = .02, tf = .03, M = 12000
    const result = query(fixture([nodal(0, 0, M)], { kind: 'I', dimensions: { b, h, tw, tf } }))
    const I = (b * h ** 3 - (b - tw) * (h - 2 * tf) ** 3) / 12
    expect(result.section?.I).toBeCloseTo(I, 12)
    expect(result.stresses[0]!.stress).toBeCloseTo(-M * h / (2 * I), 6)
  })

  it('sección T con fibras asimétricas en un eje principal y eje alternativo explícito', () => {
    const geometry = { kind: 'T', dimensions: { b: .3, h: .4, tw: .1, tf: .1 } } as const
    const result = query(fixture([nodal(0, 0, 12000)], geometry))
    const I = .1 * .3 ** 3 / 12 + .3 * .1 ** 3 / 12 + 2 * .03 * .1 ** 2
    expect(result.section?.I).toBeCloseTo(I, 12)
    expect(result.section?.positive.c).toBeCloseTo(.15, 12)
    expect(result.section?.negative.c).toBeCloseTo(.25, 12)
    expect(result.stresses[0]!.stress).toBeCloseTo(-12000 * .15 / I, 6)
    expect(result.stresses[1]!.stress).toBeCloseTo(12000 * .25 / I, 6)
    const y = sectionFibers(makeSection('T', 'T', geometry), 'y')
    expect(y.I).toBeCloseTo(.1 * .3 ** 3 / 12 + .3 * .1 ** 3 / 12, 12)
    expect(y.positive.c).toBeCloseTo(.15, 12)
  })

  it('al invertir la barra se intercambian las fibras locales de una sección simétrica', () => {
    const loads = [nodal(160000, 0, 12000)]
    const direct = query(fixture(loads, rectangle), undefined, { s: 1 })
    const reversed = query(fixture(loads, rectangle, fixed, true), undefined, { s: 3 })
    expect(direct.actions!.M! + reversed.actions!.M!).toBeCloseTo(0, 5)
    expect(direct.actions!.N).toBeCloseTo(reversed.actions!.N, 5)
    expect(direct.stresses[0]!.stress).toBeCloseTo(reversed.stresses[1]!.stress, 6)
    expect(direct.stresses[1]!.stress).toBeCloseTo(reversed.stresses[0]!.stress, 6)
  })

  it('encuentra los extremos combinados fuera del máximo de M para distribución axial y transversal', () => {
    const qx = 20000, qy = 5000
    const q = { x: qx, y: -qy }
    const result = query(fixture([{ id: 'C1', kind: 'distributed', barId: 'B1', frame: 'global', s0: 0, s1: L,
      profile: 'uniform', q0: q, q1: q }], rectangle, pinRoller))
    const A = .08, S = .2 * .4 ** 2 / 6
    const sMax = L / 2 - qx * S / (qy * A), sMin = L / 2 + qx * S / (qy * A)
    expect(result.extremes?.max.s).toBeCloseTo(sMax, 11)
    expect(result.extremes?.min.s).toBeCloseTo(sMin, 11)
    expect(result.extremes?.max.stress).toBeCloseTo(qx * (L - sMax) / A + qy * sMax * (L - sMax) / (2 * S), 5)
  })

  it('encuentra el extremo cuadrático del derivado bajo carga triangular y evalúa ambos lados de un salto puntual', () => {
    const triangular = query(fixture([{ id: 'C1', kind: 'distributed', barId: 'B1', frame: 'global',
      s0: 0, s1: L, profile: 'linear', q0: { x: 0, y: 0 }, q1: { x: 0, y: -5000 } }], rectangle, pinRoller))
    expect(triangular.extremes?.max.s).toBeCloseTo(L / Math.sqrt(3), 11)
    const input = fixture([{ id: 'C1', kind: 'point', barId: 'B1', frame: 'global', s: 2, force: { x: 8000, y: -6000 } }], rectangle, pinRoller)
    const left = query(input, undefined, { s: 2, side: 'left' })
    const right = query(input, undefined, { s: 2, side: 'right' })
    expect(left.stresses[0]!.stress - right.stresses[0]!.stress).toBeCloseTo(8000 / .08, 6)
    expect(left.actions!.V! - right.actions!.V!).toBeCloseTo(6000, 6)
  })

  it('diagnostica sección manual y eje no principal sin convertir el aporte axial en verificación combinada', () => {
    const configuration: DesignSettings = { materials: [], criterion: { id: 'c', name: 'Límite', tension: 1e8 } }
    const manual = query(fixture([nodal(1000, 0, 12000)], { kind: 'manual',
      values: { A: .02, Ixx: 1e-5, Iyy: 2e-5, cx: 0, cy: 0, Ixy: 0 } }), configuration)
    expect(manual.diagnostics[0]!.code).toBe('SECTION_GEOMETRY')
    expect(manual.stresses[0]!.fiber).toBe('axial')
    expect(manual.section).toBeUndefined()
    expect(manual.checks).toHaveLength(0)
    const angle = query(fixture([nodal(1000, 0, 12000)], { kind: 'L', dimensions: { b: .2, h: .3, t: .02 } }))
    expect(angle.diagnostics[0]!.code).toBe('SECTION_AXIS')
    expect(angle.section).toBeUndefined()
  })

  it('oculta resultados desactualizados y rechaza una estación fuera de la barra', () => {
    const input = fixture([nodal(1000, 0, 12000)], rectangle)
    const expired = query(input, undefined, { analysisRevision: 'otro' })
    expect(expired.actions).toBeUndefined()
    expect(expired.stresses).toHaveLength(0)
    expect(expired.diagnostics[0]!.code).toBe('STALE_ANALYSIS')
    expect(query(input, undefined, { loadCaseId: 'otro' }).diagnostics[0]!.code).toBe('STALE_ANALYSIS')
    expect(query(input, undefined, { s: 4.1 }).diagnostics[0]!.code).toBe('INVALID_STATION')
  })

  it('refresca resistencias declaradas y verifica criterios explícitos sin inferir límites a partir de fy', () => {
    const input = fixture([nodal(0, 0, 12000)], rectangle)
    const result = (fy: number, limit: number) => query(input, {
      materials: [{ materialId: 'acero', fy: fy * PA_PER_MPA, origin: 'declared', source: 'Ensayo' }],
      criterion: { id: 'c', name: 'Consulta', tension: limit * PA_PER_MPA, compression: 10 * PA_PER_MPA },
    })
    const first = result(250, 2), changed = result(350, 3)
    expect(first.material?.fy).toBe(250e6)
    expect(changed.material?.fy).toBe(350e6)
    expect(changed.stresses).toEqual(first.stresses)
    expect(first.checks[0]?.status).toBe('exceeds-limit')
    expect(changed.checks[0]?.status).toBe('within-limit')
    expect(changed.designCase.projectId).toBe('project-1')
    expect(changed.designCase.physicalRevision).toBe('fisica-a')
  })

  it('distingue desplazamiento transversal absoluto de la flecha respecto a la cuerda', () => {
    const P = 8000, I = .2 * .4 ** 3 / 12, s = L / 2
    const input = fixture([nodal(0, -P, 0)], rectangle)
    const result = query(input, { materials: [],
      criterion: { id: 's', name: 'Servicio', service: { reference: 'relative-chord', limit: .0006 } } })
    const expected = -P * s ** 2 * (3 * L - s) / (6 * E * I)
    const chord = -P * L ** 3 / (6 * E * I)
    expect(result.service?.local).toBeCloseTo(expected, 12)
    expect(result.service?.relative).toBeCloseTo(expected - chord, 12)
    expect(result.checks[0]?.value).toBeCloseTo(Math.abs(expected - chord), 12)
  })
})
