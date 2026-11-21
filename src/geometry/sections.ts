import type { Point } from './coordinates'

export const SECTION_FIELDS = {
  rectangle: ['b', 'h'], circle: ['d'], roundTube: ['d', 't'], boxTube: ['b', 'h', 't'],
  I: ['b', 'h', 'tw', 'tf'], T: ['b', 'h', 'tw', 'tf'], L: ['b', 'h', 't'], C: ['b', 'h', 'tw', 'tf'],
} as const
export type ParametricSection = keyof typeof SECTION_FIELDS
export type SectionProperties = { readonly A: number; readonly cx: number; readonly cy: number;
  readonly Ixx: number; readonly Iyy: number; readonly Ixy: number }
export type Primitive = (Point & { readonly hole?: boolean }) & (
  | { readonly kind: 'rect'; readonly b: number; readonly h: number }
  | { readonly kind: 'disk'; readonly r: number })
export type SectionGeometry =
  | { readonly kind: ParametricSection; readonly dimensions: Readonly<Record<string, number>> }
  | { readonly kind: 'compound'; readonly parts: readonly Primitive[] }
  | { readonly kind: 'manual'; readonly values: SectionProperties }
export type SectionCalculation = { readonly parts: readonly Primitive[]; readonly values: SectionProperties }

export const LENGTH_MM = 1e-3
const LIMIT = 1e6
const MIN_LENGTH = 1e-9
const lengthOK = (v: number) => Number.isFinite(v) && v >= MIN_LENGTH && v <= LIMIT
const positionOK = (v: number) => Number.isFinite(v) && Math.abs(v) <= LIMIT
const rect = (x: number, y: number, b: number, h: number, hole?: boolean): Primitive => ({ kind: 'rect', x, y, b, h, hole })
const disk = (x: number, y: number, r: number, hole?: boolean): Primitive => ({ kind: 'disk', x, y, r, hole })

function parametrized(geometry: Extract<SectionGeometry, { dimensions: unknown }>): readonly Primitive[] {
  const p = geometry.dimensions
  if (!SECTION_FIELDS[geometry.kind].every(key => lengthOK(p[key]!))) throw new Error('Introduce dimensiones positivas y representables.')
  const b = p.b!, h = p.h!, d = p.d!, t = p.t!, tw = p.tw!, tf = p.tf!
  switch (geometry.kind) {
    case 'rectangle': return [rect(0, 0, b, h)]
    case 'circle': return [disk(d / 2, d / 2, d / 2)]
    case 'roundTube':
      if (2 * t >= d) throw new Error('El espesor debe ser menor que el radio exterior.')
      return [disk(d / 2, d / 2, d / 2), disk(d / 2, d / 2, d / 2 - t, true)]
    case 'boxTube':
      if (2 * t >= Math.min(b, h)) throw new Error('El espesor debe dejar un vacío interior.')
      return [rect(0, 0, b, h), rect(t, t, b - 2 * t, h - 2 * t, true)]
    case 'L':
      if (t >= Math.min(b, h)) throw new Error('El espesor debe ser menor que ambos lados del perfil L.')
      return [rect(0, 0, b, t), rect(0, t, t, h - t)]
    case 'T':
      if (tf >= h || tw >= b) throw new Error('El alma y el ala deben quedar dentro de las dimensiones exteriores.')
      return [rect((b - tw) / 2, 0, tw, h - tf), rect(0, h - tf, b, tf)]
    case 'I':
    case 'C':
      if (2 * tf >= h || tw >= b) throw new Error('El perfil debe dejar altura y ancho para el alma y sus alas.')
      return [rect(0, 0, b, tf), rect(geometry.kind === 'I' ? (b - tw) / 2 : 0, tf, tw, (h - tf) - tf),
        rect(0, h - tf, b, tf)]
  }
}

function center(p: Primitive): Point {
  return p.kind === 'disk' ? p : { x: p.x + p.b / 2, y: p.y + p.h / 2 }
}

export function sectionBounds(p: Primitive) {
  return p.kind === 'disk' ? { left: p.x - p.r, right: p.x + p.r, bottom: p.y - p.r, top: p.y + p.r }
    : { left: p.x, right: p.x + p.b, bottom: p.y, top: p.y + p.h }
}

