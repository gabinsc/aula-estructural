import { describe, expect, it } from 'vitest'
import { makeSection } from '../../domain/library'
import { createBar, EMPTY_STRUCTURE } from '../../domain/structure'
import type { Section } from '../../domain/library'
import type { DesignResult } from '../contracts'
import { sectionFibers } from '../evaluate'
import type { DemandKind, SteelDemandDeclaration, SteelMemberSettings } from './contracts'
import { effectiveArea, flexuralBuckling, webShear } from './e090'
import { steelDesign } from './evaluate'
import { steelMemberRevision } from './settings'

const Fy = 250e6, Fu = 400e6, E = 200e9
const settings: SteelMemberSettings = { barId: 'B1', method: 'LRFD', grade: 'ASTM A36' }
const rect = makeSection('r', 'Rectangular', { kind: 'rectangle', dimensions: { b: .2, h: .4 } })
const profile = makeSection('i', 'I', { kind: 'I', dimensions: { b: .15, h: .30, tf: .02, tw: .01 } })
const rev = 'vigente'
const declaration = (kind: DemandKind = 'lrfd-combination', analysisRevision = rev, secondOrder = false): SteelDemandDeclaration =>
  ({ kind, analysisRevision, caseId: 'C', combination: 'Ejercicio declarado', secondOrder })

function check(actions: DesignResult['actions'], options: Partial<SteelMemberSettings> = {}, section?: Section,
  demand?: SteelDemandDeclaration, axis: 'x' | 'y' = 'x', fy = Fy) {
  const design: DesignResult = { designCase: { projectId: 'project-1', loadCaseId: 'C', physicalRevision: 'physical',
    analysisRevision: rev, barId: 'B1', s: 1, side: 'left' }, area: section?.values.A ?? .01, actions,
    section: section ? sectionFibers(section, axis) : undefined,
    material: { materialId: 'A', origin: 'declared', source: 'Ficha', fy, fu: Fu }, checks: [], stresses: [], diagnostics: [] }
  const result = steelDesign(design, { section, E, settings: { ...settings, ...options }, demand })
  return { ...result, state: (id: string) => result.states.find(item => item.id === id)! }
}

