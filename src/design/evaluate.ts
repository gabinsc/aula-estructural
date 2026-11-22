import { evaluateFrameSection } from '../analysis'
import type { AnalysisResult, FrameResult, FrameSection } from '../analysis'
import { stationary } from '../analysis/influenceCurve'
import { compensatedSum } from '../analysis/summation'
import { catalogOf } from '../domain/library'
import type { Section, SectionAxis } from '../domain/library'
import type { Structure } from '../domain/structure'
import { calculateSection, sectionBounds } from '../geometry/sections'
import type { DesignCase, DesignCheck, DesignDiagnostic, DesignResult, DesignSectionProperties, DesignSettings, DesignStress } from './contracts'

type CurrentAnalysis = Extract<AnalysisResult, { ok: true }>

/** La fibra positiva sigue +y de la sección para eje x, y +x para eje y. */
export function sectionFibers(section: Section, axis: SectionAxis): DesignSectionProperties {
  const { values } = section
  const { parts } = calculateSection(section.geometry)
  const outlines = parts.filter(part => !part.hole).map(sectionBounds)
  if (!outlines.length) throw new RangeError('El contorno es necesario para obtener las fibras y los módulos resistentes.')
  if (Math.abs(values.Ixy) > 64 * Number.EPSILON * Math.sqrt(values.Ixx) * Math.sqrt(values.Iyy)) {
    throw new RangeError('El eje elegido no es principal. La flexión acoplada queda fuera de esta consulta.')
  }
  const alongY = axis === 'x'
  const center = alongY ? values.cy : values.cx
  const I = alongY ? values.Ixx : values.Iyy
  const cPlus = Math.max(...outlines.map(part => alongY ? part.top : part.right)) - center
  const cMinus = center - Math.min(...outlines.map(part => alongY ? part.bottom : part.left))
  const SPlus = I / cPlus, SMinus = I / cMinus
  if (![SPlus, SMinus, cPlus, cMinus].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Las fibras o sus módulos resistentes superan el rango numérico.')
  }
  return { ...values, sectionId: section.id, axis, I,
    positive: { c: cPlus, S: SPlus }, negative: { c: cMinus, S: SMinus } }
}

function stressAt(actions: { N: number; M?: number }, A: number, s: number, side: FrameSection['side'],
  fiber: DesignStress['fiber'], section?: DesignSectionProperties): DesignStress {
  const axial = actions.N / A
  const bending = !section || fiber === 'axial' ? 0 : (fiber === 'positive' ? -1 : 1) * actions.M! / section[fiber].S
  const stress = axial + bending
  if (![axial, bending, stress].every(Number.isFinite)) throw new RangeError('La tensión no es representable en Float64.')
  return { axial, bending, stress, s, side, fiber }
}

/** Cada tramo posee qx y qy lineales. El derivado de la tensión es −qx/A−y·V/I. */
function fiberExtremes(bar: FrameResult, A: number, section?: DesignSectionProperties) {
  const points = [...new Set([0, ...bar.sections.map(item => item.s), bar.length])].sort((a, b) => a - b)
  const candidates: DesignStress[] = []
  const fibers = section ? ['positive', 'negative'] as const : ['axial'] as const
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!, to = points[i]!, span = to - from
    const start = evaluateFrameSection(bar, from, 'right')
    const end = evaluateFrameSection(bar, to, 'left')
    const loads = bar.loads.filter(load => load.kind === 'distributed' && load.s0 <= from && to <= load.s1)
    function intensity(s: number, axis: 'x' | 'y') {
      return compensatedSum(loads.map(load => {
        if (load.kind !== 'distributed') return 0
        const t = (s - load.s0) / (load.s1 - load.s0)
        return (1 - t) * load.q0[axis] + t * load.q1[axis]
      }))
    }
    const qx0 = intensity(from, 'x'), qx1 = intensity(to, 'x')
    const qy0 = intensity(from, 'y'), qy1 = intensity(to, 'y')
    for (const fiber of fibers) {
      const yOverI = !section || fiber === 'axial' ? 0 : (fiber === 'positive' ? 1 : -1) / section[fiber].S
      const d0 = -qx0 / A - yOverI * start.V
      const d1 = -(qx1 - qx0) / A - yOverI * (span * qy0)
      const d2 = -yOverI * (span * ((qy1 - qy0) / 2))
      if (![d0, d1, d2].every(Number.isFinite)) throw new RangeError('La búsqueda de extremos supera el rango numérico.')
      const scale = Math.max(Math.abs(d0), Math.abs(d1), Math.abs(d2)) || 1
      candidates.push(stressAt(start, A, from, 'right', fiber, section), stressAt(end, A, to, 'left', fiber, section))
      for (const t of stationary([0, d0 / scale, (d1 / scale) / 2, (d2 / scale) / 3])) {
        const s = from + span * t
        if (from < s && s < to) candidates.push(stressAt(evaluateFrameSection(bar, s), A, s, 'right', fiber, section))
      }
    }
  }
  const min = candidates.reduce((a, b) => b.stress < a.stress ? b : a)
  const max = candidates.reduce((a, b) => b.stress > a.stress ? b : a)
  return { min, max, stations: new Set(candidates.map(item => `${item.s}:${item.side}`)).size }
}

