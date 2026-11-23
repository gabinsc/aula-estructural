import { useState } from 'react'
import type { Selection } from '../../domain/structure'
import type { SectionCut } from '../../modeler/results/diagramFields'
import { ResultTable, resultNumber } from './ResultTable'
import { ElementDetails, EntityLink, EquivalentDetails, GeometryDetails, MatrixTermDetails, RecoveryDetails, SupportsDetails } from './TraceDetails'
import { LESSON, stiffnessUnit } from './stiffnessTrace'
import type { Success } from './stiffnessTrace'
interface Matrix {
  readonly name: string
  readonly data: ArrayLike<number>
  readonly rows: readonly string[]
  readonly columns: readonly string[]
}

const BATCH = 6
const VECTOR_COLUMN = ['Valor']

function MatrixBlock({ matrix: { name, data, rows, columns }, inspect }: {
  matrix: Matrix; inspect: (row: number, column: number) => void
}) {
  const [row, setRow] = useState(0)
  const [column, setColumn] = useState(0)
  const [notice, setNotice] = useState('')
  const rowLabels = rows.slice(row, row + BATCH)
  const colLabels = columns.slice(column, column + BATCH)
  const vectors = rowLabels.map((_, i) => colLabels.map((__, j) => data[(row + i) * columns.length + column + j]!))

  async function copy() {
    const tsv = [['', ...colLabels].join('\t'), ...vectors.map((vector, i) =>
      [rowLabels[i], ...vector].join('\t'))].join('\n')
    try {
      await navigator.clipboard.writeText(tsv)
      setNotice('Bloque copiado.')
    } catch {
      setNotice('El navegador no permitió copiar. Puedes seleccionar los valores de la tabla.')
    }
  }

  if (!rows.length || !columns.length) return <p className="result-hint">{name} no tiene grados libres en este componente.</p>
  return <div className="matrix-block">
    <div className="matrix-navigation">
      <span>{rows.length} × {columns.length}</span>
      {rows.length > BATCH && <label className="result-field">Comienzo de filas
        <select value={row} onChange={event => setRow(Number(event.target.value))}>
          {rows.filter((_, i) => i % BATCH === 0).map((label, page) => <option key={label} value={page * BATCH}>{label}</option>)}
        </select>
      </label>}
      {columns.length > BATCH && <label className="result-field">Comienzo de columnas
        <select value={column} onChange={event => setColumn(Number(event.target.value))}>
          {columns.filter((_, i) => i % BATCH === 0).map((label, page) => <option key={label} value={page * BATCH}>{label}</option>)}
        </select>
      </label>}
    </div>
    <ResultTable label={name} headings={['Grado', ...colLabels]} rows={vectors.map((vector, i) => ({
      id: rowLabels[i]!, cells: [rowLabels[i], ...vector.map((value, j) => <button key={j} className="lesson-cell" type="button"
        aria-label={`${name}, ${rowLabels[i]}, ${colLabels[j]}`} onClick={() => inspect(row + i, column + j)}>{resultNumber(value)}</button>)],
    }))} />
    <button type="button" className="button secondary" onClick={() => void copy()}>Copiar bloque</button>
    <span className="result-hint" role="status">{notice}</span>
  </div>
}

const ALIASES = [
  { id: 'element', parent: 'K', title: 'Aporte al ensamblaje' },
  { id: 'F', parent: 'K', title: 'Vector global F' },
  { id: 'Fr', parent: 'Kr', title: 'Vector reducido Fr' },
] as const

