import { useState } from 'react'
import type { CrossDetail } from '../../analysis/cross'
import type { Selection } from '../../domain/structure'
import { ResultTable, resultNumber } from './ResultTable'

export function CrossResults({ detail, learning, select }: {
  detail: CrossDetail; learning: boolean; select: (item: Selection) => void
}) {
  const [step, setStep] = useState(0)
  const iteration = detail.iterations[step - 1]
  const values = iteration?.moments ?? Object.fromEntries(detail.joints.flatMap(joint => joint.ends.map(end => [end.id, end.initial])))
  const ends = detail.joints.flatMap(joint => joint.ends)
  const member = (endId: string) => ends.find(end => end.id === endId)!.barId
  const link = (id: string, kind: 'bar' | 'node', label = id) =>
    <button type="button" className="result-link" onClick={() => select({ kind, id })}>{label}</button>
  return <section className="result-section method-results" aria-label="Distribución de momentos">
    <h3>Distribución de momentos · Hardy Cross</h3>
    <p>Convergió en {detail.iterations.length} barridos. Residuo máximo {resultNumber(detail.residual)} N·m
      {' '}· tolerancia {resultNumber(detail.tolerance)} N·m.</p>
    <p>Comparación con rigideces · momentos {resultNumber(detail.maxMomentError)} N·m · reacciones de fuerza
      {' '}{resultNumber(detail.maxReactionError)} N · giros {resultNumber(detail.maxRotationError)} rad.</p>
    <ResultTable label="Momentos finales de Cross" headings={['Extremo', 'Cross (N·m)', 'Rigideces (N·m)']}
      rows={Object.entries(detail.final).map(([id, moment]) => ({ id, cells: [link(member(id), 'bar', id),
        resultNumber(moment), resultNumber(detail.reference[id])] }))} />
    {learning && <>
      <p>Se distribuyen los desequilibrios en giros libres con rigidez 4EI/L y transporte ½. Los extremos i y j usan el signo local de la acción del nudo sobre la barra, positivo antihorario. Un apoyo articulado no corta la continuidad de las barras que llegan al nudo.</p>
      <p>Se verificó la hipótesis de cuerda sin rotación apreciable. Aporte máximo omitido de cuerda: {resultNumber(detail.maxChordMoment)} N·m. Las traslaciones admisibles provienen del motor elástico compartido; los giros se obtienen por distribución.</p>
      <details className="result-detail">
        <summary>Factores y empotramiento perfecto</summary>
        <ResultTable label="Rigideces y factores de Cross" headings={['Extremo', 'Nudo', 'k (N·m/rad)', 'DF', 'Transporte', 'M inicial (N·m)']}
          rows={ends.map(end => ({ id: end.id, cells: [link(end.barId, 'bar', end.id), link(end.nodeId, 'node'),
            resultNumber(end.stiffness), resultNumber(end.factor), resultNumber(end.carry), resultNumber(end.initial)] }))} />
      </details>
      <div className="result-controls cross-steps">
        <button type="button" className="button secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Barrido anterior</button>
        <label className="result-field">Barrido de Cross<select value={step} onChange={event => setStep(Number(event.target.value))}>
          <option value={0}>0 · Empotramiento perfecto</option>
          {detail.iterations.map(item => <option value={item.sweep} key={item.sweep}>{item.sweep}</option>)}
        </select></label>
        <button type="button" className="button secondary" disabled={step === detail.iterations.length} onClick={() => setStep(step + 1)}>Siguiente barrido</button>
      </div>
      {iteration && <>
        <p>Desequilibrio máximo antes del barrido: {resultNumber(iteration.before)} N·m. Después: {resultNumber(iteration.residual)} N·m.</p>
        <ResultTable label="Distribución y transporte del barrido" headings={['Nudo', 'Extremo', 'Desequilibrio (N·m)', 'Distribuido (N·m)', 'Extremo opuesto', 'Transportado (N·m)']}
          rows={iteration.balances.flatMap(balance => balance.ends.map(end => ({ id: end.id, cells: [
            link(balance.nodeId, 'node'), link(member(end.id), 'bar', end.id), resultNumber(balance.imbalance),
            resultNumber(end.distributed), end.opposite, resultNumber(end.carried),
          ] })))} />
      </>}
      <ResultTable label="Momentos acumulados" headings={['Extremo', 'M (N·m)']}
        rows={Object.entries(values).map(([id, value]) => ({ id, cells: [link(member(id), 'bar', id), resultNumber(value)] }))} />
    </>}
  </section>
}
