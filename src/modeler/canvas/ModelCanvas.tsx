import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, PointerEvent, ReactNode, SetStateAction } from 'react'
import type { NodeOverlap } from '../../domain/nodeOverlaps'
import { loadBarGeometry } from '../../domain/load'
import { fitCamera, panCamera, worldToScreen, zoomCamera } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import { distance, fromGlobal, subtract, toGlobal, translateFromReference } from '../../geometry/coordinates'
import type { Point } from '../../geometry/coordinates'
import { distanceToSegment } from '../../geometry/picking'
import { Icon } from '../../app/Icon'
import { Axes } from './Axes'
import { Grid } from './Grid'
import { findNodeAt, selectionAt, selectionInBox } from './selection'
import type { SelectionBox } from './selection'
import { SnapMarker } from './SnapMarker'
import { StructureLayer } from './StructureLayer'
import { loadsAt, loadsInBox, supportAt } from './loadPicking'
import { CadContextMenu } from './CadContextMenu'
import { cadActions } from './cadActions'
import type { Selection } from '../../domain/structure'
import { Dimensions } from './Dimensions'
import type { DimensionMode } from './Dimensions'
import { acceptsPoint, loadPresetTarget, referencePoint } from '../tools/editor'
import type { Action, Editor, SelectionMode } from '../tools/editor'
import type { SnapResult } from '../tools/snap'
import { AVMLayer, CutReadout } from '../results/AVMLayer'
import type { Overlay } from '../results/AVMLayer'
import { AVMLegend } from '../results/AVMControl'
import { activeEfforts, pickDiagram } from '../results/diagramModel'

interface CanvasProps {
  editor: Editor
  dispatch: Dispatch<Action>
  camera: Camera
  setCamera: Dispatch<SetStateAction<Camera>>
  viewport: Viewport
  setViewport: Dispatch<SetStateAction<Viewport>>
  cursor: Point | null
  setCursor: Dispatch<SetStateAction<Point | null>>
  showGrid: boolean
  viewIndicator: ReactNode
  pointAt: (screen: Point) => SnapResult
  snapPoint: SnapResult | null
  overlaps: readonly NodeOverlap[]
  configureGrid: () => void
  dimensions: DimensionMode
  overlay: Overlay
  avmControl: ReactNode
  analysisStatus: string
  invalidDiagram: boolean
}

interface Gesture {
  id: number
  kind: 'pan' | 'click' | 'select'
  point: Point
  selectionMode?: SelectionMode
}

function selectionMode(event: PointerEvent<SVGSVGElement>): SelectionMode | undefined {
  if (event.ctrlKey || event.metaKey) return 'toggle'
  if (event.shiftKey) return 'add'
}

