import type { ReactNode } from 'react'
import type { AnalysisDiagnostic, AnalysisResult } from '../../analysis'
import type { StructuralLoad } from '../../domain/load'
import type { Selection, Structure } from '../../domain/structure'
import { Icon } from '../Icon'
import { AcademicHelp } from '../academic/AcademicHelp'
import { MemberResults } from './MemberResults'
import { ResultTable, resultNumber } from './ResultTable'
import { TraceView } from './TraceView'
import { ANALYSIS_STATUS } from './useAnalysis'
import type { AnalysisState } from './useAnalysis'
import type { SectionCut } from '../../modeler/results/diagramFields'
import type { DiagramModel } from '../../modeler/results/diagramModel'
import { CombinedDiagrams } from './CombinedDiagrams'
import { MethodResults } from './MethodResults'
import { InfluenceResults } from './InfluenceResults'
import type { MovingPosition } from './InfluenceResults'

type Success = Extract<AnalysisResult, { ok: true }>

function Diagnostics({ diagnostics, select }: {
  diagnostics: readonly AnalysisDiagnostic[]
  select: (target: Selection) => void
}) {
  if (!diagnostics.length) return null
  return <ul className="analysis-diagnostics" aria-label="Diagnósticos de análisis">
    {diagnostics.map((item, index) => <li key={index} data-severity={item.severity}>
      <span>{item.message}</span>
      <div className="diagnostic-references">
        {item.barIds?.map(id => <ResultLink key={id} onClick={() => select({ kind: 'bar', id })}>{id}</ResultLink>)}
        {item.nodeIds?.map(id => <ResultLink key={id} onClick={() => select({ kind: 'node', id })}>{id}</ResultLink>)}
        {item.loadIds?.map(id => <ResultLink key={id} onClick={() => select({ kind: 'load', id })}>{id}</ResultLink>)}
        {item.direction && <small>{item.direction.nodeId} · {item.direction.axis}</small>}
      </div>
    </li>)}
  </ul>
}

function ResultLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="result-link" onClick={onClick}>{children}</button>
}

function CaseControls({ loads, selected, setSelected }: {
  loads: readonly StructuralLoad[]
  selected: readonly string[] | null
  setSelected: (ids: readonly string[] | null) => void
}) {
  const enabled = selected ?? loads.map(load => load.id)
  return <details className="result-detail">
    <summary>Caso activo · {selected === null ? 'Todas las cargas' : `${enabled.length} cargas seleccionadas`}</summary>
    <label className="case-load"><input type="checkbox" checked={selected === null}
      onChange={event => setSelected(event.target.checked ? null : enabled)} />Incluir automáticamente todas las cargas</label>
    {selected !== null && <fieldset className="case-loads">
      <legend>Cargas del caso</legend>
      {!loads.length && <p className="result-hint">El proyecto todavía no tiene cargas.</p>}
      {loads.map(load => <label className="case-load" key={load.id}>
        <input type="checkbox" checked={enabled.includes(load.id)} onChange={event =>
          setSelected(event.target.checked ? [...enabled, load.id] : enabled.filter(id => id !== load.id))} />
        {load.id} · {load.kind === 'nodal' ? load.nodeId : load.barId}
      </label>)}
    </fieldset>}
  </details>
}

function AnalysisSummary({ result }: { result: Success }) {
  const frames = result.bars.filter(bar => bar.kind === 'frame2d').length
  const type = frames === result.bars.length ? 'Pórtico 2D' : frames ? 'Armadura y pórtico 2D' : 'Armadura 2D'
  const free = result.trace?.components.reduce((count, component) => count + component.reducedDofs.length, 0)
  const condition = result.checks.flatMap(check => check.scaledRcondEstimate === null ? [] : [check.scaledRcondEstimate])
  const warned = result.diagnostics.some(item => item.severity === 'warning')
  const facts = [['Nudos', result.displacements.length], ['Barras', result.bars.length],
    ['Grados activos / libres', `${result.dofs.length} / ${free ?? '—'}`],
    ['Condición recíproca mínima', condition.length ? resultNumber(Math.min(...condition)) : 'Sin grados libres']] as const
  return <section className="result-section">
    <div className="result-summary-heading"><h3>{type}</h3><span>{warned ? 'Con advertencias' : 'Equilibrio verificado'}</span></div>
    <dl className="result-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <details className="result-detail">
      <summary>Controles de equilibrio</summary>
      <ResultTable label="Balance por componente" headings={['Origen', 'ΣFx (N)', 'ΣFy (N)', 'ΣMz (N·m)', 'Libre (N)', 'Libre (N·m)']}
        rows={result.checks.map(check => ({ id: check.momentOriginNodeId, cells: [check.momentOriginNodeId,
          check.forceResidual.x, check.forceResidual.y, check.momentResidual, check.freeResidual, check.freeMomentResidual]
          .map(value => typeof value === 'number' ? resultNumber(value) : value) }))} />
    </details>
  </section>
}

