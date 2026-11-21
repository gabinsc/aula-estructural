import type { AnalysisResult, DofReference } from '../../analysis'
import { compensatedSum } from '../../analysis/summation'

export type Success = Extract<AnalysisResult, { ok: true }>
export type Trace = NonNullable<Success['trace']>

export const LESSON = [
  { id: 'geometry', title: 'Nudos y elementos', equation: 'e = (i, j)', why: 'Los identificadores de los extremos determinan la conectividad y las posiciones globales fijan la geometría.' },
  { id: 'dofs', title: 'Orden de grados de libertad', equation: 'u = [ux, uy, θz, …]ᵀ', why: 'Todos los nudos activos disponen de traslaciones. Los que pertenecen a un pórtico también disponen de giro.' },
  { id: 'supports', title: 'Restricciones de apoyos', equation: 'n · u = 0 en un rodillo', why: 'El rodillo restringe la normal y conserva la tangente. La articulación restringe las traslaciones. Un empotramiento restringe todos los grados activos del nudo.' },
  { id: 'properties', title: 'Propiedades E, A e I', equation: 'Rigidez axial = EA/L · Rigidez flexional proporcional a EI', why: 'E representa el material y A e I representan la geometría resistente de la sección.' },
  { id: 'axes', title: 'Sistemas locales', equation: 'L = ‖Pj − Pi‖; c = ΔX/L; s = ΔY/L', why: 'El eje x local apunta del extremo inicial al final y el eje y local gira 90° en sentido antihorario.' },
  { id: 'local', title: 'Rigidez local k', equation: 'p = k d − fₑ', why: 'Cada coeficiente de k indica la fuerza o el momento conjugado que induce un desplazamiento local unitario.' },
  { id: 'transform', title: 'Transformación T', equation: 'd = T uₑ; Kₑ = Tᵀ k T; Fₑ = Tᵀ fₑ', why: 'La transformación lleva traslaciones globales a los ejes de la barra y conserva el trabajo virtual.' },
  { id: 'loads', title: 'Carga equivalente local', equation: 'fₑ = N(s)ᵀ P o ∫ N(s)ᵀ q(s) ds', why: 'El motor integra las distribuciones sobre el tramo cargado. Las fuerzas situadas exactamente en los extremos se incorporan a F como acciones nodales.' },
  { id: 'K', title: 'Matriz global K', equation: 'Kᵢⱼ = Σₑ (Kₑ)ᵢⱼ; F = Fnodal + Σₑ Fₑ', why: 'Los índices globales de cada elemento indican dónde sumar sus aportes de rigidez y carga.' },
  { id: 'Q', title: 'Restricciones Q', equation: 'u = Q z', why: 'Las columnas de Q describen desplazamientos permitidos. En un rodillo inclinado, la columna tangencial combina ux y uy.' },
  { id: 'Kr', title: 'Matriz reducida Kr', equation: 'Kr = Qᵀ K Q; Fr = Qᵀ F', why: 'La proyección expresa equilibrio en las direcciones permitidas por los apoyos.' },
  { id: 'z', title: 'Solución reducida z', equation: 'Kr z = Fr; u = Q z', why: 'El motor escala el sistema, factoriza con Cholesky y recupera las traslaciones y giros globales.' },
  { id: 'reactions', title: 'Reacciones', equation: 'R = K u − F', why: 'Las reacciones equilibran las acciones externas. Las componentes libres quedan dentro de la tolerancia de equilibrio.' },
  { id: 'recovery', title: 'Recuperación de esfuerzos', equation: 'p = k d − fₑ; N′ = −qx; V′ = qy; M′ = V', why: 'Las fuerzas de extremo son acciones sobre la barra. El momento interno procede del corte y su signo positivo es sagante.' },
  { id: 'balance', title: 'Comprobación de equilibrio', equation: 'ΣFx = 0; ΣFy = 0; ΣMz = 0', why: 'Se comprueban los residuos de cada componente y la compatibilidad de los desplazamientos con los apoyos.' },
] as const

export function stiffnessUnit(row: DofReference['axis'] | 'axial', column: DofReference['axis'] | 'axial') {
  const moment = row === 'rz'
  return column === 'rz' ? (moment ? 'N·m/rad' : 'N/rad') : (moment ? 'N·m/m' : 'N/m')
}

export function stiffnessTerms(trace: Trace, row: number, column: number) {
  const width = trace.u.length
  const terms = trace.elements.flatMap(element => {
    const localRow = element.dofIndices.indexOf(row)
    const localColumn = element.dofIndices.indexOf(column)
    if (localRow < 0 || localColumn < 0) return []
    const value = element.K[localRow * element.dofIndices.length + localColumn]!
    return value === 0 ? [] : [{ barId: element.barId, value, localRow, localColumn }]
  })
  const assembled = trace.K[row * width + column]!
  const sum = compensatedSum(terms.map(term => term.value))
  const tolerance = 1e-6 + 128 * Number.EPSILON * compensatedSum(terms.map(term => Math.abs(term.value)))
  return { terms, sum, assembled, agrees: Math.abs(sum - assembled) <= tolerance }
}

export function forceTerms(trace: Trace, result: Success, dof: DofReference) {
  const nodal = result.loads.flatMap(load => {
    if (load.kind !== 'nodal' || load.nodeId !== dof.nodeId) return []
    const value = dof.axis === 'rz' ? load.moment : dof.axis === 'ux' ? load.force.x : load.force.y
    return value === 0 ? [] : [{ id: load.id, value }]
  })
  const equivalent = trace.elements.flatMap(element => {
    const index = element.dofIndices.indexOf(dof.index)
    const value = element.equivalentGlobal?.[index]
    return value === undefined || value === 0 ? [] : [{ id: element.barId, value }]
  })
  return { nodal, equivalent, total: trace.F[dof.index]! }
}
