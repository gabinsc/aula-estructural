import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { findNodeOverlaps } from '../domain/nodeOverlaps'
import { DEFAULT_CAMERA, fitCamera, screenToWorld } from '../geometry/camera'
import type { Viewport } from '../geometry/camera'
import type { Point } from '../geometry/coordinates'
import { ModelCanvas } from '../modeler/canvas/ModelCanvas'
import type { DimensionMode } from '../modeler/canvas/Dimensions'
import { Inspector } from '../modeler/inspector/Inspector'
import { acceptsPoint } from '../modeler/tools/editor'
import { editWithHistory, INITIAL_HISTORY } from '../modeler/tools/history'
import { buildObjectSnaps, resolveSnap, SNAP_LABELS } from '../modeler/tools/snap'
import { Icon } from './Icon'
import { Tools, tools } from './Tools'
import { StatusBar } from './StatusBar'
import { describeUcs } from './UcsForm'
import { WorkspaceDialog } from './WorkspaceDialog'
import type { OpenPanel, WorkspacePanel } from './WorkspaceDialog'
import { projectStore } from '../infrastructure/projectStore'
import { makeProject } from '../projects/document'
import { messageFor, useProjectSave } from '../projects/useProjectSave'
import type { WorkspaceProject } from '../projects/useProjectSave'
import { ProjectMenu } from './ProjectMenu'
import { LibraryDialog } from './library/LibraryDialog'
import { ALL_LOADS } from '../projects/analysisInput'
import type { Selection } from '../domain/structure'
import { ResultsPanel } from './results/ResultsPanel'
import { ANALYSIS_STATUS, useAnalysis } from './results/useAnalysis'
import { AVMControl } from '../modeler/results/AVMControl'
import { buildDiagramModel, DEFAULT_PREFERENCES } from '../modeler/results/diagramModel'
import type { AVMPreferences, DiagramModel, SolvedAnalysis } from '../modeler/results/diagramModel'
import type { SectionCut } from '../modeler/results/diagramFields'
import { availableRedundants, MAX_REDUNDANTS } from '../analysis/forceMethod'
import { INITIAL_VIRTUAL, MethodControls, methodRequest } from './results/MethodControls'
import type { MethodKind } from './results/MethodControls'
import { RedundantMarkers } from './results/MethodGraphics'
import { INITIAL_INFLUENCE } from './results/InfluenceControls'
import { InfluenceOverlay } from './results/InfluenceResults'
import type { MovingPosition } from './results/InfluenceResults'
import type { InfluenceDetail } from '../analysis/influence'
import { EMPTY_DESIGN } from '../design/settings'

const DesignPanel = lazy(() => import('./design/DesignPanel'))

export function App() {
  const [session, setSession] = useState<WorkspaceProject | null>(null)
  const [warning, setWarning] = useState('')
  useEffect(() => {
    let mounted = true
    void projectStore.last().then(project => {
      if (mounted) setSession(project ?? { document: makeProject(), revision: null })
    }).catch(cause => {
      if (!mounted) return
      setWarning(messageFor(cause))
      setSession({ document: makeProject(), revision: null })
    })
    return () => { mounted = false }
  }, [])

  return session ? <Workspace key={session.document.id} session={session} storageWarning={warning} activate={project => {
    setWarning('')
    setSession(project)
  }} /> : <main className="workspace-loading" role="status">Cargando proyectos locales…</main>
}