function overlaps(a: Primitive, b: Primitive): boolean {
  if (a.kind === 'disk' && b.kind === 'disk') {
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    return a.r + b.r - distance > 8 * Number.EPSILON * Math.max(a.r + b.r, distance)
  }
  if (a.kind === 'rect' && b.kind === 'rect') {
    const p = sectionBounds(a), q = sectionBounds(b)
    const width = Math.min(p.right, q.right) - Math.max(p.left, q.left)
    const height = Math.min(p.top, q.top) - Math.max(p.bottom, q.bottom)
    return width > 4 * Number.EPSILON * Math.max(Math.abs(p.right), Math.abs(q.right), Math.abs(p.left), Math.abs(q.left)) &&
      height > 4 * Number.EPSILON * Math.max(Math.abs(p.top), Math.abs(q.top), Math.abs(p.bottom), Math.abs(q.bottom))
  }
  if (a.kind === 'rect') return overlaps(b, a)
  const q = sectionBounds(b)
  const distance = Math.hypot(a.x - Math.max(q.left, Math.min(a.x, q.right)),
    a.y - Math.max(q.bottom, Math.min(a.y, q.top)))
  return a.r - distance > 8 * Number.EPSILON * Math.max(a.r, distance)
}

function contains(solid: Primitive, hole: Primitive): boolean {
  const q = sectionBounds(hole)
  if (solid.kind === 'rect') {
    const p = sectionBounds(solid)
    return p.left < q.left && q.right < p.right && p.bottom < q.bottom && q.top < p.top
  }
  if (hole.kind === 'disk') return Math.hypot(hole.x - solid.x, hole.y - solid.y) + hole.r < solid.r
  return [q.left, q.right].every(x => [q.bottom, q.top].every(y => Math.hypot(x - solid.x, y - solid.y) < solid.r))
}

function compoundIssue(parts: readonly Primitive[]) {
  if (!parts.some(part => !part.hole) || parts.length > 100) throw new Error('Incluye entre 1 y 100 regiones y al menos un sólido.')
  for (const [i, part] of parts.entries()) {
    if (!positionOK(part.x) || !positionOK(part.y) ||
      (part.kind === 'rect' ? !lengthOK(part.b) || !lengthOK(part.h) : !lengthOK(part.r))) {
      throw new Error(`Dimensiones o posición inválidas en la región ${i + 1}.`)
    }
    const bounds = sectionBounds(part)
    if (bounds.right - bounds.left <= 16 * Number.EPSILON * Math.max(Math.abs(bounds.right), Math.abs(bounds.left)) ||
      bounds.top - bounds.bottom <= 16 * Number.EPSILON * Math.max(Math.abs(bounds.top), Math.abs(bounds.bottom))) {
      throw new Error(`La región ${i + 1} es demasiado pequeña para su posición.`)
    }
    if (part.hole && !parts.some(other => !other.hole && contains(other, part))) {
      throw new Error(`El vacío ${i + 1} debe quedar estrictamente dentro de un sólido.`)
    }
    if (parts.slice(0, i).some(other => !!other.hole === !!part.hole && overlaps(part, other))) {
      throw new Error(`La región ${i + 1} se superpone con otra del mismo tipo.`)
    }
  }
}

function validate(values: SectionProperties) {
  const { A, Ixx, Iyy, Ixy } = values
  if (!Object.values(values).every(Number.isFinite) || !(A > 0 && Ixx > 0 && Iyy > 0) ||
    Math.abs(Ixy) / Math.sqrt(Ixx) >= Math.sqrt(Iyy)) throw new Error('Área o inercias degeneradas o fuera del rango numérico.')
}

/** Inercias centroidales. Ixy sigue la convención positiva ∫(x−cx)(y−cy)dA. */
export function calculateSection(geometry: SectionGeometry): SectionCalculation {
  if (geometry.kind === 'manual') {
    validate(geometry.values)
    return { parts: [], values: geometry.values }
  }
  const parts = geometry.kind === 'compound' ? geometry.parts : parametrized(geometry)
  if (geometry.kind === 'compound') compoundIssue(parts)
  const origin = center(parts[0]!)
  const terms = parts.map(part => {
    const at = center(part)
    const sign = part.hole ? -1 : 1
    const A = sign * (part.kind === 'disk' ? Math.PI * part.r ** 2 : part.b * part.h)
    const Ixx = part.kind === 'disk' ? A * part.r ** 2 / 4 : A * part.h ** 2 / 12
    const Iyy = part.kind === 'disk' ? Ixx : A * part.b ** 2 / 12
    return { A, Ixx, Iyy, x: at.x - origin.x, y: at.y - origin.y }
  })
  const sum = (pick: (part: typeof terms[number]) => number) => terms.reduce((total, part) => total + pick(part), 0)
  const A = sum(p => p.A)
  const x = sum(p => p.A * p.x) / A
  const y = sum(p => p.A * p.y) / A
  const values = { A, cx: origin.x + x, cy: origin.y + y, Ixx: sum(p => p.Ixx + p.A * (p.y - y) ** 2),
    Iyy: sum(p => p.Iyy + p.A * (p.x - x) ** 2), Ixy: sum(p => p.A * (p.x - x) * (p.y - y)) }
  validate(values)
  return { parts, values }
}