export function evaluateDesign(model: Structure, settings: DesignSettings, designCase: DesignCase,
  analysis?: CurrentAnalysis): DesignResult {
  const diagnostics: DesignDiagnostic[] = []
  const checks: DesignCheck[] = []
  const assignment = model.mechanics.assignments.find(item => item.barId === designCase.barId)
  const { A: area, materialId, sectionId, sectionAxis } = assignment ?? {}
  const material = settings.materials.find(entry => entry.materialId === materialId)
  const criterion = settings.criterion
  const result = { designCase, diagnostics, stresses: [], checks, materialId, material, sectionId, criterion, area }
  if (!analysis || analysis.revision !== designCase.analysisRevision || analysis.caseId !== designCase.loadCaseId) {
    diagnostics.push({ code: 'STALE_ANALYSIS', message: 'Ejecuta un análisis estructural vigente para este caso antes de consultar el diseño.' })
    return result
  }
  const bar = analysis.bars.find(item => item.barId === designCase.barId)
  const member = model.bars.find(item => item.id === designCase.barId)
  const start = member && model.nodes.find(node => node.id === member.startId)
  const end = member && model.nodes.find(node => node.id === member.endId)
  const length = bar?.kind === 'frame2d' ? bar.length : start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0
  const { s } = designCase
  if (!bar || !area || !Number.isFinite(s) || s < 0 || s > length) {
    diagnostics.push({ code: 'INVALID_STATION', message: 'Selecciona una barra con área asignada e indica una estación entre 0 y L.' })
    return result
  }
  const side = s === 0 ? 'right' : s === length ? 'left' : designCase.side
  let section: DesignSectionProperties | undefined
  const linked = catalogOf(model).sections.find(item => item.id === sectionId)
  if (bar.kind === 'frame2d') {
    if (!linked || linked.geometry.kind === 'manual') diagnostics.push({ code: 'SECTION_GEOMETRY',
      message: 'La flexión requiere una sección asignada con contorno. A e I permiten calcular solo el aporte axial en esta consulta.' })
    else {
      try {
        if (!sectionAxis) throw new RangeError('Selecciona el eje centroidal de la sección en la asignación de la barra.')
        section = sectionFibers(linked, sectionAxis)
        if (section.I !== assignment?.I || section.A !== area) throw new RangeError('La geometría no coincide con A e I del análisis.')
      } catch (error) {
        section = undefined
        diagnostics.push({ code: 'SECTION_AXIS', message: error instanceof Error ? error.message : 'Eje o fibras no disponibles.' })
      }
    }
  }
  function check(kind: DesignCheck['kind'], value: number, limit: number, station: number, atSide: FrameSection['side'],
    fiber?: DesignStress['fiber']) {
    checks.push({ kind, value, limit, status: value <= limit ? 'within-limit' : 'exceeds-limit',
      unit: kind === 'service' ? 'm' : 'Pa', s: station, side: atSide, fiber })
  }
  const provenance = { ...result, engineVersion: analysis.engineVersion, designCase: { ...designCase, side }, section }
  try {
    const field = bar.kind === 'frame2d' ? evaluateFrameSection(bar, s, side) : undefined
    const actions = field ? { N: field.N, V: field.V, M: field.M } : { N: bar.axialForce }
    const stresses = section ? (['positive', 'negative'] as const).map(fiber => stressAt(actions, area, s, side, fiber, section))
      : [stressAt(actions, area, s, side, 'axial')]
    const extremes = bar.kind === 'frame2d' ? fiberExtremes(bar, area, section) : { min: stresses[0]!, max: stresses[0]!, stations: 1 }
    if (bar.kind !== 'frame2d' || section) {
      if (criterion?.tension !== undefined) check('tension', Math.max(0, extremes.max.stress), criterion.tension,
        extremes.max.s, extremes.max.side, extremes.max.fiber)
      if (criterion?.compression !== undefined) check('compression', Math.max(0, -extremes.min.stress), criterion.compression,
        extremes.min.s, extremes.min.side, extremes.min.fiber)
    }
    let service: DesignResult['service']
    if (field && bar.kind === 'frame2d') {
      const t = s / length
      const chord = (1 - t) * bar.localDisplacements[1] + t * bar.localDisplacements[4]
      service = { local: field.v, relative: field.v - chord }
      if (!Number.isFinite(service.relative)) throw new RangeError('La flecha relativa no es representable.')
      if (criterion?.service) check('service', Math.abs(criterion.service.reference === 'relative-chord' ? service.relative : service.local),
        criterion.service.limit, s, side)
    } else if (criterion?.service) diagnostics.push({ code: 'SERVICE_UNAVAILABLE', message: 'La consulta transversal requiere un campo de desplazamiento de pórtico.' })
    return { ...provenance, actions, stresses, extremes, service }
  } catch (error) {
    diagnostics.push({ code: 'OUT_OF_RANGE', message: error instanceof Error ? error.message : 'No se pudo evaluar la sección.' })
    return { ...provenance, checks: [] }
  }
}
