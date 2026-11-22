import type { DesignCriterion, DesignMaterialProperties, DesignSettings } from './contracts'
import { readSteelMembers } from './steel/settings'

export const EMPTY_DESIGN: DesignSettings = { materials: [] }

function record(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${label}: se esperaba un objeto.`)
  return raw as Record<string, unknown>
}

function text(raw: unknown, max: number, label: string): string {
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > max) throw new Error(`${label}: texto inválido.`)
  return raw.trim()
}

function id(raw: unknown) {
  const value = text(raw, 80, 'Identificador')
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error('Identificador de diseño inválido.')
  return value
}

function magnitude(raw: unknown, name: string): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) throw new Error(`${name} debe ser finito y positivo.`)
  return raw
}

export function readDesignMaterial(raw: unknown): DesignMaterialProperties {
  const value = record(raw, 'Propiedades resistentes')
  const { origin } = value
  if (origin !== 'illustrative' && origin !== 'declared' && origin !== 'normative-verified') {
    throw new Error('Selecciona la procedencia de los datos resistentes.')
  }
  return { materialId: id(value.materialId), origin, source: text(value.source, 500, 'Fuente resistente'),
    ...(value.fy === undefined ? {} : { fy: magnitude(value.fy, 'fy') }),
    ...(value.fu === undefined ? {} : { fu: magnitude(value.fu, 'fu') }),
    ...(value.fc === undefined ? {} : { fc: magnitude(value.fc, 'Resistencia a compresión') }) }
}

export function readDesignCriterion(raw: unknown): DesignCriterion {
  const value = record(raw, 'Criterio de diseño')
  if (value.tension === undefined && value.compression === undefined && value.service === undefined) {
    throw new Error('Introduce al menos un límite para guardar el criterio.')
  }
  let service: DesignCriterion['service']
  if (value.service !== undefined) {
    const field = record(value.service, 'Criterio de desplazamiento')
    const { reference } = field
    if (reference !== 'relative-chord' && reference !== 'local-absolute') throw new Error('Elige la referencia del desplazamiento.')
    service = { reference, limit: magnitude(field.limit, 'Límite de desplazamiento') }
  }
  return { id: id(value.id), name: text(value.name, 80, 'Nombre del criterio'),
    ...(value.tension === undefined ? {} : { tension: magnitude(value.tension, 'Límite de tracción') }),
    ...(value.compression === undefined ? {} : { compression: magnitude(value.compression, 'Límite de compresión') }),
    ...(service && { service }) }
}

export function readDesignSettings(raw: unknown, includeSteel = true): DesignSettings {
  const value = record(raw, 'Configuración de diseño')
  if (!Array.isArray(value.materials)) throw new Error('Las propiedades resistentes deben estar en una lista.')
  const materials = value.materials.map(readDesignMaterial)
  if (new Set(materials.map(item => item.materialId)).size !== materials.length) throw new Error('Hay resistencias duplicadas para un material.')
  return { materials, ...(value.criterion === undefined ? {} : { criterion: readDesignCriterion(value.criterion) }),
    ...(includeSteel && value.steel !== undefined ? { steel: readSteelMembers(value.steel) } : {}) }
}
