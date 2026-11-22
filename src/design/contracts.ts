import type { FrameSection } from '../analysis'
import type { SectionAxis } from '../domain/library'
import type { SectionProperties } from '../geometry/sections'
import type { SteelMemberSettings } from './steel/contracts'

export const PA_PER_MPA = 1e6

export interface DesignMaterialProperties {
  readonly materialId: string
  readonly origin: 'illustrative' | 'declared' | 'normative-verified'
  readonly source: string
  readonly fy?: number
  readonly fu?: number
  readonly fc?: number
}

export interface DesignCriterion {
  readonly id: string
  readonly name: string
  readonly tension?: number
  readonly compression?: number
  readonly service?: { readonly reference: 'local-absolute' | 'relative-chord'; readonly limit: number }
}

export interface DesignSettings {
  readonly materials: readonly DesignMaterialProperties[]
  readonly criterion?: DesignCriterion
  readonly steel?: readonly SteelMemberSettings[]
}

export interface DesignCase {
  readonly projectId: string
  readonly loadCaseId: string
  readonly physicalRevision: string
  readonly analysisRevision: string
  readonly barId: string
  readonly s: number
  readonly side: FrameSection['side']
}

export interface DesignSectionProperties extends SectionProperties {
  readonly sectionId: string
  readonly axis: SectionAxis
  readonly I: number
  readonly positive: { readonly c: number; readonly S: number }
  readonly negative: { readonly c: number; readonly S: number }
}

export interface DesignDiagnostic {
  readonly code: 'STALE_ANALYSIS' | 'INVALID_STATION' | 'SECTION_GEOMETRY' | 'SECTION_AXIS' | 'OUT_OF_RANGE' | 'SERVICE_UNAVAILABLE'
  readonly message: string
}

export interface DesignStress {
  readonly s: number
  readonly side: FrameSection['side']
  readonly fiber: 'axial' | 'positive' | 'negative'
  readonly axial: number
  readonly bending: number
  readonly stress: number
}

export interface DesignCheck {
  readonly kind: 'tension' | 'compression' | 'service'
  readonly status: 'within-limit' | 'exceeds-limit'
  readonly value: number
  readonly limit: number
  readonly unit: 'Pa' | 'm'
  readonly s: number
  readonly side: FrameSection['side']
  readonly fiber?: DesignStress['fiber']
}

export interface DesignResult {
  readonly designCase: DesignCase
  readonly engineVersion?: string
  readonly materialId?: string
  readonly material?: DesignMaterialProperties
  readonly sectionId?: string
  readonly section?: DesignSectionProperties
  readonly criterion?: DesignCriterion
  readonly area?: number
  readonly actions?: { readonly N: number; readonly V?: number; readonly M?: number }
  readonly stresses: readonly DesignStress[]
  readonly checks: readonly DesignCheck[]
  readonly extremes?: { readonly min: DesignStress; readonly max: DesignStress; readonly stations: number }
  readonly service?: { readonly local: number; readonly relative: number }
  readonly diagnostics: readonly DesignDiagnostic[]
}
