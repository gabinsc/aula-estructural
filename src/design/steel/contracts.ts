import type { DesignCase } from '../contracts'

export type SteelMethod = 'LRFD' | 'ASD'
export type SteelGrade = 'ASTM A36' | 'ASTM A572 Grado 50'
export type DemandKind = 'unclassified' | 'characteristic' | 'service' | 'lrfd-combination' | 'asd-combination'

export interface SteelAxisRestraint {
  readonly length: number
  readonly k: number
  readonly ends: string
}

export interface SteelConnection {
  readonly kind: 'direct' | 'partial-bolted'
  readonly netArea: number
  readonly eccentricity?: number
  readonly length?: number
}

export interface SteelMemberSettings {
  readonly barId: string
  readonly method: SteelMethod
  readonly memberRevision?: string
  readonly grade?: SteelGrade
  readonly connection?: SteelConnection
  readonly x?: SteelAxisRestraint
  readonly y?: SteelAxisRestraint
  readonly weldedI?: boolean
  readonly lateralLength?: number
  readonly flexureRestrained?: boolean
  readonly unreinforcedWeb?: boolean
}

export interface SteelDemandDeclaration {
  readonly analysisRevision: string
  readonly caseId: string
  readonly kind: DemandKind
  readonly combination: string
  readonly secondOrder: boolean
}

export type SteelState = 'pass' | 'fail' | 'pending' | 'outside' | 'stale'
export type SteelUnit = 'N' | 'N·m'

export interface SteelLimitState {
  readonly id: string
  readonly title: string
  readonly source: string
  readonly state: SteelState
  readonly applicable: boolean
  readonly nominal?: number
  readonly factor?: number
  readonly capacity?: number
  readonly demand?: number
  readonly ratio?: number
  readonly unit?: SteelUnit
  readonly equation?: string
  readonly substitution?: string
  readonly diagnostic?: string
}

export interface SteelDesignResult {
  readonly designCase: DesignCase
  readonly grade?: SteelGrade
  readonly method: SteelMethod
  readonly states: readonly SteelLimitState[]
  readonly governing?: SteelLimitState
  readonly partial: boolean
  readonly flexureAxis?: 'x' | 'y'
  readonly effectiveArea?: number
}
