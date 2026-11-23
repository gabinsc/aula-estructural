import { lazy, Suspense } from 'react'
import { axleStation, curveAt } from '../../analysis/influenceCurve'
import type { CurvePoint } from '../../analysis/influenceCurve'
import { mobileLocation } from '../../analysis/influence'
import type { InfluenceDetail } from '../../analysis/influence'
import type { Selection, Structure } from '../../domain/structure'
import { worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import { loadBarGeometry } from '../../domain/load'
import { toGlobal } from '../../geometry/coordinates'
import { ResultTable, resultNumber } from './ResultTable'
import type { InfluenceResultDetail } from '../../analysis/methods'
import { DEFAULT_BAND_OPTIONS, InfluenceBand, InfluenceReference, influenceUnits, plotStation } from './InfluenceBands'
import type { InfluenceBandData } from './InfluenceBands'
import type { DisplayedInfluence } from './InfluenceControls'
const InfluenceReport = lazy(async () => ({ default: (await import('./InfluenceReport')).InfluenceReport }))

export interface MovingPosition { readonly mode: 'unit' | 'train'; readonly s: number; readonly side?: CurvePoint['side'] }

function mobileAxles(detail: InfluenceDetail, { mode, s }: MovingPosition) {
  const train = mode === 'train' ? detail.train?.spec : undefined
  if (!train) return [{ id: 'Unitaria', force: 1, s }]
  return train.axles.map(axle => ({ id: axle.id, force: axle.force, s: axleStation(detail.knots, s, train.sense * axle.offset) }))
}

function activeLocation(detail: InfluenceDetail, s: number, side?: CurvePoint['side']) {
  const last = detail.path.at(-1)!.to
  if ((side === 'left' && s === 0) || (side === 'right' && s === last)) return undefined
  return mobileLocation(detail.path, s)
}

export function InfluenceOverlay({ model, detail, position, camera, viewport }: {
  model: Structure; detail: InfluenceDetail; position: MovingPosition; camera: Camera; viewport: Viewport
}) {
  const nodes = new Map(model.nodes.map(node => [node.id, worldToScreen(node, camera, viewport)]))
  return <g className="influence-overlay" aria-label="Recorrido y posiciones de carga" pointerEvents="none">
    {detail.path.map(step => {
      const a = nodes.get(step.startId)!, b = nodes.get(step.endId)!
      return <line key={step.barId} className="influence-route" data-influence-path={step.barId} x1={a.x} x2={b.x} y1={a.y} y2={b.y} />
    })}
    {mobileAxles(detail, position).map(axle => {
      const location = activeLocation(detail, axle.s, position.side)
      const geometry = location && loadBarGeometry(model, location.step.barId)
      if (!geometry || axle.force === 0) return null
      const { x, y } = worldToScreen(toGlobal({ x: location.s, y: 0 }, geometry.frame), camera, viewport)
      const sign = Math.sign(axle.force)
      const dx = detail.direction.x * sign, dy = -detail.direction.y * sign
      const tip = { x: x - dx * 3, y: y - dy * 3 }
      const tail = { x: tip.x - dx * 30, y: tip.y - dy * 30 }
      const arrow = `M${tip.x - 7 * dx + 4 * dy} ${tip.y - 7 * dy - 4 * dx}L${tip.x} ${tip.y}L${tip.x - 7 * dx - 4 * dy} ${tip.y - 7 * dy + 4 * dx}`
      return <g key={axle.id} data-mobile-axle={axle.id} className="influence-mobile">
        <circle cx={x} cy={y} r={3} /><line x1={tail.x} x2={tip.x} y1={tail.y} y2={tip.y} /><path d={arrow} />
        <text x={tail.x + 6} y={tail.y - 6}>{position.mode === 'unit' ? '1 N' : `${axle.id} · ${resultNumber(axle.force, .001)} kN`}</text>
      </g>
    })}
  </g>
}

function targetLabel(detail: InfluenceDetail) {
  const target = detail.target
  if (target.kind === 'reaction') return `Reacción de ${target.nodeId} · (${resultNumber(target.direction.x)}, ${resultNumber(target.direction.y)}) global`
  if (target.kind === 'displacement') return target.motion.kind === 'rotation' ? `Giro +Z de ${target.nodeId}`
    : `Traslación de ${target.nodeId} · (${resultNumber(target.motion.direction.x)}, ${resultNumber(target.motion.direction.y)}) global`
  return `${target.field} en ${target.barId} · s = ${resultNumber(target.s)} m · ${target.side === 'left' ? 'lado izquierdo' : 'lado derecho'}`
}

export function InfluenceResults({ detail, learning, select, position, onPosition, model, lines, changeLines, decimals }: {
  detail: InfluenceResultDetail; learning: boolean; select: (item: Selection) => void; position: MovingPosition
  onPosition: (position: MovingPosition) => void
  model: Structure; lines: readonly DisplayedInfluence[]; changeLines: (lines: readonly DisplayedInfluence[]) => void; decimals: number
}) {
  const side = position.side ?? 'exact'
  const { train } = detail
  const isTrain = position.mode === 'train'
  const curve = isTrain && train ? train.envelope : detail
  const first = curve.knots[0]!.s, last = curve.knots.at(-1)!.s
  const label = isTrain ? 'Respuesta del tren' : 'Línea de influencia'
  const unit = isTrain ? influenceUnits(detail) : `${influenceUnits(detail)}/N`
  const knotAt = curve.knots.find(knot => knot.s === position.s)
  const value = curveAt(curve.pieces, curve.knots, position.s, side)
  const maxAbs = Math.max(Math.abs(curve.max.value), Math.abs(curve.min.value))
  const x = (s: number) => 36 + 538 * (s - first) / (last - first)
  const y = (v: number) => 82 - (maxAbs ? 58 * v / maxAbs : 0)
  const jumps = curve.knots.filter(knot => knot.left !== undefined && knot.right !== undefined &&
    Math.abs(knot.left - knot.right) > 1e-9 * maxAbs)
  function move(next: MovingPosition, limit: CurvePoint['side'] = 'exact') {
    if (!Number.isFinite(next.s)) return
    onPosition({ ...next, side: limit })
  }
  const point = mobileLocation(detail.path, position.s)
  const target = detail.target
  const marks = mobileAxles(detail, position)
  const limits = [['Mínimo', curve.min], ['Máximo', curve.max]] as const
  const computed = new Map(detail.lines?.map(line => [line.id, line]))
  const graphs: InfluenceBandData[] = lines.flatMap(line => {
    const answer = computed.get(line.id)
    return answer && 'detail' in answer ? [{ ...line, detail: answer.detail }] : []
  })
  const primary: InfluenceBandData = { id: 'principal', name: targetLabel(detail), target: detail.target,
    color: '#0d7886', scale: 1, visible: true, detail }
  const patch = (id: string, item: Partial<DisplayedInfluence>) =>
    changeLines(lines.map(line => line.id === id ? { ...line, ...item } : line))
  function reorder(index: number, destination: number) {
    changeLines(lines.map((item, i) => i === index ? lines[destination]! : i === destination ? lines[index]! : item))
  }
  return <section className="result-section method-results" aria-label="Líneas de influencia">
    <h3>{label} · respuesta seleccionada</h3>
    <button type="button" className="result-link" onClick={() => select(target.kind === 'effort'
      ? { kind: 'bar', id: target.barId } : { kind: 'node', id: target.nodeId })}>{targetLabel(detail)}</button>
    {train && <label className="result-field">Carga mostrada
      <select value={position.mode} onChange={event => {
        const mode = event.target.value === 'train' ? 'train' : 'unit'
        const range = mode === 'train' ? train.envelope.knots : detail.knots
        move({ mode, s: Math.max(range[0]!.s, Math.min(range.at(-1)!.s, position.s)) })
      }}><option value="unit">Unitaria de 1 N</option><option value="train">{train.spec.name} · {train.spec.id}</option></select>
    </label>}
    {!lines.length && <figure className="influence-chart">
      <figcaption>{unit} · escala ±{resultNumber(maxAbs)} · S en metros</figcaption>
      <svg viewBox="0 0 600 167" role="img" aria-label={label} onPointerDown={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        const t = ((event.clientX - rect.left) / rect.width * 600 - 36) / 538
        move({ ...position, s: first + Math.max(0, Math.min(1, t)) * (last - first) })
      }}>
        <path className="method-baseline" d="M36 82H574" />
        {curve.pieces.map(({ from, to, coefficients: [a, b, c, d] }) => {
          const x0 = x(from), x1 = x(to), span = x1 - x0
          return <path key={from} className="method-curve" data-influence-segment
            d={`M${x0} ${y(a)}C${x0 + span / 3} ${y(a + b / 3)} ${x0 + 2 * span / 3} ${y(a + 2 * b / 3 + c / 3)} ${x1} ${y(a + b + c + d)}`} />
        })}
        {jumps.map(knot => <g key={knot.s} className="influence-jump" data-influence-jump={knot.s}>
          <circle cx={x(knot.s)} cy={y(knot.left!)} r={3.5} /><circle cx={x(knot.s)} cy={y(knot.right!)} r={3.5} />
          <circle cx={x(knot.s)} cy={y(knot.exact)} r={2} className="influence-exact" />
        </g>)}
        {!isTrain && detail.zeros.map(s => <circle key={s} cx={x(s)} cy={82} r={3.2} className="influence-zero" />)}
        {limits.map(([name, item]) => <circle key={name} cx={x(item.s)} cy={y(item.value)} r={4} className="influence-extreme"><title>{name}</title></circle>)}
        <line x1={x(position.s)} x2={x(position.s)} y1={18} y2={143} className="influence-cursor" />
        <circle cx={x(position.s)} cy={y(value)} r={4} className="influence-current" />
        <text x={36} y={158}>{resultNumber(first)}</text><text x={574} y={158} textAnchor="end">{resultNumber(last)}</text>
      </svg>
    </figure>}
    {!!lines.length && <section className="influence-multiple" aria-label="Líneas mostradas">
      <h4>Líneas mostradas</h4>
      <div className="influence-band-stack">
        <svg viewBox="0 0 600 94" role="img" aria-label="Recorrido común de las líneas">
          <InfluenceReference model={model} detail={detail} width={600} position={position}
            decimals={decimals} hinges dimensions supports />
        </svg>
        {graphs.filter(line => line.visible).map(line => <svg key={line.id} viewBox="0 0 600 116" role="img"
          aria-label={line.name || line.id} onClick={event => {
            const transform = event.currentTarget.getScreenCTM()?.inverse()
            if (!transform) return
            const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform)
            const x0 = plotStation(600, first, last, first), x1 = plotStation(600, first, last, last)
            move({ ...position, s: first + (last - first) * Math.max(0, Math.min(1, (point.x - x0) / (x1 - x0))) })
          }}>
          <InfluenceBand line={line} width={600} position={position} options={DEFAULT_BAND_OPTIONS} decimals={decimals} />
        </svg>)}
      </div>
      <details className="result-detail"><summary>Configurar líneas mostradas</summary>
        {lines.map((line, index) => {
          const answer = computed.get(line.id)
          return <fieldset className="method-fields" key={line.id} aria-label={line.id}>
            <legend>{line.id}</legend>
            <div className="result-controls">
              <label className="result-field">Nombre {line.id}<input value={line.name} maxLength={54}
                onChange={event => patch(line.id, { name: event.target.value })} /></label>
              <label><input type="checkbox" checked={line.visible} onChange={event => patch(line.id, { visible: event.target.checked })} />
                Visible {line.id}</label>
              <label className="result-field">Color {line.id}<input type="color" value={line.color}
                onChange={event => patch(line.id, { color: event.target.value })} /></label>
              <label className="result-field">Escala {line.id}<input type="range" min=".25" max="1" step=".05" value={line.scale}
                onChange={event => patch(line.id, { scale: Number(event.target.value) })} /></label>
              <button className="button secondary" type="button" disabled={!index} aria-label={`Subir ${line.id}`}
                onClick={() => reorder(index, index - 1)}>↑</button>
              <button className="button secondary" type="button" disabled={index === lines.length - 1} aria-label={`Bajar ${line.id}`}
                onClick={() => reorder(index, index + 1)}>↓</button>
              <button className="button secondary" type="button" onClick={() =>
                changeLines(lines.filter(item => item.id !== line.id))}>Quitar {line.id}</button>
            </div>
            {answer && 'error' in answer && <p className="model-error" role="alert">{answer.error}</p>}
          </fieldset>
        })}
      </details>
    </section>}
    <label className="result-field">Posición móvil S (m)
      <input type="range" min={first} max={last} step="any" value={position.s}
        onChange={event => move({ ...position, s: Number(event.target.value) })} />
    </label>
    <label className="result-field">Consultar lado en S<select value={side}
      onChange={event => move(position, event.target.value as CurvePoint['side'])}>
      <option value="exact">Posición exacta</option><option value="left" disabled={knotAt !== undefined && knotAt.left === undefined}>Límite S⁻</option>
      <option value="right" disabled={knotAt !== undefined && knotAt.right === undefined}>Límite S⁺</option>
    </select></label>
    <output aria-label="Ordenada móvil">S = {resultNumber(position.s)} m · {resultNumber(value)} {unit}</output>
    {!isTrain && point && <p>Barra {point.step.barId} · s local = {resultNumber(point.s)} m</p>}
    <ResultTable label="Posiciones críticas" headings={['Extremo', 'S (m)', unit, 'Tipo']}
      rows={limits.map(([name, item]) => ({ id: name, cells: [
        <button type="button" className="result-link" onClick={() => move({ ...position, s: item.s }, item.side)}>{name}</button>,
        resultNumber(item.s), resultNumber(item.value), item.side === 'exact' ? 'Valor' : item.side === 'left' ? 'Límite S⁻' : 'Límite S⁺',
      ] }))} />
    {isTrain && <ResultTable label="Ejes en el recorrido" headings={['Eje', 'S (m)', 'P (kN)', 'Acción']}
      rows={marks.map(axle => ({ id: axle.id, cells: [axle.id, resultNumber(axle.s), resultNumber(axle.force, .001),
        activeLocation(detail, axle.s, side) ? 'Dentro' : 'Fuera'] }))} />}
    {learning && <>
      <p>Se mueve una unidad de 1 N en la dirección global ({resultNumber(detail.direction.x)}, {resultNumber(detail.direction.y)}).
        El motor resuelve las cargas equivalentes de las estaciones de prueba. Cada intervalo admite una ordenada cúbica o de grado menor.</p>
      <p>Los extremos se obtienen en las estaciones singulares y en las raíces interiores de la derivada. En el tren se evalúa R = Σ Pᵢ·LI(Sᵢ), incluidos los límites al entrar o salir del camino.</p>
      <p>Contraste directo de la línea · S = {resultNumber(detail.verification.s)} m · error {resultNumber(detail.verification.maxError)} {influenceUnits(detail)}/N.</p>
      {train && <p>Contraste directo del tren · S = {resultNumber(train.verification.s)} m · suma {resultNumber(train.verification.ordinate)} {influenceUnits(detail)} · motor {resultNumber(train.verification.direct)} {influenceUnits(detail)}.</p>}
      <ResultTable label="Tramos del recorrido" headings={['Barra', 'Nudo inicial del camino', 'Nudo final', 'S inicial (m)', 'S final (m)', 's local']}
        rows={detail.path.map(step => ({ id: step.barId, cells: [
          <button type="button" className="result-link" onClick={() => select({ kind: 'bar', id: step.barId })}>{step.barId}</button>,
          step.startId, step.endId, resultNumber(step.from), resultNumber(step.to), step.reversed ? 'Decreciente' : 'Creciente',
        ] }))} />
    </>}
    <Suspense fallback={<p role="status">Preparando los controles del reporte…</p>}>
      <InfluenceReport model={model} detail={detail} lines={lines.length ? graphs : [primary]} position={position} decimals={decimals} />
    </Suspense>
  </section>
}
