import { useEffect, useMemo, useRef, useState } from 'react'
import type { Structure } from '../../domain/structure'
import { SupportSymbol } from '../../modeler/canvas/SupportSymbol'
import { formatResult } from '../../modeler/format'
import { evaluateFrameSection } from '../../analysis'
import { EFFORTS } from '../../modeler/results/diagramFields'
import type { Effort, SectionCut } from '../../modeler/results/diagramFields'
import { effortCurve, EFFORT_UNIT, jumpAt } from '../../modeler/results/diagramModel'
import type { AVMPreferences, AVMPresentation, DiagramModel } from '../../modeler/results/diagramModel'
import { automaticPresentation, developedSpan, developedStation, developedValue, jointJumps, localStation } from '../../modeler/results/developedSpan'
import type { DevelopedMember } from '../../modeler/results/developedSpan'
import { resultNumber } from './ResultTable'

const START = 88
const END = 695
const PLOT_HALF = 33
const BASES = { N: 134, V: 232, M: 330 } as const
const NAMES = { N: 'Axial', V: 'Cortante', M: 'Momento' } as const

function signed(value: number, scale = 1, decimals = 2) {
  const number = formatResult(value, { scale: .001, reference: scale, decimals })
  return value > 0 && number !== '0' ? `+${number}` : number
}

function Band({ field, steps, max, x, labels, selectedId, decimals, row = BASES[field], amplitude = 1, events,
  width = 720, height = 98 }: {
  field: Effort; steps: readonly DevelopedMember[]; max: number; x: (s: number) => number; labels: boolean; selectedId: string
  decimals: number; row?: number; amplitude?: number; events: { extremes: boolean; zeros: boolean; jumps: boolean }
  width?: number; height?: number
}) {
  const baseline = row
  const left = x(0), right = x(steps.at(-1)!.to)
  const applies = field === 'N' || steps.some(({ member }) => !!member.fields)
  const ordinate = (step: DevelopedMember, value: number) => max > 0 ?
    PLOT_HALF * amplitude * (developedValue(step, field, value) / max) : 0
  const marks: { x: number; y: number; label: string; event: string }[] = []
  if (labels) {
    const candidates = steps.flatMap(step => step.member.fields?.marks[field].map(mark => ({ step, ...mark })) ?? [])
    candidates.sort((a, b) => Number(b.kind === 'jump') - Number(a.kind === 'jump') ||
      Number(b.kind === 'critical') - Number(a.kind === 'critical') || Math.abs(b.section[field]) - Math.abs(a.section[field]))
    for (const { step, section, kind } of candidates) {
      if ((kind === 'critical' && !events.extremes) || (kind === 'jump' && !events.jumps) ||
        (kind === 'zero' && !events.zeros)) continue
      const px = x(developedStation(step, section.s)), py = baseline - ordinate(step, section[field])
      if (marks.length >= 10 || marks.some(mark => Math.abs(mark.x - px) < 47 && Math.abs(mark.y - py) < 16)) continue
      const value = developedValue(step, field, section[field])
      const label = formatResult(value, { scale: .001, reference: max, decimals })
      marks.push({ x: px, y: py, label: value > 0 && label !== '0' ? `+${label}` : label, event: kind })
    }
  }
  return <g data-avm-band={field} data-effort={field} aria-label={`${NAMES[field]} ${field} en ${EFFORT_UNIT[field]}`}>
    <rect className="avm-band-bg" x={2} width={width - 4} y={baseline - height / 2 + 2} height={height - 4} rx={4} />
    <text className="avm-band-title" x={12} y={baseline - 16}>{width < 400 ? field : `${field} · ${NAMES[field]}`}</text>
    <text className="avm-band-unit" x={12} y={baseline + 16}>{EFFORT_UNIT[field]}</text>
    {applies && <>
      <line className="avm-band-axis" x1={left} y1={baseline} x2={right} y2={baseline} />
      <text className="avm-band-unit" x={left - 5} y={baseline + 4} textAnchor="end">0</text>
      {max > 0 && [-1, 1].map(sign => <g key={sign}>
        <line className="avm-band-grid" x1={left} y1={baseline - sign * PLOT_HALF} x2={right} y2={baseline - sign * PLOT_HALF} />
        <text className="avm-band-unit" x={left - 5} y={baseline - sign * PLOT_HALF + 4} textAnchor="end">
          {signed(sign * max / amplitude, max, decimals)}</text>
      </g>)}
    </>}
    {steps.map(step => {
      const d = effortCurve(step.member, field, value => ordinate(step, value),
        (s, h) => ({ x: x(developedStation(step, s)), y: baseline - h }), max)
      return d ? <path key={step.member.id} data-band-bar={step.member.id} d={d}
        className={step.member.id === selectedId ? 'avm-band-curve selected' : 'avm-band-curve'} />
        : <g key={step.member.id}>
          <rect className="avm-band-na" x={x(step.from)} width={x(step.to) - x(step.from)} y={baseline - 13} height={26} />
          <title>{step.member.id} · {field} no aplica a armaduras</title>
          {x(step.to) - x(step.from) > 95 && <text className="avm-band-unit" x={x((step.from + step.to) / 2)} y={baseline + 4}
            textAnchor="middle">No aplica</text>}
        </g>
    })}
    {jointJumps(steps, field, max).map(({ nodeId, S, left, before, after }) => {
      const px = x(S)
      const h = (value: number) => baseline - (max > 0 ? PLOT_HALF * amplitude * value / max : 0)
      return <line key={nodeId} className={left.member.id === selectedId ? 'avm-band-curve selected' : 'avm-band-curve'}
        data-avm-joint-jump={nodeId} x1={px} x2={px} y1={h(before)} y2={h(after)} />
    })}
    {marks.map((mark, i) => <g key={i} className="avm-band-mark" data-event={mark.event}>
      <circle cx={mark.x} cy={mark.y} r={2.4} />
      <text x={Math.max(left + 13, Math.min(right - 13, mark.x))} y={mark.y - 4} textAnchor="middle">{mark.label}</text>
    </g>)}
  </g>
}

