import { curveAt } from '../../analysis/influenceCurve'
import type { InfluenceDetail } from '../../analysis/influence'
import type { Structure } from '../../domain/structure'
import { formatResult } from '../../modeler/format'
import type { DisplayedInfluence } from './InfluenceControls'
import type { MovingPosition } from './InfluenceResults'

export type InfluenceBandData = DisplayedInfluence & { readonly detail: InfluenceDetail }
export type BandOptions = { readonly fill: boolean; readonly zeros: boolean; readonly extremes: boolean;
  readonly jumps: boolean; readonly annotations: boolean }
export const DEFAULT_BAND_OPTIONS: BandOptions = { fill: true, zeros: true, extremes: true, jumps: true, annotations: true }
export const BAND_HEIGHT = 116
export const PATH_HEIGHT = 94

export function influenceUnits({ target }: InfluenceDetail) {
  if (target.kind === 'effort') return target.field === 'M' ? 'N·m' : 'N'
  return target.kind === 'reaction' ? 'N' : target.motion.kind === 'rotation' ? 'rad' : 'm'
}

export function influenceRange(detail: InfluenceDetail, mode: MovingPosition['mode']) {
  const knots = mode === 'train' && detail.train ? detail.train.envelope.knots : detail.knots
  return [knots[0]!.s, knots.at(-1)!.s] as const
}

export function plotStation(width: number, start: number, end: number, s: number) {
  return 39 + (width - 58) * ((s - start) / (end - start))
}

export function InfluenceBand({ line, width, position, options, decimals }: {
  line: InfluenceBandData; width: number; position: MovingPosition; options: BandOptions; decimals: number
}) {
  const { detail, color } = line
  const train = position.mode === 'train' && detail.train
  const curve = train ? train.envelope : detail
  const [start, end] = influenceRange(detail, position.mode)
  const peak = Math.max(Math.abs(curve.min.value), Math.abs(curve.max.value))
  const limit = peak > 0 ? peak / line.scale : 1
  const ordinate = curveAt(curve.pieces, curve.knots, position.s, position.side ?? 'exact')
  const unit = train ? influenceUnits(detail) : `${influenceUnits(detail)}/N`
  const n = (value: number) => formatResult(value, { reference: peak, decimals })
  const x = (s: number) => plotStation(width, start, end, s)
  const y = (value: number) => 62 - value / limit * 28
  const jumps = curve.knots.filter(({ left, right }) => left !== undefined && right !== undefined &&
    Math.abs(left - right) > peak * 1e-9)
  function piecePath({ from, to, coefficients: [a, b, c, d] }: typeof curve.pieces[number]) {
    const x0 = x(from), x1 = x(to), span = x1 - x0
    return `M${x0} ${y(a)}C${x0 + span / 3} ${y(a + b / 3)} ${x0 + 2 * span / 3} ${y(a + 2 * b / 3 + c / 3)} ${x1} ${y(a + b + c + d)}`
  }
  const move = position.s >= start && position.s <= end
  const label = line.name.trim() || line.id
  const selected = detail.target.kind === 'effort' ? `${detail.target.field} · ${detail.target.barId}, s=${n(detail.target.s)} m`
    : detail.target.nodeId
  return <g data-influence-band={line.id} fontFamily="Helvetica, sans-serif" fontSize={10} fill="#182b39">
    <rect x={1} y={2} width={width - 2} height={BAND_HEIGHT - 4} rx={5} fill="#f1f6f8" stroke="#c5d4dd" />
    <text x={12} y={17} fontSize={13} fontWeight="bold">{label.slice(0, 54)}</text>
    <text x={width - 13} y={17} textAnchor="end">{unit} · escala ±{n(limit)}</text>
    {options.annotations && <text x={12} y={30}>{selected}</text>}
    {detail.path.slice(0, -1).map(step => <line key={step.barId} x1={x(step.to)} x2={x(step.to)}
      y1={38} y2={94} stroke="#b5c4cd" strokeDasharray="2 3" />)}
    <line x1={x(start)} x2={x(end)} y1={62} y2={62} stroke="#8196a4" />
    {curve.pieces.map(piece => <g key={piece.from}>
      {options.fill && <path d={`${piecePath(piece)}L${x(piece.to)} 62L${x(piece.from)} 62Z`} fill={color} fillOpacity={.15} />}
      <path data-series-segment d={piecePath(piece)} fill="none" stroke={color} strokeWidth={1.75} />
    </g>)}
    {options.zeros && !train && detail.zeros.map(s => <circle key={s} cx={x(s)} cy={62} r={2.4} fill="#557581" />)}
    {options.extremes && peak > 0 && [curve.min, curve.max].map(({ s, value }, i) =>
      <circle key={i} cx={x(s)} cy={y(value)} r={3.1} fill={color}><title>{n(value)} {unit}</title></circle>)}
    {options.jumps && jumps.map(knot => <g key={knot.s} data-series-jump={knot.s}>
      <line x1={x(knot.s)} x2={x(knot.s)} y1={y(knot.left!)} y2={y(knot.right!)} stroke={color} strokeDasharray="2 3" />
      {[knot.left!, knot.right!].map((value, i) => <circle key={i} cx={x(knot.s)} cy={y(value)} r={2.9} fill="white" stroke={color}>
        <title>{i ? 'S+' : 'S−'}: {n(value)} {unit}</title>
      </circle>)}
    </g>)}
    {move && <g data-series-station={position.s}>
      <line x1={x(position.s)} x2={x(position.s)} y1={35} y2={96} stroke="#435c70" strokeDasharray="4 3" />
      <circle cx={x(position.s)} cy={y(ordinate)} r={3.6} fill={color} stroke="white" />
    </g>}
    <text x={x(start)} y={107} textAnchor="middle">{formatResult(start, { decimals })}</text>
    <text x={x(end)} y={107} textAnchor="middle">{formatResult(end, { decimals })} m</text>
    <text x={width / 2} y={107} textAnchor="middle" data-series-value={ordinate}>
      S = {formatResult(position.s, { decimals })} m · {n(ordinate)} {unit}
      {options.extremes && ` · min ${n(curve.min.value)} · max ${n(curve.max.value)}`}
    </text>
  </g>
}

