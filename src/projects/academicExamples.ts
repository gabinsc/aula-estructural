import type { StructuralLoad } from '../domain/load'
import type { Structure } from '../domain/structure'
import { makeProject } from './document'

type Quantity = 'ux' | 'uy' | 'rotation' | 'rx' | 'ry' | 'moment' | 'N' | 'V' | 'M' | 'v'

export interface AcademicReference {
  readonly label: string
  readonly quantity: Quantity
  readonly id: string
  readonly si: number
  readonly station?: { readonly s: number; readonly side: 'left' | 'right' }
}

export interface AcademicExample {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly task: string
  readonly derivation: string
  readonly model: Structure
  readonly references: readonly AcademicReference[]
}

const E = 200e9
const pin = { kind: 'pinned', nodeId: 'N1' } as const
const roller = { kind: 'roller', nodeId: 'N2', surfaceAngle: 0 } as const
const fixed = { kind: 'fixed', nodeId: 'N1' } as const
const line = [[1, 2]] as const

function force(id: string, nodeId: string, x: number, y: number): StructuralLoad {
  return { id, nodeId, kind: 'nodal', force: { x, y }, moment: 0 }
}

function structure(points: readonly (readonly [number, number])[], members: readonly (readonly [number, number])[],
  supports: Structure['supports'], loads: Structure['loads'], I?: number): Structure {
  const nodes = points.map(([x, y], index) => ({ id: `N${index + 1}`, label: `N${index + 1}`, x, y }))
  const bars = members.map(([start, end], index) => ({
    id: `B${index + 1}`, label: `B${index + 1}`, startId: `N${start}`, endId: `N${end}`,
  }))
  return { nodes, bars, supports, loads, nextNode: nodes.length + 1, nextBar: bars.length + 1, nextLoad: loads.length + 1,
    mechanics: { version: 1, assignments: bars.map(({ id: barId }) =>
      I === undefined ? { barId, kind: 'truss2d', E, A: .001 } : { barId, kind: 'frame2d', E, A: .02, I }) } }
}

function reference(label: string, quantity: Quantity, id: string, si: number,
  s?: number, side: 'left' | 'right' = 'right'): AcademicReference {
  return { label, quantity, id, si, ...(s === undefined ? {} : { station: { s, side } }) }
}

const q = { x: 0, y: -5000 }