function CompactGeometry({ model, diagram, selectedId, select }: {
  model: Structure; diagram: DiagramModel; selectedId: string; select: (barId: string) => void
}) {
  const bounds = diagram.members.flatMap(({ start, end }) => [start, end])
  const minX = Math.min(...bounds.map(p => p.x)), minY = Math.min(...bounds.map(p => p.y))
  const width = Math.max(...bounds.map(p => p.x)) - minX, height = Math.max(...bounds.map(p => p.y)) - minY
  const k = Math.min(236 / (width || 1), 115 / (height || 1))
  const x = (value: number) => 145 + ((value - minX) - width / 2) * k
  const y = (value: number) => 82 - ((value - minY) - height / 2) * k
  return <svg className="avm-compact-model" viewBox="0 0 290 163" role="img" aria-label="Modelo estructural de referencia">
    <rect className="avm-band-bg" x={1} y={1} width={288} height={161} rx={4} />
    {diagram.members.map(({ id, start, end }) => <g key={id} data-compact-member={id} data-reference-bar={id === selectedId ? id : undefined}
      className={id === selectedId ? 'avm-reference selected' : 'avm-reference'} onClick={() => select(id)}>
      <line x1={x(start.x)} y1={y(start.y)} x2={x(end.x)} y2={y(end.y)} />
      <text x={(x(start.x) + x(end.x)) / 2 + 4} y={(y(start.y) + y(end.y)) / 2 - 6}>{id}</text>
    </g>)}
    {model.nodes.map(node => <circle key={node.id} cx={x(node.x)} cy={y(node.y)} r={2.5} className="avm-reference-node" />)}
  </svg>
}