describe('E.090 · Resistencias y condiciones de aplicación', () => {
  it('distingue una barra recreada con el mismo ID después de deshacer su geometría', () => {
    const first = createBar(EMPTY_STRUCTURE, { point: { x: 0, y: 0 } }, { point: { x: 2, y: 0 } })
    const second = createBar(EMPTY_STRUCTURE, { point: { x: 0, y: 0 } }, { point: { x: 5, y: 0 } })
    if ('error' in first || 'error' in second) throw new Error('No se pudieron crear las barras de prueba.')
    expect(first.item.id).toBe(second.item.id)
    expect(steelMemberRevision(first.model, first.item.id)).not.toBe(steelMemberRevision(second.model, second.item.id))
  })
  it('§4.1.1 y §2.3: fluencia bruta y fractura neta efectiva por conexión parcial', () => {
    const result = check({ N: 2e6 }, { connection: { kind: 'partial-bolted', netArea: .008, eccentricity: .02, length: .10 } },
      undefined, declaration())
    expect(result.state('tension-yield')).toMatchObject({ nominal: 2.5e6, factor: .9, capacity: 2.25e6, state: 'pass' })
    expect(result.effectiveArea).toBeCloseTo(.0064, 13)
    expect(result.state('tension-rupture').capacity).toBeCloseTo(1920e3, 6)
    expect(result.state('tension-rupture').state).toBe('fail')
    expect(result.governing?.id).toBe('tension-rupture')
    expect(result.partial).toBe(true)
    expect(effectiveArea(.01, { kind: 'direct', netArea: .008 }).Ae).toBe(.008)
    expect(effectiveArea(.01, { kind: 'partial-bolted', netArea: .008, eccentricity: 0, length: .1 }).U).toBe(.9)
  })

  it('§4.1.2: ASD usa esfuerzos admisibles y una declaración compatible propia', () => {
    const options = { method: 'ASD' as const, connection: { kind: 'direct' as const, netArea: .006 } }
    const result = check({ N: 1e6 }, options, undefined, declaration('asd-combination'))
    expect(result.state('tension-yield').capacity).toBeCloseTo(1500e3, 7)
    expect(result.state('tension-yield').nominal).toBeUndefined()
    expect(result.state('tension-yield').equation).toBe('Pa = 0,60Fy·Ag')
    expect(result.state('tension-rupture').capacity).toBeCloseTo(1200e3, 7)
    expect(result.state('tension-rupture').ratio).toBeCloseTo(5 / 6, 12)
    expect(check({ N: 1e6 }, options, undefined, declaration()).state('tension-yield').ratio).toBeUndefined()
  })

  it.each(['unclassified', 'characteristic', 'service', 'asd-combination'] as const)('demanda %s queda sin utilización LRFD', kind => {
    const result = check({ N: 1e6 }, {}, undefined, declaration(kind))
    expect(result.state('tension-yield')).toMatchObject({ nominal: 2.5e6, state: 'pending' })
    expect(result.state('tension-yield').ratio).toBeUndefined()
    expect(result.state('tension-rupture').diagnostic).toMatch(/información insuficiente/)
  })

  it('invalida la clasificación vieja y el resultado sin acciones vigentes', () => {
    expect(check({ N: 1e6 }, {}, undefined, declaration('lrfd-combination', 'anterior')).state('tension-yield').state).toBe('pending')
    expect(check(undefined).state('analysis').state).toBe('stale')
    const change = check({ N: 2e6 }, {}, undefined, declaration(), 'x', 200e6)
    expect(change.state('tension-yield').state).toBe('fail')
    expect(effectiveArea(.01, { kind: 'direct', netArea: .01 }).Ae).toBe(.01)
    expect(() => effectiveArea(.01, { kind: 'direct', netArea: .012 })).toThrow('Ag')
  })

  it('§5.2.1: columna corta y dos ejes con regímenes inelástico y elástico', () => {
    const x = { length: .10, k: 1, ends: 'Articulada' }
    const y = { length: 12, k: 1, ends: 'Articulada' }
    const result = check({ N: -100000 }, { x, y }, rect, declaration())
    const rx = .4 / Math.sqrt(12), ry = .2 / Math.sqrt(12), A = .08
    const xExpected = A * Fy * Math.exp(Math.log(.658) * (.1 / (Math.PI * rx)) ** 2 * Fy / E)
    const yExpected = .877 * Math.PI ** 2 * E * A * ry ** 2 / 12 ** 2
    expect(result.state('buckling-x').capacity).toBeCloseTo(.85 * xExpected, 6)
    expect(result.state('buckling-y').capacity).toBeCloseTo(.85 * yExpected, 7)
    expect(result.governing?.id).toBe('buckling-y')
    expect(check({ N: -1e5 }, { x }, rect, declaration()).state('buckling-y').diagnostic).toMatch(/eje y/)
    expect(check({ N: -1e5 }, { x, y }).state('buckling-x').capacity).toBeUndefined()
  })

  it('§5.2.2: ASD sigue su propia curva admisible', () => {
    const I = .4 * .2 ** 3 / 12, A = .08
    const Cc = Math.PI * Math.sqrt(2 * E / Fy), r = Math.sqrt(I / A)
    const short = flexuralBuckling(E, Fy, A, I, { length: Cc * r / 2, k: 1, ends: 'Articulada' }, 'ASD')
    expect(short.capacity).toBeCloseTo(A * Fy * (7 / 8) / (5 / 3 + 3 / 16 - 1 / 64), 6)
    const long = flexuralBuckling(E, Fy, A, I, { length: 2 * Cc * r, k: 1, ends: 'Articulada' }, 'ASD')
    expect(long.capacity).toBeCloseTo(A * Fy * (3 / 46), 6)
  })

  it('§6.1 y §6.2: I compacta con Lb corto, flexión y cortante en el alma', () => {
    const options = { weldedI: true, flexureRestrained: true, unreinforcedWeb: true, lateralLength: .5 }
    const w = { N: 0, V: 40000, M: 120000 }
    const result = check(w, options, profile, declaration())
    const Z = .15 * .02 * .28 + .01 * .26 ** 2 / 4
    expect(result.state('flexure-yield').nominal).toBeCloseTo(250e6 * Z, 7)
    expect(result.state('ltb').state).toBe('pass')
    expect(result.state('shear').capacity).toBeCloseTo(.9 * .6 * 250e6 * .30 * .01, 7)
    expect(check(w, { ...options, lateralLength: undefined }, profile, declaration()).state('ltb').state).toBe('pending')
    expect(check(w, { ...options, lateralLength: 50 }, profile, declaration()).state('ltb').diagnostic).toMatch(/alabeo/)
    expect(check(w, {}, profile, declaration()).state('shear').state).toBe('outside')
  })

  it('§6.2.2: identifica los tres intervalos de cortante LRFD y la rama ASD implementada', () => {
    const checkWeb = (s: number) => webShear(Fy, .5, .4, .4 / s, 'LRFD')!
    expect(checkWeb(50).nominal).toBeCloseTo(.6 * Fy * .5 * .4 / 50, 6)
    expect(checkWeb(80).nominal).toBeCloseTo(.6 * Fy * .5 * .4 / 80 * 1098 / Math.sqrt(250) / 80, 6)
    expect(checkWeb(100).nominal).toBeCloseTo(.5 * .4 / 100 * 910000e6 / 100 ** 2, 6)
    expect(checkWeb(261)).toBeUndefined()
    expect(webShear(Fy, .5, .4, .008, 'ASD')?.capacity).toBeCloseTo(.4 * Fy * .004, 6)
  })

  it.each([.1, .35])('§8.1.1: interacción LRFD con cociente axial %s y capacidades completas', axialRatio => {
    const options = { weldedI: true, flexureRestrained: true, lateralLength: .5,
      connection: { kind: 'direct' as const, netArea: .007 } }
    const Pc = .9 * Fy * (.15 * .02 * 2 + .01 * .26)
    const Mc = .9 * Fy * (.15 * .02 * .28 + .01 * .26 ** 2 / 4)
    const result = check({ N: axialRatio * Pc, M: .6 * Mc }, options, profile, declaration())
    expect(result.state('interaction').ratio).toBeCloseTo(axialRatio >= .2 ? axialRatio + 8 / 9 * .6 : axialRatio / 2 + .6, 10)
    expect(check({ N: axialRatio * Pc, M: .6 * Mc }, { ...options, lateralLength: undefined }, profile, declaration())
      .state('interaction').state).toBe('pending')
  })

  it('§8.1.2.1 y §6.1.2.2a: ASD en rectángulo macizo sobre eje débil', () => {
    const opts = { method: 'ASD' as const, flexureRestrained: true, connection: { kind: 'direct' as const, netArea: .075 } }
    const Pa = .6 * Fy * .08, Ma = .75 * Fy * (.4 * .2 ** 2 / 6)
    const result = check({ N: .4 * Pa, M: .3 * Ma }, opts, rect, declaration('asd-combination'), 'y')
    expect(result.state('flexure-yield').capacity).toBeCloseTo(Ma, 7)
    expect(result.state('interaction').ratio).toBeCloseTo(.7, 12)
  })

  it('§8.1.1.2: flexocompresión requiere momentos revisados conforme a §3.1', () => {
    const end = { length: 2, k: 1, ends: 'Articulada' }
    const options = { x: end, y: end, flexureRestrained: true }
    const demand = { N: -5e5, M: 30000 }
    expect(check(demand, options, rect, declaration(), 'y').state('interaction').ratio).toBeUndefined()
    const confirmed = check(demand, options, rect, declaration('lrfd-combination', rev, true), 'y')
    const r = .2 / Math.sqrt(12)
    const Pc = .85 * .08 * .658 ** ((2 / (Math.PI * r)) ** 2 * Fy / E) * Fy
    const Mc = .9 * Fy * .4 * .2 ** 2 / 4
    expect(confirmed.state('interaction').ratio).toBeCloseTo(5e5 / (2 * Pc) + 30000 / Mc, 12)
  })
})
