import type { Structure, StructuralNode } from '../domain/structure'
import type { NodalSupport } from '../domain/support'
import type { Point } from '../geometry/coordinates'

export interface TrussAssignment {
  readonly barId: string
  readonly kind: 'truss2d'
  /** Pa */
  readonly E: number
  /** m² */
  readonly A: number
}

export interface FrameAssignment extends Omit<TrussAssignment, 'kind'> {
  readonly kind: 'frame2d'
  /** m⁴, segundo momento de área respecto a Z local. */
  readonly I: number
}

export type ElementAssignment = TrussAssignment | FrameAssignment

export interface AnalysisDefinition {
  readonly version: 1
  readonly assignments: readonly ElementAssignment[]
}

export interface AnalysisCase {
  readonly id: string
  /** Si se omite, el caso incluye todas las cargas del documento. */
  readonly loadIds?: readonly string[]
}

export interface AnalysisInput {
  readonly model: Structure
  readonly definition: AnalysisDefinition
  readonly loadCase: AnalysisCase
  readonly revision?: string
  readonly includeTrace?: boolean
}

export interface DofReference {
  readonly index: number
  readonly nodeId: string
  readonly axis: 'ux' | 'uy' | 'rz'
}

type TrussDof = DofReference & { readonly axis: 'ux' | 'uy' }

interface BarGeometry {
  readonly startId: string
  readonly endId: string
  readonly length: number
  readonly unit: Point
  readonly axialStiffness: number
}

export type NodeDofs = readonly [number, number] | readonly [number, number, number]
export type FrameVector = readonly [number, number, number, number, number, number]
export type PreparedTruss = BarGeometry & TrussAssignment & { readonly dofIndices: readonly [number, number, number, number] }
export type PreparedFrame = BarGeometry & FrameAssignment & { readonly dofIndices: FrameVector; readonly EI: number }
export type PreparedBar = PreparedTruss | PreparedFrame

export interface PreparedNodalLoad {
  readonly kind: 'nodal'
  readonly id: string
  readonly nodeId: string
  readonly force: Point
  readonly moment: number
  /** Presente si la acción proviene del extremo de una barra. */
  readonly barId?: string
}

export type FrameInteriorLoad =
  | { readonly kind: 'point'; readonly id: string; readonly barId: string; readonly s: number; readonly force: Point }
  | { readonly kind: 'distributed'; readonly id: string; readonly barId: string; readonly s0: number; readonly s1: number;
      readonly q0: Point; readonly q1: Point }

/** Las fuerzas de barra están en ejes locales, salvo un extremo convertido a acción nodal. */
export type PreparedLoad = PreparedNodalLoad | FrameInteriorLoad
export interface PreparedComponent {
  readonly nodeIds: readonly string[]
  readonly barIds: readonly string[]
}

export interface PreparedModel {
  readonly nodes: readonly StructuralNode[]
  readonly bars: readonly PreparedBar[]
  readonly loads: readonly PreparedLoad[]
  readonly supports: ReadonlyMap<string, NodalSupport>
  readonly components: readonly PreparedComponent[]
  readonly dofs: readonly DofReference[]
  readonly dofByNode: ReadonlyMap<string, NodeDofs>
}

export type PreparedTrussModel = Omit<PreparedModel, 'bars' | 'loads' | 'dofs' | 'dofByNode'> & {
  readonly bars: readonly PreparedTruss[]
  readonly loads: readonly PreparedNodalLoad[]
  readonly dofs: readonly TrussDof[]
  readonly dofByNode: ReadonlyMap<string, readonly [number, number]>
}

export interface ReducedDof {
  readonly nodeId: string
  readonly axis: 'ux' | 'uy' | 'tangent' | 'rz'
  readonly direction: Point
}

export interface AnalysisDiagnostic {
  readonly code: 'INVALID_MODEL' | 'INVALID_ASSIGNMENT' | 'INVALID_CASE' | 'UNSUPPORTED_LOAD' | 'INACTIVE_ROTATION'
    | 'INACTIVE_FIXED_ROTATION' | 'ISOLATED_NODE' | 'MODEL_TOO_LARGE' | 'UNSTABLE_OR_SINGULAR'
    | 'ILL_CONDITIONED' | 'NUMERICAL_FAILURE' | 'EQUILIBRIUM_FAILURE'
  readonly severity: 'error' | 'warning' | 'info'
  readonly message: string
  readonly nodeIds?: readonly string[]
  readonly barIds?: readonly string[]
  readonly loadIds?: readonly string[]
  readonly supportNodeId?: string
  /** Coordenada que reveló el problema, no una forma modal. */
  readonly direction?: ReducedDof
}