function ChartReadout({ step, cut, s, learning, diagram, developed }: {
  step: DevelopedMember; cut: SectionCut; s: number; learning: boolean; diagram: DiagramModel; developed: boolean
}) {
  const { member } = step
  const frame = member.bar.kind === 'frame2d' ? member.bar : undefined
  const jump = member.fields?.jumps.has(cut.s)
  const section = frame && evaluateFrameSection(frame, cut.s, cut.side)
  const sides = frame && jump ? (step.reversed ? ['right', 'left'] as const : ['left', 'right'] as const)
    .map(side => evaluateFrameSection(frame, cut.s, side)) : undefined
  const contributors = frame?.loads.filter(load => load.kind === 'point' ? load.s <= cut.s : load.s0 < cut.s)
  return <output className="avm-band-readout" aria-label="Consulta en las franjas">
    <strong>{member.id} · s = {resultNumber(cut.s)} m{step.from !== 0 || step.reversed ? ` · S = ${resultNumber(s)} m` : ''}</strong>
    <span>{EFFORTS.map(field => {
      const value = (number: number) => signed(developedValue(step, field, number), diagram.maxima[field])
      const joint = developed ? jumpAt(diagram, field, cut.barId, cut.s) : undefined
      if (joint) return `${field} izq. ${signed(joint.before, diagram.maxima[field])} / der. ${signed(joint.after, diagram.maxima[field])} ${EFFORT_UNIT[field]}`
      if (!section && field !== 'N') return `${field} no aplica`
      if (sides) return `${field} izq. ${value(sides[0]![field])} / der. ${value(sides[1]![field])} ${EFFORT_UNIT[field]}`
      return `${field} ${value(section?.[field] ?? member.bar.axialForce)} ${EFFORT_UNIT[field]}`
    }).join(' · ')}</span>
    {learning && <small>{frame ? jump ? 'Salto de N y V por la fuerza puntual. M es continuo.'
      : 'N′ = −qx, V′ = qy, M′ = V en los ejes locales.' : 'Axial constante en la armadura.'}
      {!!contributors?.length && ` Cargas hasta el corte local ${contributors.map(load => load.id).join(', ')}.`}</small>}
  </output>
}