export function ResultsPanel({ state, missing, loads, selected, setSelected, learning, selection, select, close, cut, onCut,
  combined, labels, expanded, toggleExpanded, onShowCut, model, methodControls, influenceMode, mobilePosition, onMobile }: {
  state: AnalysisState
  missing: readonly AnalysisDiagnostic[]
  model: Structure
  methodControls: ReactNode
  influenceMode: boolean
  mobilePosition: MovingPosition
  onMobile: (position: MovingPosition) => void
  loads: readonly StructuralLoad[]
  selected: readonly string[] | null
  setSelected: (ids: readonly string[] | null) => void
  learning: boolean
  selection: readonly Selection[]
  select: (target: Selection) => void
  close: () => void
  cut?: SectionCut
  onCut: (cut: SectionCut) => void
  combined?: DiagramModel
  labels: boolean
  expanded: boolean
  toggleExpanded: () => void
  onShowCut: (cut: SectionCut) => void
}) {
  const result = state.status === 'current' ? state.result : undefined
  const diagnostics = state.status === 'failed' || state.status === 'incomplete' ? state.diagnostics
    : result?.diagnostics ?? missing
  const bar = selection.find(item => item.kind === 'bar')?.id
  return <aside id="analysis-results" className="results-panel" aria-label="Resultados del análisis">
    <header className="results-heading">
      <div><h2>Resultados</h2><p role="status" aria-label="Estado de análisis" data-analysis-status={state.status}>{ANALYSIS_STATUS[state.status]}</p></div>
      <div className="result-heading-controls">
        {learning && result?.trace && <button type="button" className="button secondary" onClick={() =>
          document.getElementById('desarrollo-rigideces')?.scrollIntoView({ block: 'start' })}>Desarrollo</button>}
        <button className="icon-button" aria-label={expanded ? 'Restaurar ancho del panel' : 'Ampliar panel de resultados'}
          title={expanded ? 'Restaurar ancho del panel' : 'Ampliar panel de resultados'} aria-pressed={expanded}
          type="button" onClick={toggleExpanded}><Icon name="fit" size={18} /></button>
        <button className="icon-button" aria-label="Volver al Inspector" title="Volver al Inspector" type="button" onClick={close}><Icon name="close" size={18} /></button>
      </div>
    </header>
    <div className="results-body">
      {methodControls}
      {learning && <AcademicHelp title="Cómo interpretar los resultados">
        <p>ux y uy son desplazamientos en los ejes globales. θz es el giro en radianes y es positivo en sentido antihorario.</p>
        <p>En la convención local de la barra, N positivo indica tracción. V positivo actúa hacia −y′ sobre la cara de corte del tramo inicial y M positivo es antihorario en esa misma cara. Un salto de V puede corresponder a una fuerza puntual o a una reacción.</p>
        <p>Revisa el equilibrio de fuerzas y momentos y contrasta los valores con una referencia independiente. Un mecanismo permite movimiento sin rigidez suficiente. Revisa apoyos, conectividad y el tipo resistente de las barras.</p>
      </AcademicHelp>}
      {!influenceMode && <CaseControls loads={loads} selected={selected} setSelected={setSelected} />}
      {state.status === 'stale' && <p className="result-hint">Cambió el modelo físico, el caso activo o la configuración del método. Ejecuta Analizar estructura para actualizar los valores.</p>}
      {state.status === 'idle' && <p className="result-hint">{influenceMode
        ? 'Ejecuta Analizar estructura para calcular la respuesta al paso de la carga móvil.'
        : 'Ejecuta Analizar estructura para obtener desplazamientos, reacciones y esfuerzos.'}</p>}
      <Diagnostics diagnostics={diagnostics} select={select} />
      {result && state.status === 'current' && state.detail?.kind === 'influence' &&
        <InfluenceResults key={result.revision} detail={state.detail} learning={learning} select={select} position={mobilePosition} onPosition={onMobile} />}
      {result && !influenceMode && <>
        {state.status === 'current' && state.detail && state.detail.kind !== 'influence' && <MethodResults key={result.revision} detail={state.detail} model={model}
          activeIds={result.loads.map(load => load.id)} learning={learning} select={select} selectedBar={bar} />}
        {combined && <CombinedDiagrams diagram={combined} selectedId={bar} cut={cut} onCut={onCut} labels={labels} learning={learning} />}
        <AnalysisSummary result={result} />
        <section className="result-section">
          <h3>Desplazamientos globales</h3>
          <ResultTable label="Desplazamientos nodales" headings={['Nudo', 'ux (mm)', 'uy (mm)', 'θz (rad)']}
            rows={result.displacements.map(item => ({ id: item.nodeId, cells: [
              <ResultLink onClick={() => select({ kind: 'node', id: item.nodeId })}>{item.nodeId}</ResultLink>,
              resultNumber(item.x, 1000), resultNumber(item.y, 1000), resultNumber(item.rotation),
            ] }))} />
        </section>
        <section className="result-section">
          <h3>Reacciones globales</h3>
          <ResultTable label="Reacciones de apoyo" headings={['Nudo', 'Rx (kN)', 'Ry (kN)', 'Mz (kN·m)']}
            rows={result.reactions.map(item => ({ id: item.nodeId, cells: [
              <ResultLink onClick={() => select({ kind: 'node', id: item.nodeId })}>{item.nodeId}</ResultLink>,
              resultNumber(item.x, .001), resultNumber(item.y, .001), resultNumber(item.moment, .001),
            ] }))} />
        </section>
        <MemberResults bars={result.bars} selectedId={bar} select={id => select({ kind: 'bar', id })} cut={cut} onCut={onCut} />
        {learning && <TraceView result={result} barId={bar} select={select} cut={cut} showCut={onShowCut} />}
      </>}
    </div>
  </aside>
}