export interface ComponentChecks {
  readonly nodeIds: readonly string[]
  readonly forceResidual: Point
  readonly momentOriginNodeId: string
  readonly momentResidual: number
  readonly freeResidual: number
  readonly freeMomentResidual: number
  readonly rollerTangentialResidual: number
  readonly compatibilityResidual: number
  readonly rotationCompatibilityResidual: number
  readonly backwardError: number
  readonly scaledRcondEstimate: number | null
}

export interface ComponentTrace {
  readonly nodeIds: readonly string[]
  readonly dofIndices: readonly number[]
  readonly reducedDofs: readonly ReducedDof[]
  /** Q y Kr se conservan por filas, con unidades globales antes del escalado. */
  readonly Q: Float64Array
  readonly Kr: Float64Array
  readonly Fr: Float64Array
  readonly scaling: Float64Array
  readonly z: Float64Array
}

export interface EquivalentLoadTrace {
  readonly loadId: string
  readonly local: FrameVector
  readonly global: FrameVector
}

export interface ElementTrace {
  readonly barId: string
  readonly startId: string
  readonly endId: string
  readonly kind: ElementAssignment['kind']
  readonly E: number
  readonly A: number
  readonly I?: number
  readonly length: number
  readonly unit: Point
  readonly axialStiffness: number
  readonly EI?: number
  readonly dofIndices: PreparedBar['dofIndices']
  readonly K: Float64Array
  readonly localK: Float64Array
  readonly T: Float64Array
  readonly equivalentLocal?: FrameVector
  readonly equivalentGlobal?: FrameVector
  readonly equivalentLoads: readonly EquivalentLoadTrace[]
}

export interface SupportTrace {
  readonly support: NodalSupport
  readonly normal?: Point
  readonly tangent?: Point
}

interface Provenance {
  readonly engineVersion: string
  readonly caseId: string
  readonly revision?: string
}

export interface FrameSection {
  readonly s: number
  readonly side: 'left' | 'right'
  readonly N: number
  readonly V: number
  readonly M: number
  readonly u: number
  readonly v: number
  readonly rotation: number
}

export interface FrameResult {
  readonly kind: 'frame2d'
  readonly barId: string
  readonly length: number
  readonly EA: number
  readonly EI: number
  readonly elongation: number
  /** N(0⁺), en N. Consultar sections o evaluateFrameSection para otras estaciones. */
  readonly axialForce: number
  readonly localDisplacements: FrameVector
  readonly endForces: FrameVector
  readonly equivalentLocal: FrameVector
  readonly loads: readonly FrameInteriorLoad[]
  readonly sections: readonly FrameSection[]
}

type TrussResult = { readonly kind?: 'truss2d'; readonly barId: string; readonly axialForce: number; readonly elongation: number }
export type BarResult = FrameResult | TrussResult

type AnalysisFailure = Provenance & { readonly ok: false; readonly diagnostics: readonly AnalysisDiagnostic[] }
interface AnalysisSuccess extends Provenance {
  readonly ok: true
  readonly diagnostics: readonly AnalysisDiagnostic[]
  readonly dofs: readonly DofReference[]
  readonly loads: readonly PreparedLoad[]
  /** Traslaciones en m y giro en rad. */
  readonly displacements: readonly (Point & { readonly nodeId: string; readonly rotation?: number })[]
  /** Fuerzas en N y momento en N·m. */
  readonly reactions: readonly (Point & { readonly nodeId: string; readonly moment?: number })[]
  /** Fuerza en N (tracción positiva) y variación de longitud en m. */
  readonly bars: readonly BarResult[]
  readonly checks: readonly ComponentChecks[]
  readonly trace?: {
    readonly K: Float64Array
    readonly F: Float64Array
    readonly u: Float64Array
    readonly R: Float64Array
    /** Geometría en ejes globales referida al primer nudo para conservar la invariancia por traslación. */
    readonly nodes: readonly StructuralNode[]
    readonly elements: readonly ElementTrace[]
    readonly supports: readonly SupportTrace[]
    readonly components: readonly ComponentTrace[]
  }
}

export type AnalysisResult = AnalysisFailure | AnalysisSuccess
export type TrussAnalysisResult = AnalysisFailure | (AnalysisSuccess & {
  readonly dofs: readonly TrussDof[]
  readonly loads: readonly PreparedNodalLoad[]
  readonly bars: readonly TrussResult[]
})