function pointerPosition(canvas: SVGSVGElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

export function ModelCanvas({
  editor, dispatch, camera, setCamera, viewport, setViewport, cursor, setCursor, showGrid, viewIndicator, pointAt, snapPoint,
  overlaps, configureGrid, dimensions, overlay, avmControl, analysisStatus, invalidDiagram,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const lastCursor = useRef<Point | null>(null)
  const [dragging, setDragging] = useState(false)
  const [space, setSpace] = useState(false)
  const [box, setBox] = useState<SelectionBox | null>(null)
  const [context, setContext] = useState<{ screen: Point; hit: Selection | null; support?: string; behind: Selection | null } | null>(null)
  const { model, interaction, selection } = editor
  const fields = activeEfforts(overlay.preferences.view)
  const queryReady = interaction.tool === 'select' && overlay.preferences.query && !!overlay.diagram && fields.length > 0
  const reportCursor = useCallback((point: Point | null, display = true) => {
    lastCursor.current = point
    setCursor(display ? point : null)
  }, [setCursor])

  useEffect(() => {
    const canvas = svgRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width && height) setViewport({ width, height })
    })
    observer.observe(canvas)
    function wheel(event: WheelEvent) {
      if (event.ctrlKey || !canvas) return
      event.preventDefault()
      const wheelPoint = pointerPosition(canvas, event.clientX, event.clientY)
      const pointer = lastCursor.current
      // El evento de rueda puede cuantizar la posición que PointerEvent entrega con subpíxeles.
      const point = pointer && Math.abs(pointer.x - wheelPoint.x) <= 1 && Math.abs(pointer.y - wheelPoint.y) <= 1
        ? pointer : wheelPoint
      const rect = canvas.getBoundingClientRect()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
      const delta = Math.max(-260, Math.min(260, event.deltaY * unit))
      reportCursor(point, gesture.current?.kind !== 'pan')
      setCamera(view => zoomCamera(view, rect, point, Math.exp(-delta * 0.002)))
    }
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      observer.disconnect()
      canvas.removeEventListener('wheel', wheel)
    }
  }, [reportCursor, setCamera, setViewport])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        const { id } = gesture.current
        gesture.current = null
        setDragging(false)
        setBox(null)
        if (svgRef.current?.hasPointerCapture(id)) svgRef.current.releasePointerCapture(id)
      }
      if (event.code === 'Space' && event.target === svgRef.current) {
        event.preventDefault()
        setSpace(true)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpace(false)
    }
    const blur = () => setSpace(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  function start(event: PointerEvent<SVGSVGElement>) {
    if (gesture.current || (event.button !== 0 && event.button !== 1)) return
    const element = event.currentTarget
    const point = pointerPosition(element, event.clientX, event.clientY)
    const pan = event.button === 1 || interaction.tool === 'pan' || space
    if (!pan && (point.x < 26 || point.y < 26)) return
    event.preventDefault()
    element.focus({ preventScroll: true })
    element.setPointerCapture(event.pointerId)
    gesture.current = {
      id: event.pointerId, kind: pan ? 'pan' : interaction.tool === 'select' ? 'select' : 'click', point,
      selectionMode: selectionMode(event),
    }
    setDragging(pan)
    reportCursor(point, !pan)
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    const point = pointerPosition(event.currentTarget, event.clientX, event.clientY)
    const active = gesture.current
    reportCursor(point, active?.kind !== 'pan')
    if (!active || active.id !== event.pointerId) return
    if (active.kind === 'pan') {
      const delta = subtract(point, active.point)
      active.point = point
      setCamera(view => panCamera(view, delta))
    } else if (active.kind === 'select') {
      setBox(distance(point, active.point) > 5 ? { start: active.point, end: point } : null)
    }
  }

  function finish(event: PointerEvent<SVGSVGElement>) {
    const active = gesture.current
    if (!active || active.id !== event.pointerId) return
    gesture.current = null
    setDragging(false)
    setBox(null)
    const point = pointerPosition(event.currentTarget, event.clientX, event.clientY)
    const inside = point.x >= 26 && point.y >= 26 && point.x <= viewport.width && point.y <= viewport.height
    reportCursor(inside ? point : null)
    const traveled = distance(point, active.point)
    if (active.kind === 'select' && interaction.tool === 'select') {
      const mode = selectionMode(event) ?? active.selectionMode
      if (traveled > 5) {
        const window = { start: active.point, end: point }
        const items = [...selectionInBox(model, window, camera, viewport), ...loadsInBox(event.currentTarget, window)]
        dispatch({ type: 'select', items, mode: mode ? 'add' : undefined })
      } else if (inside) {
        if (queryReady && !mode && !event.altKey) {
          const cut = pickDiagram(overlay.diagram!, fields, overlay.preferences.amplitude, point, camera, viewport)
          if (cut) { overlay.pick(cut); return }
        }
        const geometry = selectionAt(model, point, camera, viewport)
        const marker = findNodeAt(model, point, camera, viewport, 5.5)
        const hits = !marker || event.altKey ? loadsAt(event.currentTarget, point) : []
        const previous = selection.at(-1)
        const cycle = event.altKey && previous?.kind === 'load' ? hits.findIndex(hit => hit.id === previous.id) + 1 : 0
        const item = hits.length ? hits[cycle % hits.length] : geometry
        dispatch({ type: 'select', items: item ? [item] : [], mode })
      }
      return
    }
    if (!inside || active.kind !== 'click' || traveled > 5) return
    if (interaction.tool === 'paste' && interaction.target) {
      const target = selectionAt(model, point, camera, viewport)
      if (target?.kind === interaction.target) dispatch({ type: 'paste-loads', target })
      else dispatch({ type: 'error', message: 'Elige un propietario compatible para duplicar las cargas.' })
    } else if (interaction.tool === 'split') {
      const geometry = loadBarGeometry(model, interaction.barId)
      if (!geometry) return
      const a = worldToScreen(geometry.frame.origin, camera, viewport)
      const b = worldToScreen(toGlobal({ x: geometry.length, y: 0 }, geometry.frame), camera, viewport)
      if (distanceToSegment(point, a, b) <= 12) dispatch({ type: 'point', end: pointAt(point) })
      else dispatch({ type: 'error', message: 'Indica un punto sobre la barra o introduce la distancia de corte.' })
    } else if (interaction.tool === 'load') {
      const item = selectionAt(model, point, camera, viewport)
      if (!interaction.preset || item?.kind === loadPresetTarget(interaction.preset)) {
        dispatch({ type: 'select', items: item ? [item] : [] })
      }
    } else if (interaction.tool === 'support' || (interaction.tool === 'move' && interaction.stage === 'pick')) {
      const node = findNodeAt(model, point, camera, viewport)
      if (!node) return
      if (interaction.tool === 'support') dispatch({ type: 'select', items: [{ kind: 'node', id: node.id }] })
      else dispatch({ type: 'move-start', nodeId: node.id })
    } else if (acceptsPoint(interaction)) dispatch({ type: 'point', end: pointAt(point) })
  }

  function cancelPointer(event: PointerEvent<SVGSVGElement>) {
    if (gesture.current?.id !== event.pointerId) return
    gesture.current = null
    setDragging(false)
    setBox(null)
    reportCursor(null)
  }

  function zoom(factor: number) {
    const anchor = { x: viewport.width / 2, y: viewport.height / 2 }
    setCamera(view => zoomCamera(view, viewport, anchor, factor))
  }

  const panReady = interaction.tool === 'pan' || space
  const activePoint = cursor && cursor.x >= 26 && cursor.y >= 26 && !dragging && !panReady ? cursor : null
  const endpoint = activePoint ? snapPoint : null
  const nodePick = activePoint && (interaction.tool === 'support' || (interaction.tool === 'move' && interaction.stage === 'pick'))
    ? findNodeAt(model, activePoint, camera, viewport) : null
  const hover = nodePick ? { kind: 'node' as const, id: nodePick.id }
    : activePoint && !box && (interaction.tool === 'select' || interaction.tool === 'load') ? selectionAt(model, activePoint, camera, viewport) : null
  const crosshair = endpoint ? worldToScreen(endpoint.point, camera, viewport) : null
  const preview = interaction.tool === 'bar' && interaction.stage === 'end'
    ? { from: worldToScreen(interaction.start.point, camera, viewport), to: crosshair }
    : null
  const moveReference = interaction.tool === 'move' && interaction.stage === 'place' ? referencePoint(editor) : undefined
  const movePreview = interaction.tool === 'move' && interaction.stage === 'place' && moveReference && endpoint
    ? { nodeIds: interaction.nodeIds, reference: moveReference, destination: endpoint.point } : null
  const clipboard = interaction.tool === 'paste' && editor.clipboard?.kind === 'geometry' ? editor.clipboard : null
  const pasted = clipboard && endpoint ? new Map(clipboard.nodes.map(node => [node.id, worldToScreen(
    translateFromReference(node, clipboard.anchor, endpoint.point), camera, viewport)])) : null
  const split = interaction.tool === 'split' ? loadBarGeometry(model, interaction.barId) : null
  const cut = split && endpoint ? fromGlobal(endpoint.point, split.frame).x : null
  const cutPoint = split && cut !== null && cut > 0 && cut < split.length
    ? worldToScreen(toGlobal({ x: cut, y: 0 }, split.frame), camera, viewport) : null
  const menu = context && cadActions(editor, dispatch, context.hit, context.support, context.behind,
    () => setCamera(fitCamera(model.nodes, viewport)), configureGrid)
  const drawing = acceptsPoint(interaction)
  const prompt = interaction.tool === 'node' ? 'Ubica el nudo'
    : interaction.tool === 'reference' ? 'Ubica el origen UCS'
    : interaction.tool === 'support' ? 'Elige un nudo y configura su apoyo en el Inspector'
    : interaction.tool === 'load' ? interaction.preset
      ? loadPresetTarget(interaction.preset) === 'node' ? 'Elige un nudo para la carga' : 'Elige una barra para la carga'
      : 'Elige un nudo o una barra para gestionar sus cargas'
    : interaction.tool === 'paste' ? interaction.target === 'node' ? 'Elige el nudo de destino'
      : interaction.target === 'bar' ? 'Elige la barra de destino' : 'Indica el punto de inserción'
    : interaction.tool === 'split' ? 'Indica un punto sobre la barra'
    : interaction.tool === 'edit-node' ? 'Indica las coordenadas del nudo'
    : interaction.tool === 'move' ? interaction.stage === 'pick' ? 'Selecciona el nudo' : 'Indica el destino'
    : interaction.tool === 'bar' && interaction.stage === 'end' ? 'Define el extremo final' : 'Define el extremo inicial'
  const showPrompt = drawing || interaction.tool === 'move' || interaction.tool === 'support' || interaction.tool === 'load' || interaction.tool === 'paste'
  const promptIcon = interaction.tool === 'reference' ? 'axes' : interaction.tool === 'split' ? 'bar'
    : interaction.tool === 'paste' || interaction.tool === 'edit-node' ? 'move' : interaction.tool

  return <section className="canvas-shell" aria-label="Área de dibujo">
    <svg ref={svgRef} className={`model-canvas ${dragging ? 'dragging' : panReady ? 'pan-ready' : drawing ? 'drawing' : ''}`}
      aria-label="Lienzo CAD 2D" tabIndex={0}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish}
      onContextMenu={event => {
        event.preventDefault()
        const canvas = event.currentTarget
        const rect = canvas.getBoundingClientRect()
        const screen = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY }
          : { x: rect.left + viewport.width / 2, y: rect.top + viewport.height / 2 }
        const point = { x: screen.x - rect.left, y: screen.y - rect.top }
        const geometry = selectionAt(model, point, camera, viewport)
        const marker = findNodeAt(model, point, camera, viewport, 5.5)
        const load = marker ? undefined : loadsAt(canvas, point)[0]
        const support = !marker && !load ? supportAt(canvas, point) : undefined
        setContext({ screen, hit: load ?? geometry, support, behind: load ? geometry : null })
      }}
      onPointerCancel={cancelPointer} onLostPointerCapture={cancelPointer}
      onPointerLeave={() => { if (!gesture.current) reportCursor(null) }}
      onBlur={() => setSpace(false)}
      onAuxClick={event => { if (event.button === 1) event.preventDefault() }}>
      {showGrid && <Grid camera={camera} viewport={viewport} />}
      <Axes camera={camera} viewport={viewport} ucs={editor.ucs} />
      <StructureLayer model={model} selection={selection} hover={hover} camera={camera} viewport={viewport} activeLoadId={editor.activeLoadId} loadDraft={editor.loadDraft}
        preview={preview} movePreview={movePreview} overlaps={overlaps} showGeometry={overlay.preferences.geometry} showLoads={overlay.preferences.loads} />
      <AVMLayer model={model} overlay={overlay} camera={camera} viewport={viewport} />
      {pasted && clipboard && <g className="member-preview cad-paste-preview" aria-hidden="true">
        {clipboard.bars.map(bar => {
          const a = pasted.get(bar.startId)!
          const b = pasted.get(bar.endId)!
          return <line key={bar.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        })}
        {[...pasted].map(([id, point]) => <circle key={id} cx={point.x} cy={point.y} r={5} />)}
      </g>}
      {cutPoint && <g className="member-preview cad-paste-preview"><circle cx={cutPoint.x} cy={cutPoint.y} r={6} /></g>}
      <Dimensions editor={editor} camera={camera} viewport={viewport}
        mode={overlay.preferences.geometry ? dimensions : 'hidden'} destination={endpoint?.point} />
      {box && <rect className={`selection-box${box.start.x > box.end.x ? ' crossing' : ''}`}
        x={Math.min(box.start.x, box.end.x)} y={Math.min(box.start.y, box.end.y)}
        width={Math.abs(box.start.x - box.end.x)} height={Math.abs(box.start.y - box.end.y)} />}
      {crosshair && endpoint && <SnapMarker point={crosshair} kind={endpoint.kind} />}
      <Grid camera={camera} viewport={viewport} rulers />
    </svg>
    {context && menu && <CadContextMenu point={context.screen} title={menu.title} items={menu.items}
      close={() => setContext(null)} focusCanvas={() => svgRef.current?.focus({ preventScroll: true })} />}
    <div className="view-tools" role="group" aria-label="Controles de vista">
      {avmControl}
      <button type="button" title="Alejar" aria-label="Alejar" onClick={() => zoom(1 / 1.25)}><Icon name="minus" size={17} /></button>
      <button type="button" title="Acercar" aria-label="Acercar" onClick={() => zoom(1.25)}><Icon name="plus" size={17} /></button>
      <button type="button" title="Ajustar vista (F)" aria-label="Ajustar vista" onClick={() => setCamera(fitCamera(model.nodes, viewport))}><Icon name="fit" size={17} /></button>
    </div>
    <AVMLegend preferences={overlay.preferences} diagram={overlay.diagram} status={analysisStatus}
      hasResult={!!overlay.result} queryReady={queryReady} invalidDiagram={invalidDiagram} />
    <CutReadout overlay={overlay} />
    {showPrompt && <div className="drawing-prompt"><Icon name={promptIcon} size={16} /><span>{prompt}</span><kbd>Esc</kbd></div>}
    {model.nodes.length === 0 && interaction.tool === 'select' && <div className="canvas-intro">
      <span className="intro-icon"><Icon name="node" size={24} /></span>
      <h1>Empieza con un nudo</h1>
      <p>Coloca un punto en el plano o introduce sus coordenadas.</p>
      <button className="button primary" type="button" onClick={() => dispatch({ type: 'tool', tool: 'node' })}><Icon name="plus" size={16} /> Crear nudo <kbd>N</kbd></button>
    </div>}
    {viewIndicator}
  </section>
}
