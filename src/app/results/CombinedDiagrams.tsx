import { useMemo, useState } from 'react'
import { evaluateFrameSection } from '../../analysis'
import { EFFORTS } from '../../modeler/results/diagramFields'
import type { Effort, SectionCut } from '../../modeler/results/diagramFields'
import { effortCurve, EFFORT_UNIT, jumpAt } from '../../modeler/results/diagramModel'
import type { DiagramModel } from '../../modeler/results/diagramModel'
import { developedSpan, developedStation, developedValue, jointJumps, localStation } from '../../modeler/results/developedSpan'
import type { DevelopedMember } from '../../modeler/results/developedSpan'
import { resultNumber } from './ResultTable'

const START = 88
const END = 695
const PLOT_HALF = 33
const BASES = { N: 134, V: 232, M: 330 } as const
const NAMES = { N: 'Axial', V: 'Cortante', M: 'Momento' } as const

function signed(value: number, scale = 1) {
  if (Math.abs(value) < 64 * Number.EPSILON * scale) return '0'
  return `${value > 0 ? '+' : ''}${resultNumber(value, .001)}`
}

function Band({ field, steps, max, x, labels, selectedId }: {
  field: Effort; steps: readonly DevelopedMember[]; max: number; x: (s: number) => number; labels: boolean; selectedId: string
}) {
  const baseline = BASES[field]
  const applies = field === 'N' || steps.some(({ member }) => !!member.fields)
  const ordinate = (step: DevelopedMember, value: number) => max > 0 ? PLOT_HALF * (developedValue(step, field, value) / max) : 0
  const marks: { x: number; y: number; label: string; event: string }[] = []
  if (labels) {
    const candidates = steps.flatMap(step => step.member.fields?.marks[field].map(mark => ({ step, ...mark })) ?? [])
    candidates.sort((a, b) => Number(b.kind === 'jump') - Number(a.kind === 'jump') ||
      Number(b.kind === 'critical') - Number(a.kind === 'critical') || Math.abs(b.section[field]) - Math.abs(a.section[field]))
    for (const { step, section, kind } of candidates) {
      const px = x(developedStation(step, section.s)), py = baseline - ordinate(step, section[field])
      if (marks.length >= 10 || marks.some(mark => Math.abs(mark.x - px) < 47 && Math.abs(mark.y - py) < 16)) continue
      marks.push({ x: px, y: py, label: signed(developedValue(step, field, section[field]), max), event: kind })
    }
  }
  return <g data-avm-band={field} data-effort={field} aria-label={`${NAMES[field]} ${field} en ${EFFORT_UNIT[field]}`}>
    <rect className="avm-band-bg" x={2} width={716} y={baseline - 47} height={94} rx={4} />
    <text className="avm-band-title" x={12} y={baseline - 16}>{field} · {NAMES[field]}</text>
    <text className="avm-band-unit" x={12} y={baseline + 16}>{EFFORT_UNIT[field]}</text>
    {applies && <>
      <line className="avm-band-axis" x1={START} y1={baseline} x2={END} y2={baseline} />
      <text className="avm-band-unit" x={START - 5} y={baseline + 4} textAnchor="end">0</text>
      {max > 0 && [-1, 1].map(sign => <g key={sign}>
        <line className="avm-band-grid" x1={START} y1={baseline - sign * PLOT_HALF} x2={END} y2={baseline - sign * PLOT_HALF} />
        <text className="avm-band-unit" x={START - 5} y={baseline - sign * PLOT_HALF + 4} textAnchor="end">{signed(sign * max, max)}</text>
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
      const h = (value: number) => baseline - (max > 0 ? PLOT_HALF * value / max : 0)
      return <line key={nodeId} className={left.member.id === selectedId ? 'avm-band-curve selected' : 'avm-band-curve'}
        data-avm-joint-jump={nodeId} x1={px} x2={px} y1={h(before)} y2={h(after)} />
    })}
    {marks.map((mark, i) => <g key={i} className="avm-band-mark" data-event={mark.event}>
      <circle cx={mark.x} cy={mark.y} r={2.4} />
      <text x={Math.max(START + 13, Math.min(END - 13, mark.x))} y={mark.y - 4} textAnchor="middle">{mark.label}</text>
    </g>)}
  </g>
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

export function CombinedDiagrams({ diagram, selectedId, cut, onCut, labels, learning }: {
  diagram: DiagramModel; selectedId?: string; cut?: SectionCut; onCut: (cut: SectionCut) => void; labels: boolean; learning: boolean
}) {
  const selected = diagram.members.find(item => item.id === selectedId) ?? diagram.members[0]
  const [develop, setDevelop] = useState(true)
  const span = useMemo(() => selected ? developedSpan(selected, diagram.members) : [], [selected, diagram.members])
  if (!selected) return null
  const steps = develop && span.length > 1 ? span : [{ member: selected, from: 0, to: selected.length, reversed: false }]
  const length = steps.at(-1)!.to
  const x = (s: number) => START + (END - START) * (s / length)
  const active = steps.find(step => step.member.id === cut?.barId)
  const position = cut && active ? developedStation(active, cut.s) : undefined
  const hasTruss = steps.some(step => !step.member.fields)
  const hasReversed = steps.some(step => step.reversed)

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

  return <section className="result-section avm-bands" aria-label="Diagramas AVM separados">
    <div className="avm-bands-header">
      <h3>Diagramas AVM</h3>
      <label className="result-field">Barra en franjas
        <select value={selected.id} onChange={event => onCut({ barId: event.target.value, s: 0, side: 'right', source: 'chart' })}>
          {diagram.members.map(member => <option key={member.id}>{member.id}</option>)}
        </select>
      </label>
    </div>
    {span.length > 1 && <label className="avm-develop-option"><input type="checkbox" checked={develop}
      onChange={event => setDevelop(event.target.checked)} />Desarrollar viga continua</label>}
    <svg className="avm-bands-chart" viewBox="0 0 720 401" role="img" aria-label="Geometría y tres franjas de esfuerzos alineadas"
      onClick={event => {
        const svg = event.currentTarget
        const matrix = svg.getScreenCTM()
        if (!matrix) return
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
        if (point.x >= START - 6 && point.x <= END + 6) pick((point.x - START) / (END - START) * length)
      }}>
      <g data-avm-band="geometry">
        <rect className="avm-band-bg" x={2} width={716} y={5} height={78} rx={4} />
        <text className="avm-band-title" x={12} y={26}>Referencia</text>
        <text className="avm-band-unit" x={12} y={42}>{steps.length > 1 ? 'S (m)' : 's (m)'}</text>
        {steps.map(step => <g key={step.member.id} data-reference-bar={step.member.id}
          className={step.member.id === selected.id ? 'avm-reference selected' : 'avm-reference'}>
          <line x1={x(step.from)} x2={x(step.to)} y1={46} y2={46} />
          <circle cx={x(step.from)} cy={46} r={3} /><circle cx={x(step.to)} cy={46} r={3} />
          <text x={x((step.from + step.to) / 2)} y={35} textAnchor="middle">{step.member.id}</text>
        </g>)}
        {[0, ...steps.map(step => step.to)].map((s, i) => <text className="avm-band-unit" key={i} x={x(s)} y={71} textAnchor="middle">
          {resultNumber(s)}
        </text>)}
      </g>
      {EFFORTS.map(field => <Band key={field} field={field} steps={steps} max={diagram.maxima[field]} x={x} labels={labels}
        selectedId={selected.id} />)}
      {steps.slice(0, -1).map(step => <line key={step.member.id} className="avm-band-joint" x1={x(step.to)} x2={x(step.to)} y1={80} y2={377} />)}
      {position !== undefined && <line className="avm-band-guide" data-station-guide={position} x1={x(position)} x2={x(position)} y1={18} y2={378} />}
      <text className="avm-band-unit" x={END} y={391} textAnchor="end">{steps.length > 1 ? 'S · distancia desarrollada (m)' : 's · estación local (m)'}</text>
    </svg>
    <label className="avm-band-station">Estación en las franjas
      <input type="range" min={0} max={length} step="any" value={position ?? 0} onChange={event => pick(Number(event.target.value))} />
      <span>{resultNumber(position ?? 0)} m</span>
    </label>
    {steps.length === 1 && <p className="result-hint">{selected.startId} → {selected.endId} · {resultNumber(Math.atan2(selected.tangent.y,
      selected.tangent.x) * 180 / Math.PI)}° en el CAD</p>}
    {hasTruss && <p className="result-hint">V y M no aplican a armaduras axiales.</p>}
    {hasReversed && <p className="result-hint">M sigue el eje del desarrollo. La tabla conserva los ejes locales de cada barra.</p>}
    {cut && active && position !== undefined && <ChartReadout step={active} cut={cut} s={position} learning={learning} diagram={diagram}
      developed={steps.length > 1} />}
  </section>
}