function Workspace({ session, storageWarning, activate }: {
  session: WorkspaceProject
  storageWarning: string
  activate: (project: WorkspaceProject) => void
}) {
  const [{ editor, past, future }, dispatch] = useReducer(editWithHistory, session.document.model,
    model => ({ ...INITIAL_HISTORY, editor: { ...INITIAL_HISTORY.editor, model } }))
  const [camera, setCamera] = useState(DEFAULT_CAMERA)
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 })
  const needsInitialFit = useRef(session.revision !== null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [showGrid, setShowGrid] = useState(session.document.view.grid)
  const [dimensionMode, setDimensionMode] = useState<DimensionMode>(session.document.view.dimensions)
  const [name, setName] = useState(session.document.name)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const projectsButton = useRef<HTMLButtonElement>(null)
  const snapButton = useRef<HTMLButtonElement>(null)
  const [learning, setLearning] = useState(true)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [designOpen, setDesignOpen] = useState(false)
  const [designSettings, setDesignSettings] = useState(session.document.design)
  const designButton = useRef<HTMLButtonElement>(null)
  const [resultsExpanded, setResultsExpanded] = useState(false)
  const resultsButton = useRef<HTMLButtonElement>(null)
  const [caseIds, setCaseIds] = useState<readonly string[] | null>(null)
  const [method, setMethod] = useState<MethodKind>('stiffness')
  const [virtualDraft, setVirtualDraft] = useState(INITIAL_VIRTUAL)
  const [redundants, setRedundants] = useState<readonly string[]>([])
  const [movingDraft, setMovingDraft] = useState(INITIAL_INFLUENCE)
  const [mobile, setMobile] = useState<{ detail: InfluenceDetail; position: MovingPosition }>()
  const [panel, setPanel] = useState<WorkspacePanel | null>(null)
  const { interaction, model, snap } = editor
  const loadCase = useMemo(() => {
    if (caseIds === null) return ALL_LOADS
    const live = new Set(model.loads.map(load => load.id))
    return { id: 'seleccion', loadIds: caseIds.filter(id => live.has(id)) }
  }, [caseIds, model.loads])
  const candidatesForMethod = useMemo(() => method === 'forces' ? availableRedundants(model) : [], [method, model])
  const analysis = useAnalysis(model, method === 'influence' ? ALL_LOADS : loadCase, methodRequest(method, virtualDraft, redundants, movingDraft))
  const [avm, setAvm] = useState<AVMPreferences>(DEFAULT_PREFERENCES)
  const viewChosen = useRef(false)
  const [savedCut, setSavedCut] = useState<{ cut: SectionCut; result: SolvedAnalysis }>()
  const currentDetail = analysis.state.status === 'current' ? analysis.state.detail : undefined
  const influence = currentDetail?.kind === 'influence' ? currentDetail : undefined
  const influencePresentation = method === 'influence' && resultsOpen
  const currentMobile = mobile && mobile.detail === influence ? mobile.position : { mode: 'unit' as const, s: 0 }
  const solved = analysis.state.status === 'current' && !influence ? analysis.state.result : undefined
  const selectedBar = editor.selection.find(item => item.kind === 'bar')?.id
  const cut = solved && savedCut?.result === solved && savedCut.cut.barId === selectedBar ? savedCut.cut : undefined
  const plotting = avm.view !== 'model'
  function toggleRedundant(id: string) {
    setRedundants(previous => previous.includes(id) ? previous.filter(item => item !== id)
      : previous.length < MAX_REDUNDANTS ? [...previous, id] : previous)
  }
  const { diagram, invalidDiagram } = useMemo((): { diagram?: DiagramModel; invalidDiagram: boolean } => {
    if (!solved || !plotting) return { invalidDiagram: false }
    try { return { diagram: buildDiagramModel(model, solved), invalidDiagram: false } }
    catch (cause) {
      if (!(cause instanceof RangeError)) throw cause
      return { invalidDiagram: true }
    }
  }, [model, plotting, solved])
  const analysisStatus = ANALYSIS_STATUS[analysis.state.status]
  const pick = useCallback((value: SectionCut) => {
    if (!solved) return
    if (value.source === 'chart') dispatch({ type: 'tool', tool: 'select' })
    if (value.barId !== selectedBar) dispatch({ type: 'select', items: [{ kind: 'bar', id: value.barId }] })
    setSavedCut({ cut: value, result: solved })
  }, [selectedBar, solved])
  const overlay = useMemo(() => ({
    preferences: influencePresentation ? { ...avm, view: 'model' as const, loads: false, reactions: false, geometry: true } : avm,
    result: solved, diagram, cut: avm.query ? cut : undefined, selectedId: selectedBar, learning, pick,
  }), [avm, cut, diagram, influencePresentation, learning, pick, selectedBar, solved])
  function updateAvm(patch: Partial<AVMPreferences>) {
    if (patch.view) viewChosen.current = true
    if (patch.view === 'combined') { setDesignOpen(false); setResultsOpen(true) }
    setAvm(old => ({ ...old, ...patch }))
  }
  function analyze() {
    if (!viewChosen.current) {
      viewChosen.current = true
      setAvm(old => ({ ...old, view: 'N' }))
    }
    if (!designOpen) setResultsOpen(true)
    analysis.run()
  }
  const storage = useProjectSave(session, name, model, { grid: showGrid, dimensions: dimensionMode }, designSettings)
  const initialWarning = storage.status === 'Proyecto en memoria' ? storageWarning : ''
  const saveState = storage.error || initialWarning ? 'error' : storage.dirty ? 'pending' : 'saved'
  const ucs = describeUcs(editor.ucs)
  const openPanel: OpenPanel = (kind, anchor) => setPanel({ kind, anchor })
  const overlaps = useMemo(() => findNodeOverlaps(model.nodes), [model.nodes])
  const { nodes, bars } = model
  const candidates = useMemo(() => snap.objects ? buildObjectSnaps({ nodes, bars }) : [], [nodes, bars, snap.objects])
  const excludedNodes = useMemo(() => interaction.tool === 'move' && interaction.stage === 'place'
    ? new Set(interaction.nodeIds) : undefined, [interaction])
  function pointAt(screen: Point) {
    return resolveSnap(screenToWorld(screen, camera, viewport), camera.scale, snap, candidates, excludedNodes)
  }
  function selectResult(target: Selection) {
    dispatch({ type: 'tool', tool: 'select' })
    dispatch({ type: 'select', items: [target] })
  }

  useEffect(() => {
    if ((resultsOpen || designOpen) && window.matchMedia('(max-width: 760px)').matches) {
      document.getElementById(designOpen ? 'structural-design' : 'analysis-results')?.scrollIntoView({ block: 'start' })
    }
  }, [resultsOpen, designOpen])

  useEffect(() => {
    if (!needsInitialFit.current || viewport.width <= 0 || viewport.height <= 0) return
    needsInitialFit.current = false
    if (session.document.model.nodes.length) setCamera(fitCamera(session.document.model.nodes, viewport))
  }, [session.document.model.nodes, viewport])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented || projectsOpen || libraryOpen) return
      if (event.key === 'Escape') {
        if (!panel) dispatch({ type: 'cancel' })
        return
      }
      const target = event.target
      if (event.altKey || panel?.kind === 'shortcuts') return
      const editing = target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select'))
      const key = event.key.toUpperCase()
      if (event.ctrlKey || event.metaKey) {
        if (!panel && !editing && !event.shiftKey && (key === 'C' || key === 'V')) {
          event.preventDefault()
          if (!event.repeat) dispatch({ type: key === 'C' ? 'copy' : 'paste-start' })
          return
        }
        const redo = (key === 'Z' && event.shiftKey) ||
          (key === 'Y' && event.ctrlKey && !event.metaKey && !event.shiftKey)
        if (!panel && !editing && (key === 'Z' || redo)) {
          event.preventDefault()
          if (!event.repeat) dispatch({ type: redo ? 'redo' : 'undo' })
        }
        return
      }
      if (key === 'F9' || key === 'F3') {
        event.preventDefault()
        if (!event.repeat) dispatch({ type: 'toggle-snap', system: key === 'F9' ? 'grid' : 'objects' })
        return
      }
      if (panel || event.repeat || editing) return
      const tool = tools.find(item => item.key === key)
      if (tool) {
        event.preventDefault()
        dispatch({ type: 'tool', tool: tool.id })
      } else if (key === 'F') {
        event.preventDefault()
        setCamera(fitCamera(model.nodes, viewport))
      } else if (key === 'DELETE' || key === 'BACKSPACE') {
        event.preventDefault()
        dispatch({ type: 'delete' })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [model.nodes, viewport, panel, projectsOpen, libraryOpen])

  const snapPoint = cursor && cursor.x >= 26 && cursor.y >= 26 && acceptsPoint(interaction) ? pointAt(cursor) : null
  const position = snapPoint?.point ?? (cursor && screenToWorld(cursor, camera, viewport))
  const coordinateDigits = snapPoint && snapPoint.kind !== 'free' ? 8 : 4
  const toolName = interaction.tool === 'reference' ? 'Origen UCS' : interaction.tool === 'paste' ? 'Pegar'
    : interaction.tool === 'split' ? 'Dividir' : interaction.tool === 'edit-node' ? 'Editar nudo'
    : tools.find(item => item.id === interaction.tool)?.label ?? 'Seleccionar'

  return <main className="workspace">
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Icon name="brand" size={23} /></span>
        <span className="brand-name">Aula <strong>Estructural</strong></span>
        <span className="beta-version">Beta 0.2</span>
      </div>
      <div className="document-title" title={name}><Icon name="layers" size={16} /><span>Modelador</span><Icon name="chevron" size={12} /><strong>{name}</strong></div>
      <div className="top-right">
        <div className="analysis-actions" role="group" aria-label="Análisis estructural">
          <button type="button" className="button primary analyze-button" aria-label="Analizar estructura"
            title="Analizar estructura" onClick={analyze}>
            <Icon name="analysis" size={17} /><span>Analizar estructura</span>
          </button>
          <button type="button" className="icon-button" aria-label="Resultados" title="Resultados"
            ref={resultsButton} aria-pressed={resultsOpen} onClick={() => {
              setDesignOpen(false)
              setResultsOpen(value => !value)
            }}>
            <Icon name="panel" size={17} />
          </button>
          <button type="button" className="icon-button" aria-label="Diseño estructural" title="Diseño estructural"
            ref={designButton} aria-controls={designOpen ? 'structural-design' : undefined} aria-pressed={designOpen} onClick={() => {
              setResultsOpen(false)
              setDesignOpen(value => !value)
            }}>
            <Icon name="design" size={17} />
          </button>
        </div>
        <button className="icon-button library-shortcut" type="button" aria-haspopup="dialog"
          aria-label="Biblioteca de materiales y secciones" title="Biblioteca de materiales y secciones"
          onClick={() => setLibraryOpen(true)}><Icon name="book" size={19} /></button>
        <div className="project-indicator" data-save-state={saveState} title={storage.error || initialWarning || storage.status}>
          <button type="button" className="icon-button" ref={projectsButton} aria-label="Proyectos" aria-haspopup="dialog"
            aria-expanded={projectsOpen} onClick={() => setProjectsOpen(true)}><Icon name="layers" size={18} /></button>
          <span role="status" aria-label="Estado de guardado" className={saveState === 'error' ? 'project-state error' : 'project-state'}>
            {initialWarning ? 'Recuperación local fallida' : storage.status}
          </span>
        </div>
        <div className="history-tools" role="group" aria-label="Historial de edición">
          <button type="button" className="icon-button" aria-label="Deshacer" title="Deshacer (Ctrl / Cmd + Z)"
            aria-keyshortcuts="Control+Z Meta+Z" onClick={() => dispatch({ type: 'undo' })} disabled={!past.length}><Icon name="undo" size={19} /></button>
          <button type="button" className="icon-button" aria-label="Rehacer" title="Rehacer (Ctrl + Y o Ctrl / Cmd + Mayús + Z)"
            aria-keyshortcuts="Control+Y Control+Shift+Z Meta+Shift+Z" onClick={() => dispatch({ type: 'redo' })} disabled={!future.length}><Icon name="redo" size={19} /></button>
        </div>
        <div className="mode" role="group" aria-label="Modo de trabajo">
          <button type="button" aria-pressed={learning} onClick={() => setLearning(true)}><Icon name="book" size={15} /><span>Aprender</span></button>
          <button type="button" aria-pressed={!learning} onClick={() => setLearning(false)}><Icon name="target" size={15} /><span>Resolver</span></button>
        </div>
      </div>
    </header>
    <p className="educational-notice">Uso educativo. No utilizar para diseño profesional.</p>
    <div className={resultsOpen || designOpen ? `workarea with-results${resultsOpen && resultsExpanded ? ' results-expanded' : ''}` : 'workarea'}>
      <Tools current={tools.find(item => item.id === interaction.tool)?.id ?? null} setTool={tool => dispatch({ type: 'tool', tool })}
        loadPreset={interaction.tool === 'load' ? interaction.preset : undefined} chooseLoad={preset => dispatch({ type: 'load-preset', preset })}
        supportPreset={interaction.tool === 'support' ? interaction.preset : undefined} chooseSupport={preset => dispatch({ type: 'support-preset', preset })}
        fit={() => setCamera(fitCamera(model.nodes, viewport))} />
      <ModelCanvas editor={editor} dispatch={dispatch} camera={camera} setCamera={setCamera}
        viewport={viewport} setViewport={setViewport} cursor={cursor} setCursor={setCursor}
        showGrid={showGrid} pointAt={pointAt} snapPoint={snapPoint} overlaps={overlaps} dimensions={dimensionMode}
        overlay={overlay} analysisStatus={analysisStatus} invalidDiagram={invalidDiagram}
        methodMarkers={influence && influencePresentation ? <InfluenceOverlay model={model} detail={influence} position={currentMobile} camera={camera} viewport={viewport} />
          : method === 'forces' && resultsOpen && <RedundantMarkers model={model} candidates={candidatesForMethod}
            ids={redundants} toggle={toggleRedundant} camera={camera} viewport={viewport} />}
        avmControl={!influencePresentation && <AVMControl preferences={avm} update={updateAvm}
          status={analysisStatus} hasResult={!!solved} canvasHeight={viewport.height} />}
        configureGrid={() => { if (snapButton.current) openPanel('snap', snapButton.current) }}
        viewIndicator={<button type="button" className="view-label" aria-label="Configurar UCS en el lienzo"
          aria-haspopup="dialog" aria-expanded={panel?.kind === 'ucs'} aria-controls="workspace-ucs"
          title={`Configurar UCS · ${ucs.label}`} onClick={event => openPanel('ucs', event.currentTarget)}>
          <span className={ucs.customized ? 'axis-symbol is-custom' : 'axis-symbol'} style={{ transform: `rotate(${-ucs.angle}deg)` }}>
            <Icon name="axes" size={18} />
          </span>
          <span>{ucs.label}</span><Icon name="chevron" size={12} />
        </button>} />
      {resultsOpen ? <ResultsPanel state={analysis.state} missing={analysis.missing} loads={model.loads}
        influenceMode={method === 'influence'} mobilePosition={currentMobile}
        onMobile={position => { if (influence) setMobile({ detail: influence, position }) }}
        model={model} methodControls={<MethodControls model={model} kind={method} changeKind={setMethod}
          draft={virtualDraft} changeDraft={setVirtualDraft} selection={editor.selection} candidates={candidatesForMethod}
          ids={redundants} toggle={toggleRedundant} clear={() => setRedundants([])} moving={movingDraft} changeMoving={setMovingDraft} />}
        selected={caseIds === null ? null : loadCase.loadIds ?? []} setSelected={setCaseIds}
        learning={learning} selection={editor.selection} select={selectResult} cut={cut} onCut={pick}
        onShowCut={value => {
          pick(value)
          updateAvm({ view: 'combined' })
          requestAnimationFrame(() => document.querySelector('.avm-bands')?.scrollIntoView({ block: 'start' }))
        }}
        combined={avm.view === 'combined' ? diagram : undefined} labels={avm.labels}
        expanded={resultsExpanded} toggleExpanded={() => setResultsExpanded(old => !old)} close={() => {
          setResultsOpen(false)
          resultsButton.current?.focus({ preventScroll: true })
        }} /> : designOpen ? <Suspense fallback={<aside id="structural-design" className="results-panel" aria-busy="true">
          <p role="status">Cargando diseño…</p>
        </aside>}><DesignPanel model={model} selectedBar={selectedBar} projectId={session.document.id}
          loadCaseId={loadCase.id} physicalRevision={analysis.physicalRevision} analysisRevision={analysis.revision}
          analysis={solved} analysisStatus={method === 'influence' ? 'Selecciona un método de caso estático' : analysisStatus} cut={cut}
          settings={designSettings ?? EMPTY_DESIGN} updateSettings={setDesignSettings}
          selectBar={barId => {
            if (barId) selectResult({ kind: 'bar', id: barId })
            else dispatch({ type: 'select', items: [] })
          }}
          showCut={value => { pick(value); updateAvm({ view: 'combined' }) }}
          close={() => {
            setDesignOpen(false)
            designButton.current?.focus({ preventScroll: true })
          }} /></Suspense> : <Inspector editor={editor} dispatch={dispatch} overlaps={overlaps} />}
    </div>
    <StatusBar position={position} digits={coordinateDigits} scale={camera.scale} showGrid={showGrid}
      toggleGrid={() => setShowGrid(show => !show)} snap={snap} ucsLabel={ucs.label} activePanel={panel?.kind}
      openPanel={openPanel} tool={toolName} snapButton={snapButton} dimensions={dimensionMode} setDimensions={setDimensionMode}
      snapLabel={snapPoint && snapPoint.kind !== 'free' ? SNAP_LABELS[snapPoint.kind] : undefined} />
    {panel && <WorkspaceDialog panel={panel} editor={editor} dispatch={dispatch} onClose={() => setPanel(null)} />}
    <ProjectMenu open={projectsOpen} storage={storage} rename={setName} activate={activate} openLibrary={() => setLibraryOpen(true)} close={() => {
      setProjectsOpen(false)
      projectsButton.current?.focus({ preventScroll: true })
    }} />
    {libraryOpen && <LibraryDialog model={model} error={editor.error} close={() => setLibraryOpen(false)}
      edit={change => dispatch({ type: 'library', change })} />}
  </main>
}