export function TraceView({ result, barId, select, cut, showCut }: {
  result: Success; barId?: string; select: (item: Selection) => void; cut?: SectionCut; showCut: (cut: SectionCut) => void
}) {
  const [componentIndex, setComponentIndex] = useState(0)
  const [step, setStep] = useState('geometry')
  const [detail, setDetail] = useState(true)
  const [notice, setNotice] = useState('')
  const [entry, setEntry] = useState<{ row: number; column: number }>()
  const trace = result.trace
  if (!trace) return null
  const stepId = ALIASES.find(item => item.id === step)?.parent ?? step
  const stepIndex = LESSON.findIndex(item => item.id === stepId)
  const lesson = LESSON[stepIndex]!
  const component = trace.components[componentIndex] ?? trace.components[0]
  const element = trace.elements.find(item => item.barId === barId) ?? trace.elements[0]
  const dofs = result.dofs.map(item => `${item.nodeId}.${item.axis}`)
  const global = element?.dofIndices.map((index, slot) => index === -1 ?
    `θ${slot === 2 ? 'i' : 'j'} condensado` : dofs[index]!) ?? []
  const local = element?.localK?.length === 4 ? ['ui', 'uj'] : ['ui', 'vi', 'θi', 'uj', 'vj', 'θj']
  const active = component?.dofIndices.map(index => dofs[index]!) ?? []
  const free = component?.reducedDofs.map(item => `${item.nodeId}.${item.axis}`) ?? []
  const matrices: Record<string, Matrix | undefined> = {
    local: element?.localK && { name: 'Rigidez local k', data: element.localK, rows: local, columns: local },
    transform: element?.T && { name: 'Transformación T', data: element.T, rows: local, columns: global },
    element: element && { name: 'Aporte al ensamblaje', data: element.K, rows: global, columns: global },
    loads: element?.equivalentLocal && { name: 'Carga equivalente local', data: element.equivalentLocal, rows: local, columns: VECTOR_COLUMN },
    K: { name: 'Matriz global K', data: trace.K, rows: dofs, columns: dofs },
    F: { name: 'Vector global F', data: trace.F, rows: dofs, columns: VECTOR_COLUMN },
    Q: component && { name: 'Restricciones Q', data: component.Q, rows: active, columns: free },
    Kr: component && { name: 'Matriz reducida Kr', data: component.Kr, rows: free, columns: free },
    Fr: component && { name: 'Vector reducido Fr', data: component.Fr, rows: free, columns: VECTOR_COLUMN },
    z: component && { name: 'Solución reducida z', data: component.z, rows: free, columns: VECTOR_COLUMN },
    reactions: { name: 'Vector global R', data: trace.R, rows: dofs, columns: VECTOR_COLUMN },
  }
  const matrix = matrices[step]
  const usesElement = ['local', 'transform', 'element', 'loads', 'recovery', 'properties', 'axes'].includes(step)

  function change(next: string) {
    setStep(next)
    setEntry(undefined)
    setNotice('')
  }
  async function copyEquation() {
    try { await navigator.clipboard.writeText(lesson.equation); setNotice('Ecuación copiada.') }
    catch { setNotice('Selecciona el texto de la ecuación para copiarlo.') }
  }
  function inspect(row: number, column: number) {
    setEntry({ row, column })
    if (usesElement && element) select({ kind: 'bar', id: element.barId })
    else {
      const index = step === 'Q' ? component?.dofIndices[row] : row
      const nodeId = ['Kr', 'Fr', 'z'].includes(step) ? component?.reducedDofs[row]?.nodeId
        : index !== undefined ? result.dofs[index]?.nodeId : undefined
      if (nodeId) select({ kind: 'node', id: nodeId })
    }
  }
  function entryUnit(row: number, column: number) {
    const reducedAxis = (index: number) => component?.reducedDofs[index]?.axis === 'rz' ? 'rz' : 'axial'
    const localAxis = (index: number) => local[index]?.startsWith('θ') ? 'rz' : 'axial'
    if (step === 'local') return stiffnessUnit(localAxis(row), localAxis(column))
    if (step === 'element' && element) return stiffnessUnit(result.dofs[element.dofIndices[row] as number]?.axis ?? 'rz',
      result.dofs[element.dofIndices[column] as number]?.axis ?? 'rz')
    if (step === 'Kr') return stiffnessUnit(reducedAxis(row), reducedAxis(column))
    if (step === 'loads') return localAxis(row) === 'rz' ? 'N·m' : 'N'
    if (step === 'Fr') return reducedAxis(row) === 'rz' ? 'N·m' : 'N'
    if (step === 'z') return reducedAxis(row) === 'rz' ? 'rad' : 'm'
    if (step === 'reactions') return result.dofs[row]?.axis === 'rz' ? 'N·m' : 'N'
    return 'adimensional'
  }
  return <section id="desarrollo-rigideces" className="result-section" aria-label="Detalle matemático">
    <div className="lesson-heading"><h3>Método matricial de rigideces</h3><span>Paso {stepIndex + 1} de {LESSON.length}</span></div>
    <div className="result-controls">
      <label className="result-field">Paso de cálculo
        <select value={step} onChange={event => change(event.target.value)}>
          {LESSON.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          <optgroup label="Vistas de matriz">{ALIASES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>
        </select>
      </label>
      {component && ['Q', 'Kr', 'Fr', 'z'].includes(step) && <label className="result-field">Componente conectado
        <select value={componentIndex} onChange={event => { setComponentIndex(Number(event.target.value)); setEntry(undefined) }}>
          {trace.components.map((item, i) => <option key={i} value={i}>{item.nodeIds[0]} · {item.nodeIds.length} nudos</option>)}
        </select>
      </label>}
      {usesElement && element && <label className="result-field">Barra del desarrollo
        <select value={element.barId} onChange={event => { setEntry(undefined); select({ kind: 'bar', id: event.target.value }) }}>
          {trace.elements.map(item => <option key={item.barId}>{item.barId}</option>)}
        </select>
      </label>}
    </div>
    <div className="lesson-actions">
      <button type="button" className="button secondary" disabled={stepIndex === 0} onClick={() => change(LESSON[stepIndex - 1]!.id)}>Anterior</button>
      <button type="button" className="button secondary" disabled={stepIndex === LESSON.length - 1} onClick={() => change(LESSON[stepIndex + 1]!.id)}>Siguiente</button>
      <button type="button" className="button secondary" aria-expanded={detail} onClick={() => setDetail(!detail)}>{detail ? 'Ocultar detalle' : 'Mostrar detalle'}</button>
    </div>
    <p className="result-hint">{lesson.why}</p>
    {detail && <>
      <code className="lesson-formula">{lesson.equation}</code>
      <button type="button" className="button secondary" onClick={() => void copyEquation()}>Copiar ecuación</button>
      {notice && <span role="status" className="result-hint">{notice}</span>}
      {step === 'geometry' && <GeometryDetails trace={trace} select={select} />}
      {step === 'dofs' && <details className="result-detail">
        <summary>Mostrar {dofs.length} grados activos en orden</summary>
        <ol className="dof-list" start={0}>{result.dofs.map((dof, i) => <li key={dofs[i]}>
          <button className="result-link" type="button" onClick={() => select({ kind: 'node', id: dof.nodeId })}>{dofs[i]}</button>
        </li>)}</ol>
      </details>}
      {(step === 'supports' || step === 'Q') && <SupportsDetails trace={trace} select={select} />}
      {element && ['axes', 'properties', 'local', 'transform'].includes(step) &&
        <ElementDetails element={element} local={local} full={step === 'local' || step === 'transform'} />}
      {element?.dofIndices.includes(-1) && ['local', 'element', 'loads', 'recovery'].includes(step) &&
        <p className="result-hint">Condensación de giros liberados. K* = Kaa − Kar·Krr⁻¹·Kra y f* = fa − Kar·Krr⁻¹·fr.
          Las posiciones condensadas se muestran en cero. El giro de extremo se recupera resolviendo Krr·θr = fr − Kra·ua.</p>}
      {matrix && <MatrixBlock key={`${step}:${usesElement ? element?.barId : ''}:${componentIndex}`} matrix={matrix} inspect={inspect} />}
      {step === 'loads' && element && <EquivalentDetails element={element} result={result} select={select} />}
      {entry && (step === 'K' || step === 'F') && <MatrixTermDetails result={result} trace={trace} force={step === 'F'}
        row={entry.row} column={entry.column} select={select} />}
      {entry && matrix && step !== 'K' && step !== 'F' && <p className="lesson-term">
        {matrix.rows[entry.row]} · {matrix.columns[entry.column]} = {resultNumber(matrix.data[entry.row * matrix.columns.length + entry.column])}
        {' '}{entryUnit(entry.row, entry.column)}. El signo corresponde a los ejes del bloque mostrado.
      </p>}
      {step === 'z' && component && <MatrixBlock key={`u:${componentIndex}`} matrix={{ name: 'Desplazamientos recuperados u',
        data: component.dofIndices.map(index => trace.u[index]!), rows: active, columns: VECTOR_COLUMN }}
      inspect={row => select({ kind: 'node', id: result.dofs[component.dofIndices[row]!]!.nodeId })} />}
      {step === 'recovery' && element && <RecoveryDetails result={result} element={element} cut={cut} showCut={showCut} select={select} />}
      {step === 'balance' && <ResultTable label="Verificación de equilibrio" headings={['Origen', 'ΣFx (N)', 'ΣFy (N)', 'ΣMz (N·m)', 'Error hacia atrás']}
        rows={result.checks.map(check => ({ id: check.momentOriginNodeId, cells: [
          <EntityLink id={check.momentOriginNodeId} kind="node" select={select} />, resultNumber(check.forceResidual.x),
          resultNumber(check.forceResidual.y), resultNumber(check.momentResidual), resultNumber(check.backwardError),
        ] }))} />}
    </>}
  </section>
}