export function CombinedDiagrams({ diagram, model, selectedId, cut, onCut, preferences, learning, setPresentation }: {
  diagram: DiagramModel; model: Structure; selectedId?: string; cut?: SectionCut; onCut: (cut: SectionCut) => void
  preferences: AVMPreferences; learning: boolean; setPresentation: (value: AVMPresentation) => void
}) {
  const { presentation, labels, decimals } = preferences
  const selected = diagram.members.find(item => item.id === selectedId) ?? diagram.members[0]
  const [develop, setDevelop] = useState(true)
  const [order, setOrder] = useState<readonly Effort[]>(EFFORTS)
  const [hidden, setHidden] = useState<readonly Effort[]>([])
  const [events, setEvents] = useState({ extremes: true, zeros: true, jumps: true })
  const [scales, setScales] = useState({ N: 1, V: 1, M: 1 })
  const [heights, setHeights] = useState({ N: 98, V: 98, M: 98 })
  const panel = useRef<HTMLElement>(null)
  const [narrowPanel, setNarrowPanel] = useState(false)
  useEffect(() => {
    const element = panel.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setNarrowPanel(entry.contentRect.width <= 470)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const span = useMemo(() => selected ? developedSpan(selected, diagram.members) : [], [selected, diagram.members])
  if (!selected) return null
  const layout = presentation === 'auto' ? automaticPresentation(diagram.members) : presentation
  const steps = layout === 'developed' && develop && span.length > 1 ? span
    : [{ member: selected, from: 0, to: selected.length, reversed: false }]
  const length = steps.at(-1)!.to
  const x = (s: number) => START + (END - START) * (s / length)
  const compactX = (s: number) => 55 + 164 * s / length
  const active = steps.find(step => step.member.id === cut?.barId)
  const position = cut && active ? developedStation(active, cut.s) : undefined
  const hasTruss = steps.some(step => !step.member.fields)
  const hasReversed = steps.some(step => step.reversed)
  const barById = new Map(model.bars.map(bar => [bar.id, bar]))
  const plottedLoads = preferences.loads ? model.loads.filter(load => diagram.activeLoadIds.has(load.id)) : []
  const visible = order.filter(field => !hidden.includes(field))
  const placed = visible.reduce<{ field: Effort; y: number }[]>((rows, field) => {
    rows.push({ field, y: rows.length ? rows.at(-1)!.y + heights[rows.at(-1)!.field] : 0 })
    return rows
  }, [])
  const endY = 83 + visible.reduce((sum, field) => sum + heights[field], 0)
  const selectBar = (id: string) => onCut({ barId: id, s: 0, side: 'right', source: 'chart' })

  function pick(station: number) {
    const s = Math.max(0, Math.min(length, station))
    const touching = steps.filter(step => s >= step.from && s <= step.to)
    const step = touching.find(item => item.member.id === selected?.id) ?? touching[0]
    if (!step) return
    const raw = localStation(step, s)
    let local = raw
    let tolerance = 7 * length / (END - START)
    for (const event of step.member.fields?.stations ?? [0, step.member.length]) {
      const distance = Math.abs(raw - event)
      if (distance <= tolerance) { local = event; tolerance = distance }
    }
    onCut({ barId: step.member.id, s: local, side: local === step.member.length ? 'left' : 'right', source: 'chart' })
  }

  function chartClick(event: React.MouseEvent<SVGSVGElement>, start = START, end = END) {
    const matrix = event.currentTarget.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    if (point.x >= start - 6 && point.x <= end + 6) pick((point.x - start) / (end - start) * length)
  }
  const band = (field: Effort, row: number, narrow = false) => <Band field={field} steps={steps} max={diagram.maxima[field]}
    x={narrow ? compactX : x} labels={labels} selectedId={selected.id} decimals={decimals} row={row} amplitude={scales[field]}
    events={{ ...events, extremes: events.extremes && preferences.extremes }} width={narrow ? 235 : 720} height={heights[field]} />
  const guide = (begin: number, end: number, positionX = x) => position !== undefined && <line className="avm-band-guide"
    data-station-guide={position} x1={positionX(position)} x2={positionX(position)} y1={begin} y2={end} />
  return <section ref={panel} className="result-section avm-bands" aria-label="Diagramas AVM separados" data-avm-presentation={layout}>
    <div className="avm-bands-header">
      <h3>Diagramas AVM</h3>
      <label className="result-field">Barra en franjas
        <select value={selected.id} onChange={event => selectBar(event.target.value)}>
          {diagram.members.map(member => <option key={member.id}>{member.id}</option>)}
        </select>
      </label>
    </div>
    <label className="result-field">Presentación AVM<select value={presentation}
      onChange={event => setPresentation(event.target.value as AVMPresentation)}>
      <option value="auto">Automática</option><option value="developed">Desarrollada</option><option value="compact">Compacta</option>
    </select></label>
    <details className="result-detail"><summary>Configurar franjas</summary>
      <div className="result-controls">{(['extremes', 'zeros', 'jumps'] as const).map((key, i) =>
        <label key={key}><input type="checkbox" checked={events[key]} onChange={event => setEvents({ ...events, [key]: event.target.checked })} />
          {['Extremos', 'Ceros', 'Saltos'][i]}</label>)}</div>
      {order.map((field, i) => <div className="result-controls avm-band-controls" key={field}>
        <label><input type="checkbox" checked={!hidden.includes(field)} onChange={() =>
          setHidden(old => old.includes(field) ? old.filter(item => item !== field) : [...old, field])} /> {field}</label>
        <button className="button secondary" type="button" aria-label={`Subir franja ${field}`} disabled={i === 0}
          onClick={() => setOrder(order.map((item, index) => index === i - 1 ? field : index === i ? order[i - 1]! : item))}>↑</button>
        <label className="result-field">Escala {field}<input type="range" min=".25" max="1" step=".05" value={scales[field]}
          onChange={event => setScales({ ...scales, [field]: Number(event.target.value) })} /></label>
        <label className="result-field">Altura {field}<input type="range" min="98" max="175" value={heights[field]}
          onChange={event => setHeights({ ...heights, [field]: Number(event.target.value) })} /></label>
      </div>)}
    </details>
    {layout === 'developed' && span.length > 1 && <label className="avm-develop-option"><input type="checkbox" checked={develop}
      onChange={event => setDevelop(event.target.checked)} />Desarrollar viga continua</label>}
    {layout === 'developed' ? <svg className="avm-bands-chart" viewBox={`0 0 720 ${endY + 24}`} role="img"
      aria-label="Geometría y tres franjas de esfuerzos alineadas" onClick={event => chartClick(event)}>
      <g data-avm-band="geometry">
        <rect className="avm-band-bg" x={2} width={716} y={5} height={78} rx={4} />
        <text className="avm-band-title" x={12} y={26}>Referencia</text>
        <text className="avm-band-unit" x={12} y={42}>{steps.length > 1 ? 'S (m)' : 's (m)'}</text>
        {steps.map(step => <g key={step.member.id} data-reference-bar={step.member.id}
          className={step.member.id === selected.id ? 'avm-reference selected' : 'avm-reference'}>
          <line x1={x(step.from)} x2={x(step.to)} y1={46} y2={46} />
          <circle cx={x(step.from)} cy={46} r={3} /><circle cx={x(step.to)} cy={46} r={3} />
          {preferences.ids && <text x={x((step.from + step.to) / 2)} y={35} textAnchor="middle">{step.member.id}</text>}
          {([[barById.get(step.member.id)?.releaseI, 0, 'i'],
            [barById.get(step.member.id)?.releaseJ, step.member.length, 'j']] as const).map(([released, s, end]) =>
            released && <circle className="member-release" key={end} cx={x(developedStation(step, s))} cy={46} r={4.2} />)}
          {plottedLoads.map(load => {
            if (load.kind === 'nodal' || load.barId !== step.member.id) return null
            const at = (s: number) => x(developedStation(step, s))
            return load.kind === 'point'
              ? <path key={load.id} className="avm-band-guide" d={`M${at(load.s)} 19v24m-3-5 3 5 3-5`}><title>{load.id}</title></path>
              : <path key={load.id} className="avm-band-guide" d={`M${at(load.s0)} 43V20H${at(load.s1)}V43`}><title>{load.id}</title></path>
          })}
        </g>)}
        {model.supports.map(support => {
          const step = steps.find(({ member }) => [member.startId, member.endId].includes(support.nodeId))
          if (!step) return null
          const s = step.member.startId === support.nodeId ? 0 : step.member.length
          return <g key={support.nodeId} transform={`translate(${x(developedStation(step, s))} 46) scale(.55)`}>
            <SupportSymbol support={support} point={{ x: 0, y: 0 }} preview />
          </g>
        })}
        {plottedLoads.map(load => {
          if (load.kind !== 'nodal') return null
          const step = steps.find(({ member }) => [member.startId, member.endId].includes(load.nodeId))
          if (!step) return null
          const px = x(developedStation(step, step.member.startId === load.nodeId ? 0 : step.member.length))
          return <g key={load.id} className="avm-reference-load" data-reference-load={load.id}>
            <title>{load.id} · estación de carga nodal</title>
            <circle cx={px} cy={18} r={3} />
            <line x1={px} x2={px} y1={22} y2={42} className="avm-band-guide" />
          </g>
        })}
        {[0, ...steps.map(step => step.to)].map((s, i) => <text className="avm-band-unit" key={i} x={x(s)} y={71} textAnchor="middle">
          {resultNumber(s)}
        </text>)}
      </g>
      {placed.map(({ field, y }) => <g key={field}>{band(field, 85 + y + heights[field] / 2)}</g>)}
      {steps.slice(0, -1).map(step => <line key={step.member.id} className="avm-band-joint" x1={x(step.to)} x2={x(step.to)} y1={80} y2={endY} />)}
      {guide(18, endY + 1)}
      <text className="avm-band-unit" x={END} y={endY + 14} textAnchor="end">{steps.length > 1 ? 'S · distancia desarrollada (m)' : 's · estación local (m)'}</text>
    </svg> : <div className="avm-compact">
      <CompactGeometry model={model} diagram={diagram} selectedId={selected.id} select={selectBar} />
      {visible.map(field => {
        const narrow = field !== 'M' || narrowPanel
        return <svg className={`avm-compact-${field}`} key={field} viewBox={`0 0 ${narrow ? 235 : 720} ${heights[field]}`}
          role="img" aria-label={`${NAMES[field]} de ${selected.id} en ${EFFORT_UNIT[field]}`}
          onClick={event => narrow ? chartClick(event, 55, 219) : chartClick(event)}>
          {band(field, heights[field] / 2, narrow)}{guide(3, heights[field] - 3, narrow ? compactX : x)}
        </svg>
      })}
    </div>}
    <label className="avm-band-station">Estación en las franjas
      <input type="range" min={0} max={length} step="any" value={position ?? 0} onChange={event => pick(Number(event.target.value))} />
      <span>{resultNumber(position ?? 0)} m</span>
    </label>
    {cut && active && <label className="result-field">Lado en el corte AVM
      <select value={cut.side} onChange={event => onCut({ ...cut, side: event.target.value === 'left' ? 'left' : 'right' })}>
        <option value="left">Izquierdo</option><option value="right">Derecho</option>
      </select></label>}
    {steps.length === 1 && <p className="result-hint">{selected.startId} → {selected.endId} · {resultNumber(Math.atan2(selected.tangent.y,
      selected.tangent.x) * 180 / Math.PI)}° en el CAD</p>}
    {hasTruss && <p className="result-hint">V y M no aplican a armaduras axiales.</p>}
    {hasReversed && <p className="result-hint">M sigue el eje del desarrollo. La tabla conserva los ejes locales de cada barra.</p>}
    {cut && active && position !== undefined && <ChartReadout step={active} cut={cut} s={position} learning={learning} diagram={diagram}
      developed={steps.length > 1} />}
  </section>
}
