import { useMemo, useState } from 'react'
import type { AnalysisResult } from '../../analysis'
import { PA_PER_MPA } from '../../design/contracts'
import type { DesignSettings, DesignStress } from '../../design/contracts'
import { evaluateDesign } from '../../design/evaluate'
import { catalogOf } from '../../domain/library'
import type { Structure } from '../../domain/structure'
import { loadBarGeometry } from '../../domain/load'
import { parseNumber } from '../../modeler/format'
import type { SectionCut } from '../../modeler/results/diagramFields'
import { Icon } from '../Icon'
import { ResultTable, resultNumber } from '../results/ResultTable'
import { CriterionForm, MaterialForm, ORIGIN_LABELS } from './DesignSettingsForms'

type Solved = Extract<AnalysisResult, { ok: true }>
type PanelProps = {
  model: Structure
  selectedBar?: string
  projectId: string
  loadCaseId: string
  physicalRevision: string
  analysisRevision: string
  analysis?: Solved
  analysisStatus: string
  cut?: SectionCut
  settings: DesignSettings
  updateSettings: (settings: DesignSettings) => void
  selectBar: (barId: string) => void
  showCut: (cut: SectionCut) => void
  close: () => void
}
const mp = (value: number | undefined) => resultNumber(value, 1 / PA_PER_MPA)
const fiberName: Record<DesignStress['fiber'], string> = { axial: 'Aporte axial', positive: 'Fibra +y local', negative: 'Fibra −y local' }
const sideName = (side: SectionCut['side']) => side === 'left' ? 'Izquierda' : 'Derecha'

