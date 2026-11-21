import { evaluateFrameSection } from '../../analysis'
import type { Selection } from '../../domain/structure'
import type { SectionCut } from '../../modeler/results/diagramFields'
import { ResultTable, resultNumber as number } from './ResultTable'
import { forceTerms, stiffnessTerms, stiffnessUnit } from './stiffnessTrace'
import type { Success, Trace } from './stiffnessTrace'

type Select = (item: Selection) => void
type Element = Trace['elements'][number]
const dofLabel = (dof: Success['dofs'][number]) => `${dof.nodeId}.${dof.axis}`

export function EntityLink({ id, kind, select }: { id: string; kind: Selection['kind']; select: Select }) {
  return <button type="button" className="result-link" onClick={() => select({ kind, id })}>{id}</button>
}

export function GeometryDetails({ trace, select }: { trace: Trace; select: Select }) {
  return <>
    <p className="result-hint">Coordenadas en ejes globales respecto de {trace.nodes[0]?.id}.</p>
    <ResultTable label="Nudos del análisis" headings={['Nudo', 'ΔX (m)', 'ΔY (m)']} rows={trace.nodes.map(node => ({
      id: node.id, cells: [<EntityLink id={node.id} kind="node" select={select} />, number(node.x), number(node.y)],
    }))} />
    <ResultTable label="Conectividad de elementos" headings={['Barra', 'Inicial', 'Final']} rows={trace.elements.map(element => ({
      id: element.barId, cells: [<EntityLink id={element.barId} kind="bar" select={select} />, element.startId, element.endId],
    }))} />
  </>
}

export function SupportsDetails({ trace, select }: { trace: Trace; select: Select }) {
  if (!trace.supports.length) return <p className="result-hint">Sin apoyos en el modelo analizado.</p>
  const pair = (point: { x: number; y: number } | undefined) => point ? `(${number(point.x)}, ${number(point.y)})` : '—'
  return <ResultTable label="Restricciones por apoyo" headings={['Nudo', 'Apoyo', 'Normal restringida', 'Tangente permitida']}
    rows={trace.supports.map(({ support, normal, tangent }) => ({
      id: support.nodeId, cells: [
        <EntityLink id={support.nodeId} kind="node" select={select} />,
        support.kind === 'roller' ? 'Rodillo' : support.kind === 'pinned' ? 'Articulado' : 'Empotrado', pair(normal), pair(tangent),
      ],
    }))} />
}

export function ElementDetails({ element, local, full }: { element: Element; local: readonly string[]; full: boolean }) {
  const formula = element.kind === 'truss2d' ? 'k = (EA/L) · [[1, −1], [−1, 1]]'
    : 'k: bloque axial EA/L; bloque flexional EI/L³ · [[12, 6L, −12, 6L], [6L, 4L², −6L, 2L²], [−12, −6L, 12, −6L], [6L, 2L², −6L, 4L²]]'
  return <div className="lesson-element">
    <p className="result-hint">{element.startId} → {element.endId} · L = {number(element.length)} m · c = {number(element.unit.x)} · s = {number(element.unit.y)}</p>
    <p className="result-hint">E = {number(element.E)} Pa · A = {number(element.A)} m²{element.I !== undefined && ` · I = ${number(element.I)} m⁴`}</p>
    {full && <>
      <p className="result-hint">Orden local [{local.join(', ')}].</p>
      <code className="lesson-formula">{formula}</code>
      <p className="result-hint">EA/L = ({number(element.E)} × {number(element.A)}) / {number(element.length)} = {number(element.axialStiffness)} N/m.
        {element.EI !== undefined && ` EI = (${number(element.E)} × ${number(element.I)}) = ${number(element.EI)} N·m².`}</p>
    </>}
  </div>
}

