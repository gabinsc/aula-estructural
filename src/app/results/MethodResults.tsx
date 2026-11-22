import { useState } from 'react'
import type { ForceMethodDetail } from '../../analysis/forceMethod'
import type { MethodDetail } from '../../analysis/methods'
import type { VirtualWorkDetail } from '../../analysis/virtualWork'
import type { WorkIntegral } from '../../analysis/workIntegral'
import type { Selection, Structure } from '../../domain/structure'
import { EffortDiagram, SystemDiagram } from './MethodGraphics'
import { motionLabel } from './MethodControls'
import { ResultTable, resultNumber } from './ResultTable'
import { CrossResults } from './CrossResults'

interface DetailProps {
  model: Structure
  activeIds: readonly string[]
  learning: boolean
  select: (target: Selection) => void
  selectedBar?: string
}

function WorkTerms({ work, select, unit, fields }: { work: WorkIntegral; select: DetailProps['select']; unit: string; fields?: boolean }) {
  const [barId, setBarId] = useState(work.members[0]?.barId)
  const [index, setIndex] = useState(0)
  const member = work.members.find(item => item.barId === barId) ?? work.members[0]
  const interval = member?.intervals[index] ?? member?.intervals[0]
  if (!member || !interval) return null
  return <>
    <ResultTable label="Trabajo por barra" headings={['Barra', `Axial (${unit})`, `Flexión (${unit})`, `Total (${unit})`]}
      rows={work.members.map(item => ({ id: item.barId, cells: [
        <button type="button" className="result-link" aria-label={`Consultar integral de ${item.barId}`}
          aria-pressed={item.barId === member.barId} onClick={() => {
            setBarId(item.barId)
            setIndex(0)
            select({ kind: 'bar', id: item.barId })
          }}>{item.barId}</button>,
        resultNumber(item.axial), resultNumber(item.flexural), resultNumber(item.axial + item.flexural),
      ] }))} />
    <p className="result-hint">EA = {resultNumber(member.EA)} N{member.EI !== undefined && ` · EI = ${resultNumber(member.EI)} N·m²`}</p>
    <label className="result-field">Intervalo de {member.barId}
      <select value={index} onChange={event => {
        setIndex(Number(event.target.value))
        select({ kind: 'bar', id: member.barId })
      }}>
        {member.intervals.map((item, i) => <option key={i} value={i}>{resultNumber(item.from)}–{resultNumber(item.to)} m</option>)}
      </select>
    </label>
    <p className="result-hint">Aportes del intervalo · axial {resultNumber(interval.axial)} {unit} · flexión {resultNumber(interval.flexural)} {unit}</p>
    {fields && <>
      <div className="method-figures">
        {(['N', ...(member.EI === undefined ? [] : ['M'] as const)] as const).flatMap(field => (['real', 'unit'] as const).map(system =>
          <EffortDiagram key={`${field}-${system}`} interval={interval} system={system} field={field} />))}
      </div>
      <details className="result-detail">
        <summary>Muestras y pesos de integración</summary>
        <ResultTable label="Campos del intervalo" headings={['s (m)', 'Peso (m)', 'N (kN)', 'n (kN)', 'M (kN·m)', 'm (kN·m)']}
          rows={interval.samples.map((item, i) => ({ id: String(i), cells: [resultNumber(item.s), resultNumber(item.weight),
            resultNumber(item.real.N, .001), resultNumber(item.unit.N, .001), resultNumber(item.real.M, .001), resultNumber(item.unit.M, .001)] }))} />
        <p>Los extremos se evalúan desde el interior del tramo. Las curvas interpolan valores numéricos entre estaciones.</p>
      </details>
    </>}
  </>
}

function VirtualResult({ detail, model, activeIds, learning, select, selectedBar }: DetailProps & { detail: VirtualWorkDetail }) {
  const { target, motion } = detail.objective
  const unit = motion.kind === 'rotation' ? 'rad' : 'm'
  const description = target.kind === 'node' ? target.id : `${target.id}, s = ${resultNumber(target.s)} m`
  const component = motion.kind === 'rotation' ? 'Giro +Z' : `Traslación (${resultNumber(motion.direction.x)}, ${resultNumber(motion.direction.y)}) global`
  return <section className="result-section method-results" aria-label="Trabajo virtual">
    <h3>Trabajo virtual / carga unitaria</h3>
    <p>{component} · <button type="button" className="result-link"
      onClick={() => select({ kind: target.kind === 'node' ? 'node' : 'bar', id: target.id })}>{description}</button></p>
    <ResultTable label="Verificación de trabajo virtual" headings={['Integral', 'Referencia de rigidez', 'Error absoluto', 'Error relativo']}
      rows={[{ id: 'total', cells: [`${resultNumber(detail.work.total)} ${unit}`, `${resultNumber(detail.reference)} ${unit}`,
        `${resultNumber(detail.absoluteError)} ${unit}`, detail.relativeError === null ? '— (referencia nula)' : resultNumber(detail.relativeError)] }]} />
    <p>{detail.agrees ? 'Concordancia dentro de la tolerancia.' : 'La integral difiere de la referencia de rigidez.'}</p>
    {learning && <>
      <p className="result-hint">Las acciones internas de ambos sistemas se obtienen con el motor de rigidez compartido.
        La respuesta procede de los productos de campos, bajo elasticidad lineal y cinemática de Euler–Bernoulli.</p>
      <p className="method-equation">δ = Σ ∫ [N·n/(EA) + M·m/(EI)] ds</p>
      <div className="method-figures">
        <SystemDiagram label="Sistema real" model={model} activeIds={activeIds} selectedBar={selectedBar} />
        <SystemDiagram label="Sistema virtual" model={model} action={detail.objective} selectedBar={selectedBar} />
      </div>
      <p className="result-hint">Aportes en {unit}. En armaduras, N·n·L/(EA). En pórticos, cuadratura de Gauss de cuatro puntos por tramo.</p>
      <WorkTerms work={detail.work} unit={unit} fields select={select} />
    </>}
  </section>
}