export function InfluenceReference({ model, detail, position, width, supports, dimensions, hinges, decimals }: {
  model: Structure; detail: InfluenceDetail; position: MovingPosition; width: number; supports: boolean;
  dimensions: boolean; hinges: boolean; decimals: number
}) {
  const [start, end] = influenceRange(detail, position.mode)
  const x = (s: number) => plotStation(width, start, end, s)
  const bars = new Map(model.bars.map(bar => [bar.id, bar]))
  const nodes = new Map(model.nodes.map(node => [node.id, node.label]))
  const restraints = new Map(model.supports.map(support => [support.nodeId, support]))
  const joints = [{ id: detail.path[0]!.startId, s: 0 }, ...detail.path.map(step => ({ id: step.endId, s: step.to }))]
  return <g aria-label="Modelo y recorrido desarrollado" fontFamily="Helvetica, sans-serif" fontSize={10} fill="#182b39">
    <rect x={1} y={2} width={width - 2} height={PATH_HEIGHT - 4} rx={5} fill="#f1f6f8" stroke="#c5d4dd" />
    <text x={12} y={18} fontSize={13} fontWeight="bold">Modelo · recorrido desarrollado S (m)</text>
    {detail.path.map(step => {
      const bar = bars.get(step.barId)
      const a = x(step.from), b = x(step.to)
      const firstRelease = step.reversed ? bar?.releaseJ : bar?.releaseI
      const lastRelease = step.reversed ? bar?.releaseI : bar?.releaseJ
      return <g key={step.barId} data-report-member={step.barId}>
        <line x1={a} x2={b} y1={49} y2={49} stroke="#26465b" strokeWidth={2.5} />
        <text x={(a + b) / 2} y={40} textAnchor="middle">{step.barId}</text>
        {hinges && [firstRelease && a + 5, lastRelease && b - 5].map((px, i) => px &&
          <circle key={i} data-report-hinge cx={px} cy={49} r={3.2} fill="white" stroke="#26465b" />)}
        {dimensions && <text x={(a + b) / 2} y={83} textAnchor="middle">{formatResult(step.length, { decimals })} m</text>}
      </g>
    })}
    {joints.map(({ id, s }) => {
      const at = x(s)
      const support = restraints.get(id)
      return <g key={id}>
        <circle cx={at} cy={49} r={1.8} fill="#26465b" />
        <text x={at} y={28} textAnchor="middle">{nodes.get(id)?.slice(0, 12)}</text>
        {supports && support && <g data-report-support={support.kind} fill="none" stroke="#26465b"
          transform={`translate(${at} 49) rotate(${support.kind === 'roller' ? -support.surfaceAngle * 180 / Math.PI : 0})`}>
          <path d={support.kind === 'fixed' ? 'M0 -7v16m-4-2 4-4m-4-1 4-4' : 'M0 1l5 8h-10z'} />
          {support.kind === 'roller' && <><circle cx={-2.7} cy={11} r={1.4} /><circle cx={2.7} cy={11} r={1.4} /><path d="M-6 13h12" /></>}
          {support.kind === 'pinned' && <path d="M-6 10h12" />}
        </g>}
      </g>
    })}
    {position.s >= start && position.s <= end && <line x1={x(position.s)} x2={x(position.s)} y1={34} y2={76}
      stroke="#435c70" strokeDasharray="4 3" data-reference-station={position.s} />}
  </g>
}