export function EquivalentDetails({ element, result, select }: { element: Element; result: Success; select: Select }) {
  if (!element.equivalentLoads.length) return <p className="result-hint">La barra seleccionada no tiene cargas interiores en este caso.</p>
  return <ResultTable label="Aportes de cargas de barra" headings={['Carga', 'Estaciones (m)', 'Vector local (N, N·m)', 'Vector global (N, N·m)']}
    rows={element.equivalentLoads.map(item => {
      const load = result.loads.find(load => load.id === item.loadId)
      const interval = load?.kind === 'point' ? number(load.s) : load?.kind === 'distributed' ? `${number(load.s0)} a ${number(load.s1)}` : '—'
      return { id: item.loadId, cells: [<EntityLink kind="load" id={item.loadId} select={select} />,
        interval, item.local.map(value => number(value)).join(', '), item.global.map(value => number(value)).join(', ')] }
    })} />
}

export function MatrixTermDetails({ result, trace, row, column, force, select }: {
  result: Success; trace: Trace; row: number; column: number; force: boolean; select: Select
}) {
  const dof = result.dofs[row]!
  if (force) {
    const terms = forceTerms(trace, result, dof)
    const unit = dof.axis === 'rz' ? 'N·m' : 'N'
    return <div className="lesson-term">
      <strong>F · {dofLabel(dof)} = {number(terms.total)} {unit}</strong>
      <ResultTable label="Aportes al vector global" headings={['Origen', 'Acción', unit]} rows={[
        ...terms.nodal.map(term => ({ id: term.id, cells: [<EntityLink id={term.id} kind="load" select={select} />, 'Nodal', number(term.value)] })),
        ...terms.equivalent.map(term => ({ id: term.id, cells: [<EntityLink id={term.id} kind="bar" select={select} />, 'Equivalente de barra', number(term.value)] })),
      ]} />
    </div>
  }
  const other = result.dofs[column]!
  const entry = stiffnessTerms(trace, row, column)
  const unit = stiffnessUnit(dof.axis, other.axis)
  return <div className="lesson-term" aria-label="Aportes a la entrada de K">
    <strong>K[{dofLabel(dof)}, {dofLabel(other)}] = {number(entry.assembled)} {unit}</strong>
    <p className="result-hint">Fila conjugada a la fuerza o momento. Columna del movimiento impuesto positivo.</p>
    {entry.terms.length ? <ResultTable label="Aportes elementales" headings={['Barra', 'Índices en Kₑ', unit]} rows={entry.terms.map(term => ({
      id: term.barId, cells: [<EntityLink id={term.barId} kind="bar" select={select} />, `${term.localRow + 1}, ${term.localColumn + 1}`, number(term.value)],
    }))} /> : <p className="result-hint">Sin aportes elementales distintos de cero.</p>}
    <p>{entry.agrees ? 'Suma verificada' : 'Diferencia fuera de tolerancia'} · {number(entry.sum)} {unit}</p>
  </div>
}

export function RecoveryDetails({ result, element, cut, showCut, select }: {
  result: Success; element: Element; cut?: SectionCut; showCut: (cut: SectionCut) => void; select: Select
}) {
  const bar = result.bars.find(item => item.barId === element.barId)
  if (!bar) return null
  const current = cut?.barId === bar.barId ? cut : { barId: bar.barId, s: 0, side: 'right' as const, source: 'table' as const }
  const section = bar.kind === 'frame2d' ? evaluateFrameSection(bar, current.s, current.side) : undefined
  return <>
    {bar.kind === 'frame2d' && <>
      <p className="result-hint">d local ({bar.localDisplacements.map(value => number(value)).join(', ')}) en m y rad.</p>
      <p className="result-hint">p de extremo ({bar.endForces.map(value => number(value)).join(', ')}) en N y N·m.
        El momento nodal aplicado es positivo antihorario. El momento interno de sección es positivo sagante.</p>
    </>}
    <p className="result-hint">Sección consultada {bar.barId} · s = {number(current.s)} m · N = {number(section?.N ?? bar.axialForce)} N
      {section && ` · V = ${number(section.V)} N · M = ${number(section.M)} N·m`}</p>
    {bar.kind === 'frame2d' && bar.loads.filter(load => load.kind === 'point'
      ? load.s < current.s || (load.s === current.s && current.side === 'right') : load.s0 < current.s).map(load =>
      <EntityLink key={load.id} id={load.id} kind="load" select={select} />)}
    <button className="button secondary" type="button" onClick={() => showCut(current)}>Ver sección en AVM</button>
  </>
}