function MemberDesign({ model, selectedBar: barId, cut, analysis, projectId, loadCaseId, physicalRevision, analysisRevision,
  settings, updateSettings, showCut }: PanelProps & { readonly selectedBar: string }) {
  const L = loadBarGeometry(model, barId)?.length ?? 0
  const [station, setStation] = useState<string>()
  const [side, setSide] = useState<SectionCut['side']>()
  const stationText = station ?? String(cut?.s ?? L / 2)
  const s = parseNumber(stationText) ?? NaN
  const cutSide = side ?? cut?.side ?? 'right'
  const result = useMemo(() => evaluateDesign(model, settings, { projectId, loadCaseId, physicalRevision,
    analysisRevision, barId, s, side: cutSide }, analysis),
  [model, settings, projectId, loadCaseId, physicalRevision, analysisRevision, barId, s, cutSide, analysis])
  const catalog = catalogOf(model)
  const material = catalog.materials.find(item => item.id === result.materialId)
  const linked = catalog.sections.find(item => item.id === result.sectionId)
  const { section, actions, extremes, service, designCase } = result
  return <>
    <section className="result-section" aria-label="Datos de la barra">
      <h3>{barId} · L = {resultNumber(L)} m</h3>
      <dl className="result-facts">
        <div><dt>Material</dt><dd>{material ? `${material.name} (${material.id})` : 'Sin material de biblioteca'}</dd></div>
        <div><dt>Sección</dt><dd>{linked ? `${linked.name} (${linked.id})` : 'Sin sección de biblioteca'}</dd></div>
        <div><dt>Área (cm²)</dt><dd>{resultNumber(result.area, 1e4)}</dd></div>
      </dl>
      {result.material && <p className="result-hint">{ORIGIN_LABELS[result.material.origin]} · {result.material.source}
        {' '}· fy {mp(result.material.fy)} MPa · fu {mp(result.material.fu)} MPa · compresión {mp(result.material.fc)} MPa</p>}
      {material && <MaterialForm key={material.id} material={material} saved={result.material} update={item =>
        updateSettings({ ...settings, materials: [...settings.materials.filter(old => old.materialId !== item.materialId), item] })} />}
    </section>
    <section className="result-section" aria-label="Consulta de sección">
      <div className="result-controls">
        <label className="result-field">Estación de diseño (m)<input inputMode="decimal" value={stationText}
          onChange={event => setStation(event.target.value)} /></label>
        <label className="result-field">Lado de la sección<select value={cutSide}
          onChange={event => setSide(event.target.value === 'left' ? 'left' : 'right')}>
          <option value="right">Derecha s⁺</option><option value="left">Izquierda s⁻</option>
        </select></label>
        {cut && <button type="button" className="button secondary" onClick={() => {
          setStation(undefined)
          setSide(undefined)
        }}>Usar corte AVM</button>}
        {actions?.M !== undefined && <button type="button" className="button secondary" onClick={() =>
          showCut({ barId, s, side: designCase.side, source: 'table' })}>Ver sección en AVM</button>}
      </div>
      {result.diagnostics.length > 0 && <ul aria-label="Diagnósticos de diseño" className="result-diagnostics">
        {result.diagnostics.map(item => <li key={item.code}>{item.message}</li>)}
      </ul>}
      {actions && <>
        <h3>Acciones vigentes</h3>
        <p className="result-hint">Caso {loadCaseId} · motor {result.engineVersion} · s = {resultNumber(s)} m · lado {sideName(designCase.side).toLowerCase()}</p>
        <ResultTable label="Acciones de diseño" headings={['Barra', 'N (kN)', 'V (kN)', 'M (kN·m)']}
          rows={[{ id: barId, cells: [barId, resultNumber(actions.N, .001), resultNumber(actions.V, .001), resultNumber(actions.M, .001)] }]} />
        {section && <p className="result-hint">Eje centroidal {section.axis} · I = {resultNumber(section.I, 1e8)} cm⁴
          {' '}· c⁺ = {resultNumber(section.positive.c, 1e3)} mm · c⁻ = {resultNumber(section.negative.c, 1e3)} mm
          {' '}· S⁺ = {resultNumber(section.positive.S, 1e6)} cm³ · S⁻ = {resultNumber(section.negative.S, 1e6)} cm³</p>}
        <h3>Tensiones nominales</h3>
        <p className="result-hint">{section ? 'σ = N/A − M·y/I. Tracción positiva y compresión negativa.' : 'σN = N/A. Tracción positiva y compresión negativa.'}</p>
        <ResultTable label="Tensiones de la sección" headings={['Fibra', 'σN (MPa)', 'σM (MPa)', 'σ (MPa)']}
          rows={result.stresses.map(item => ({ id: item.fiber,
            cells: [fiberName[item.fiber], mp(item.axial), item.fiber === 'axial' ? '—' : mp(item.bending), mp(item.stress)] }))} />
        {extremes && <ResultTable label="Extremos de tensión en la barra" headings={['Extremo', 'Fibra', 's (m)', 'Lado', 'σ (MPa)']}
          rows={([['Mínimo', extremes.min], ['Máximo', extremes.max]] as const).map(([label, item]) => {
            return { id: label, cells: [label, fiberName[item.fiber],
              <button className="result-link" type="button" onClick={() => {
                setStation(String(item.s))
                setSide(item.side)
              }}>{resultNumber(item.s)}</button>, sideName(item.side), mp(item.stress)] }
          })} />}
        {service && <p className="result-hint">En esta estación · desplazamiento y local {resultNumber(service.local, 1e3)} mm
          {' '}· flecha relativa a la cuerda {resultNumber(service.relative, 1e3)} mm</p>}
      </>}
    </section>
    <section className="result-section" aria-label="Verificaciones de diseño">
      <h3>Verificaciones del criterio</h3>
      <p>{result.criterion ? result.criterion.name : 'Sin criterio de límites declarado.'}</p>
      {result.checks.length > 0 && <ResultTable label="Comparaciones con el criterio"
        headings={['Consulta', 'Demanda', 'Límite', 'Estado']}
        rows={result.checks.map(item => {
          const unit = item.unit === 'Pa' ? 'MPa' : 'mm'
          const scale = item.unit === 'Pa' ? 1 / PA_PER_MPA : 1e3
          const label = item.kind === 'tension' ? 'Tracción en la barra' : item.kind === 'compression' ? 'Compresión en la barra'
            : result.criterion?.service?.reference === 'relative-chord' ? 'Flecha relativa en la estación' : 'Desplazamiento local en la estación'
          return { id: item.kind, cells: [label, `${resultNumber(item.value, scale)} ${unit}`, `${resultNumber(item.limit, scale)} ${unit}`,
            item.status === 'within-limit' ? 'Dentro del límite declarado' : 'Excede el límite declarado'] }
        })} />}
    </section>
  </>
}

export default function DesignPanel(props: PanelProps) {
  const { model, selectedBar, selectBar, analysisStatus, close, settings, updateSettings } = props
  return <aside id="structural-design" className="results-panel" aria-label="Diseño estructural">
    <header className="results-heading">
      <div><h2>Diseño estructural</h2><p role="status" aria-label="Estado del análisis para diseño">{analysisStatus}</p></div>
      <button className="icon-button" aria-label="Cerrar diseño" title="Cerrar diseño" type="button" onClick={close}><Icon name="close" size={18} /></button>
    </header>
    <div className="results-body">
      <p className="result-hint">Evaluación elástica de una sección homogénea sin fisuración. Las comparaciones corresponden únicamente a los límites declarados.</p>
      <p className="result-hint">Verificaciones normativas reservadas para etapas posteriores.</p>
      <label className="result-field">Barra de diseño<select value={selectedBar ?? ''} onChange={event => selectBar(event.target.value)}>
        <option value="">Seleccionar…</option>{model.bars.map(bar => <option key={bar.id} value={bar.id}>{bar.id} · {bar.label}</option>)}
      </select></label>
      <CriterionForm key={settings.criterion ? 'active' : 'empty'} saved={settings.criterion}
        update={criterion => updateSettings({ ...settings, criterion })} />
      {selectedBar ? <MemberDesign key={selectedBar} {...props} selectedBar={selectedBar} />
        : <p className="result-hint">Selecciona una barra del lienzo o de la lista.</p>}
    </div>
  </aside>
}