export const ACADEMIC_EXAMPLES: readonly AcademicExample[] = [
  {
    id: 'axial', title: 'Barra axial',
    description: 'Dos barras independientes de 2 m, con la misma rigidez y fuerzas horizontales opuestas de 10 kN.',
    task: 'Compara el alargamiento de B1 con el acortamiento de B2. Selecciona N en AVM.',
    derivation: 'Equilibrio axial y u = PL/(EA), con el signo de la fuerza aplicada.',
    model: structure([[0, 0], [2, 0], [0, 2], [2, 2]], [[1, 2], [3, 4]],
      [pin, roller, { ...pin, nodeId: 'N3' }, { ...roller, nodeId: 'N4' }],
      [force('C1', 'N2', 10_000, 0), force('C2', 'N4', -10_000, 0)]),
    references: [reference('ux de N2', 'ux', 'N2', .0001), reference('ux de N4', 'ux', 'N4', -.0001),
      reference('N en B1', 'N', 'B1', 10_000), reference('N en B2', 'N', 'B2', -10_000)],
  }, {
    id: 'triangular', title: 'Armadura triangular',
    description: 'Base de 4 m, altura de 3 m y fuerza vertical de 12 kN en N3. N1 está articulado y N2 tiene rodillo.',
    task: 'Comprueba la simetría de las reacciones e identifica las barras comprimidas.',
    derivation: 'Equilibrio por método de nudos y desplazamiento por carga unitaria.',
    model: structure([[0, 0], [4, 0], [2, 3]], [[1, 2], [1, 3], [2, 3]], [pin, roller], [force('C1', 'N3', 0, -12_000)]),
    references: [reference('Ry de N1', 'ry', 'N1', 6000), reference('Ry de N2', 'ry', 'N2', 6000),
      reference('N en B1', 'N', 'B1', 4000), reference('N en B2', 'N', 'B2', -2000 * Math.sqrt(13)),
      reference('N en B3', 'N', 'B3', -2000 * Math.sqrt(13)), reference('uy de N3', 'uy', 'N3', -.000182907221937)],
  }, {
    id: 'puntual', title: 'Viga simplemente apoyada',
    description: 'Vano de 6 m con una carga puntual descendente de 12 kN en el centro.',
    task: 'Consulta B1 en s = 3 m. Compara el cortante antes y después de la carga y observa la continuidad del momento.',
    derivation: 'Equilibrio e integración de M/EI por tramos. Flecha central de magnitud PL³/(48EI).',
    model: structure([[0, 0], [6, 0]], line, [pin, roller],
      [{ id: 'C1', kind: 'point', barId: 'B1', s: 3, frame: 'global', force: { x: 0, y: -12_000 } }], 8e-6),
    references: [reference('Ry de N1', 'ry', 'N1', 6000), reference('Ry de N2', 'ry', 'N2', 6000),
      reference('V en 3⁻ m', 'V', 'B1', 6000, 3, 'left'), reference('V en 3⁺ m', 'V', 'B1', -6000, 3),
      reference('M en 3 m', 'M', 'B1', 18_000, 3), reference('v en 3 m', 'v', 'B1', -.03375, 3)],
  }, {
    id: 'uniforme', title: 'Viga con carga distribuida',
    description: 'Vano de 4 m con una carga uniforme descendente de 5 kN/m en toda la barra.',
    task: 'En s = 2 m, relaciona V = 0 con el máximo de M y consulta la deformada.',
    derivation: 'Equilibrio, M máximo = qL²/8 y flecha central de magnitud 5qL⁴/(384EI).',
    model: structure([[0, 0], [4, 0]], line, [pin, roller],
      [{ id: 'C1', kind: 'distributed', barId: 'B1', frame: 'global', profile: 'uniform', s0: 0, s1: 4, q0: q, q1: q }], 8e-6),
    references: [reference('Ry de N1', 'ry', 'N1', 10_000), reference('Ry de N2', 'ry', 'N2', 10_000),
      reference('V en 2 m', 'V', 'B1', 0, 2), reference('M en 2 m', 'M', 'B1', 10_000, 2),
      reference('v en 2 m', 'v', 'B1', -.0104166666667, 2)],
  }, {
    id: 'voladizo', title: 'Voladizo',
    description: 'Barra de 3 m empotrada en N1, con una fuerza descendente de 8 kN en el extremo libre.',
    task: 'Compara el momento de reacción en N1 con el momento interno de B1 justo después del apoyo.',
    derivation: 'Equilibrio y magnitudes PL³/(3EI) y PL²/(2EI) para flecha y giro del extremo.',
    model: structure([[0, 0], [3, 0]], line, [fixed], [force('C1', 'N2', 0, -8000)], 1e-5),
    references: [reference('Ry de N1', 'ry', 'N1', 8000), reference('Mz de N1', 'moment', 'N1', 24_000),
      reference('uy de N2', 'uy', 'N2', -.036), reference('Giro de N2', 'rotation', 'N2', -.018),
      reference('M en 0⁺ m', 'M', 'B1', -24_000, 0)],
  }, {
    id: 'portico', title: 'Pórtico simple',
    description: 'Pórtico de 2 × 2 m con bases empotradas y fuerzas de 10 kN hacia la derecha en ambos nudos superiores.',
    task: 'Compara los desplazamientos laterales y los momentos en las bases. En AVM combinado, consulta cada barra por separado.',
    derivation: 'Ecuaciones de pendiente–deflexión con compatibilidad axial en las columnas.',
    model: structure([[0, 0], [0, 2], [2, 2], [2, 0]], [[1, 2], [2, 3], [4, 3]],
      [fixed, { ...fixed, nodeId: 'N4' }], [force('C1', 'N2', 10_000, 0), force('C2', 'N3', 10_000, 0)], 2e-5),
    references: [reference('ux de N2', 'ux', 'N2', .00238462270435), reference('ux de N3', 'ux', 'N3', .00238462270435),
      reference('Rx de N1', 'rx', 'N1', -10_000), reference('Rx de N4', 'rx', 'N4', -10_000),
      reference('Ry de N1', 'ry', 'N1', -8564.08792464), reference('Ry de N4', 'ry', 'N4', 8564.08792464),
      reference('Mz de N1', 'moment', 'N1', 11435.91207536), reference('Mz de N4', 'moment', 'N4', 11435.91207536)],
  },
]

export function copyAcademicExample(example: AcademicExample) {
  return makeProject(`${example.title} (copia)`, structuredClone(example.model))
}

export function displayAcademicReference({ quantity, si }: AcademicReference): string {
  const decimal = new Intl.NumberFormat('es', { maximumSignificantDigits: 6 })
  if (quantity === 'ux' || quantity === 'uy' || quantity === 'v') return `${decimal.format(si * 1000)} mm`
  if (quantity === 'rotation') return `${decimal.format(si)} rad`
  return `${decimal.format(si / 1000)} ${quantity === 'M' || quantity === 'moment' ? 'kN·m' : 'kN'}`
}
