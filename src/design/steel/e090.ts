import type { SteelAxisRestraint, SteelConnection, SteelMethod } from './contracts'

export const E090 = {
  id: 'RNE-E.090-2006',
  name: 'RNE E.090 · Estructuras Metálicas',
  edition: 'D.S. 011-2006-VIVIENDA · texto oficial del MVCS',
  url: 'https://cdn.www.gob.pe/uploads/document/file/2686420/E.090%20Estructuras%20Met%C3%A1licas.pdf',
} as const

export const positive = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n) && n > 0

export function effectiveArea(area: number, connection: SteelConnection) {
  if (!positive(connection.netArea) || connection.netArea > area) throw new RangeError('El área neta debe ser positiva y no exceder Ag.')
  if (connection.kind === 'direct') return { Ae: connection.netArea, U: 1, source: '§2.3.1' }
  const { eccentricity: e, length } = connection
  if (e === undefined || !Number.isFinite(e) || e < 0 || !positive(length) || e >= length) {
    throw new RangeError('Indica la excentricidad y longitud de la conexión parcial empernada.')
  }
  const U = Math.min(.9, 1 - e / length)
  return { Ae: U * connection.netArea, U, source: '§2.3.2(a), ecs. 2.3-1 y 2.3-2' }
}

export function flexuralBuckling(E: number, Fy: number, Ag: number, I: number, restraint: SteelAxisRestraint, method: SteelMethod) {
  const r = Math.sqrt(I / Ag)
  const slenderness = restraint.k * restraint.length / r
  if (!positive(r) || !positive(slenderness)) throw new RangeError('El radio de giro o la esbeltez no son representables.')
  const parameter = slenderness / Math.PI * Math.sqrt(Fy / E)
  const critical = parameter <= 1.5 ? .658 ** (parameter ** 2) * Fy : .877 / (parameter ** 2) * Fy
  const detail = `r = ${r.toPrecision(5)} m, KL/r = ${slenderness.toPrecision(5)}, λc = ${parameter.toPrecision(5)}`
  if (method === 'LRFD') return { nominal: critical * Ag, factor: .85, capacity: .85 * critical * Ag, slenderness,
    source: `§5.2.1, ecs. 5.2-1, 5.2-${parameter <= 1.5 ? 2 : 3} y 5.2-4`,
    equation: parameter <= 1.5 ? 'Pn = Ag·Fy·0,658^(λc²)' : 'Pn = Ag·Fy·0,877/λc²', substitution: detail }
  const Cc = Math.PI * Math.sqrt(2 * (E / Fy)), t = slenderness / Cc
  const allowable = t <= 1
    ? (1 - t * t / 2) * Fy / (5 / 3 + 3 * t / 8 - t ** 3 / 8)
    : 12 / 23 * (Math.PI / slenderness) ** 2 * E
  return { capacity: allowable * Ag, slenderness, source: `§5.2.2, ec. 5.2-${t <= 1 ? 5 : 6}`,
    equation: t <= 1 ? 'Pa = Ag·Fy·[1−t²/2]/[5/3+3t/8−t³/8], t = (KL/r)/Cc' : 'Pa = Ag·12π²E/[23(KL/r)²]',
    substitution: `${detail}, Cc = ${Cc.toPrecision(5)}, Fa = ${(allowable / 1e6).toPrecision(5)} MPa` }
}

export function webShear(Fy: number, depth: number, clearDepth: number, tw: number, method: SteelMethod) {
  const slenderness = clearDepth / tw, root = Math.sqrt(Fy / 1e6), Aw = depth * tw
  const substitution = `Aw = ${Aw.toPrecision(5)} m², h/tw = ${slenderness.toPrecision(5)}`
  if (method === 'ASD') {
    if (slenderness > 1000 / root) return undefined
    return { capacity: .4 * Fy * Aw, factor: .4, equation: 'Va = Aw·0,40Fy', source: '§6.2.2.2, ec. 6.2-4', substitution }
  }
  if (slenderness > 260) return undefined
  const index = slenderness <= 1098 / root ? 1 : slenderness <= 1373 / root ? 2 : 3
  const nominal = index === 1 ? .6 * Fy * Aw : index === 2 ? .6 * Fy * Aw * (1098 / root / slenderness) : Aw * 910000e6 / slenderness ** 2
  const equation = ['Vn = 0,60Fy·Aw', 'Vn = 0,60Fy·Aw·1098/[√Fy(MPa)·h/tw]', 'Vn = Aw·910000 MPa/(h/tw)²'][index - 1]!
  return { nominal, factor: .9, capacity: .9 * nominal, equation, source: `§6.2.2.1, ec. 6.2-${index}`, substitution }
}
