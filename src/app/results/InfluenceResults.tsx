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

function units(detail: InfluenceDetail) {
  const { target } = detail
  if (target.kind === 'effort') return target.field === 'M' ? 'N·m' : 'N'
  return target.kind === 'reaction' ? 'N' : target.motion.kind === 'rotation' ? 'rad' : 'm'
}

function targetLabel(detail: InfluenceDetail) {
  const target = detail.target
  if (target.kind === 'reaction') return `Reacción de ${target.nodeId} · (${resultNumber(target.direction.x)}, ${resultNumber(target.direction.y)}) global`
  if (target.kind === 'displacement') return target.motion.kind === 'rotation' ? `Giro +Z de ${target.nodeId}`
    : `Traslación de ${target.nodeId} · (${resultNumber(target.motion.direction.x)}, ${resultNumber(target.motion.direction.y)}) global`
  return `${target.field} en ${target.barId} · s = ${resultNumber(target.s)} m · ${target.side === 'left' ? 'lado izquierdo' : 'lado derecho'}`
}

export function InfluenceResults({ detail, learning, select, position, onPosition }: {
  detail: InfluenceDetail; learning: boolean; select: (item: Selection) => void; position: MovingPosition
  onPosition: (position: MovingPosition) => void
}) {
  const side = position.side ?? 'exact'
  const { train } = detail
  const isTrain = position.mode === 'train'
  const curve = isTrain && train ? train.envelope : detail
  const first = curve.knots[0]!.s, last = curve.knots.at(-1)!.s
  const label = isTrain ? 'Respuesta del tren' : 'Línea de influencia'
  const unit = isTrain ? units(detail) : `${units(detail)}/N`
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
    <figure className="influence-chart">
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
    </figure>
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
      <p>Contraste directo de la línea · S = {resultNumber(detail.verification.s)} m · error {resultNumber(detail.verification.maxError)} {units(detail)}/N.</p>
      {train && <p>Contraste directo del tren · S = {resultNumber(train.verification.s)} m · suma {resultNumber(train.verification.ordinate)} {units(detail)} · motor {resultNumber(train.verification.direct)} {units(detail)}.</p>}
      <ResultTable label="Tramos del recorrido" headings={['Barra', 'Nudo inicial del camino', 'Nudo final', 'S inicial (m)', 'S final (m)', 's local']}
        rows={detail.path.map(step => ({ id: step.barId, cells: [
          <button type="button" className="result-link" onClick={() => select({ kind: 'bar', id: step.barId })}>{step.barId}</button>,
          step.startId, step.endId, resultNumber(step.from), resultNumber(step.to), step.reversed ? 'Decreciente' : 'Creciente',
        ] }))} />
    </>}
  </section>
}