function ForceResult({ detail, model, activeIds, learning, select, selectedBar }: DetailProps & { detail: ForceMethodDetail }) {
  const [i, setI] = useState(0)
  const [j, setJ] = useState(-1)
  const row = detail.redundants[i] ?? detail.redundants[0]!
  const column = detail.redundants[j]
  const selected = column ?? row
  const cell = column ? detail.flexibility[i]![j]! : detail.delta[i]!
  const max = detail.comparison.maximum
  const motionUnit = row.motion.kind === 'rotation' ? 'rad' : 'm'
  const actionUnit = column?.motion.kind === 'rotation' ? 'N·m' : 'N'
  const cellUnit = column ? `${motionUnit}/(${actionUnit})` : motionUnit
  return <section className="result-section method-results" aria-label="Método de las fuerzas">
    <h3>Método de las fuerzas</h3>
    <ResultTable label="Acciones redundantes recuperadas" headings={['Restricción', 'X', 'Compatibilidad']}
      rows={detail.redundants.map((item, index) => {
        const angular = item.motion.kind === 'rotation'
        return { id: item.id, cells: [
          <button type="button" className="result-link" onClick={() => {
            setI(index)
            select({ kind: 'node', id: item.nodeId })
          }}>{item.id}</button>,
          `${resultNumber(detail.values[index])} ${angular ? 'N·m' : 'N'}`,
          `${resultNumber(detail.compatibility[index])} ${angular ? 'rad' : 'm'}`,
        ] }
      })} />
    <p>{detail.primaryIndeterminacy === 0 ? 'Primaria isostática.' : `Primaria hiperestática de grado ${detail.primaryIndeterminacy} con las liberaciones seleccionadas.`}</p>
    <p>Condición recíproca equilibrada: {resultNumber(detail.reciprocalCondition)}.
      {' '}{detail.comparison.agrees ? 'Concordancia con rigidez.' : 'Diferencias con la referencia de rigidez.'}</p>
    <p className="result-hint">Diferencias máximas · {resultNumber(max.length)} m · {resultNumber(max.rotation)} rad
      {' '}· {resultNumber(max.force)} N · {resultNumber(max.moment)} N·m.</p>
    {learning && <>
      <ol className="method-steps">
        <li>Libera temporalmente las restricciones seleccionadas y verifica la estabilidad de la primaria.</li>
        <li>Resuelve el caso real y cada carga unitaria en la primaria con el motor elástico compartido.</li>
        <li>Integra los productos de campos para obtener Δ₀ y f. Resuelve compatibilidad mediante Cholesky equilibrado.</li>
        <li>Aplica X a la primaria junto con las cargas reales. Reincorpora X como reacciones y verifica equilibrio y compatibilidad.</li>
      </ol>
      <p className="method-equation">f·X = −Δ₀</p>
      <p className="result-hint">Máxima asimetría de Maxwell–Betti normalizada: {resultNumber(detail.symmetryError)}.
        Residuo relativo del sistema equilibrado: {resultNumber(detail.backwardError)}.</p>
      <ResultTable label="Matriz de flexibilidad" headings={['Fila', ...detail.redundants.map(item => item.id), 'Δ₀']}
        rows={detail.flexibility.map((values, index) => ({ id: detail.redundants[index]!.id, cells: [
          detail.redundants[index]!.id,
          ...values.map((work, k) => <button key={k} type="button" className="result-link"
            aria-label={`Consultar coeficiente ${index + 1}, ${k + 1}`} onClick={() => { setI(index); setJ(k) }}>{resultNumber(work.total)}</button>),
          <button type="button" className="result-link" aria-label={`Consultar Δ₀ de ${detail.redundants[index]!.id}`}
            onClick={() => { setI(index); setJ(-1) }}>{resultNumber(detail.delta[index]!.total)}</button>,
        ] }))} />
      <p className="result-hint">Respuesta de {row.id} en {motionUnit}.
        {column && ` Columna ${column.id}: acción unitaria de 1 ${actionUnit}. Coeficiente en ${cellUnit}.`}</p>
      <div className="method-figures">
        <SystemDiagram label="Primaria con cargas reales" model={model} activeIds={activeIds} primary={detail.primary} selectedBar={selectedBar} />
        <SystemDiagram label={`Unitario ${selected.id} · ${motionLabel(selected)}`} model={model} primary={detail.primary}
          selectedBar={selectedBar} action={{ target: { kind: 'node', id: selected.nodeId }, motion: selected.motion }} />
      </div>
      <WorkTerms key={`${i}:${j}`} work={cell} unit={cellUnit} select={select} />
    </>}
  </section>
}

export function MethodResults({ detail, ...props }: DetailProps & { detail: Exclude<MethodDetail, { kind: 'influence' }> }) {
  if (detail.kind === 'cross') return <CrossResults detail={detail} learning={props.learning} select={props.select} />
  return detail.kind === 'virtual' ? <VirtualResult detail={detail} {...props} />
    : <ForceResult detail={detail} {...props} />
}
