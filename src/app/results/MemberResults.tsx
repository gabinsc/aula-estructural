import { useEffect, useState } from 'react'
import { evaluateFrameSection } from '../../analysis'
import type { AnalysisResult, FrameResult } from '../../analysis'
import { ResultTable, resultNumber } from './ResultTable'
import type { SectionCut } from '../../modeler/results/diagramFields'

type Bars = Extract<AnalysisResult, { ok: true }>['bars']

export function MemberResults({ bars, selectedId, select, cut, onCut }: {
  bars: Bars
  selectedId?: string
  select: (id: string) => void
  cut?: SectionCut
  onCut: (cut: SectionCut) => void
}) {
  const bar = bars.find(item => item.barId === selectedId) ?? bars[0]
  return bar && <section className="result-section">
    <h3>Esfuerzos por barra</h3>
    <label className="result-field">Barra de resultados
      <select value={bar.barId} onChange={event => select(event.target.value)}>
        {bars.map(item => <option key={item.barId}>{item.barId}</option>)}
      </select>
    </label>
    <button className="button secondary" type="button" onClick={() => select(bar.barId)}>Resaltar {bar.barId} en el modelo</button>
    {bar.kind === 'frame2d' ? <FrameDetails key={bar.barId} bar={bar} cut={cut} onCut={onCut} /> : <>
      <p className="result-hint">Armadura 2D · {bar.axialForce > 0 ? 'Tracción' : bar.axialForce < 0 ? 'Compresión' : 'Axial nulo'}</p>
      <dl className="result-facts">
        <div><dt>N (kN)</dt><dd>{resultNumber(bar.axialForce, .001)}</dd></div>
        <div><dt>Variación de longitud (mm)</dt><dd>{resultNumber(bar.elongation, 1000)}</dd></div>
      </dl>
    </>}
  </section>
}

function FrameDetails({ bar, cut, onCut }: { bar: FrameResult; cut?: SectionCut; onCut: (cut: SectionCut) => void }) {
  const initial = cut?.barId === bar.barId ? cut : undefined
  const [station, setStation] = useState(initial ? String(initial.s) : '0')
  const [side, setSide] = useState<'left' | 'right'>(initial?.side ?? 'right')
  useEffect(() => {
    if (!cut || cut.source === 'table' || cut.barId !== bar.barId) return
    setStation(String(cut.s))
    setSide(cut.side)
  }, [bar.barId, cut])
  const s = station.trim() ? Number(station.replace(',', '.')) : NaN
  let section: ReturnType<typeof evaluateFrameSection> | undefined
  if (s >= 0 && s <= bar.length) {
    try { section = evaluateFrameSection(bar, s, side) }
    catch (cause) { if (!(cause instanceof RangeError)) throw cause }
  }
  function link(s: number, side: SectionCut['side']) {
    if (s >= 0 && s <= bar.length) onCut({ barId: bar.barId, s, side, source: 'table' })
  }
  return <>
    <p className="result-hint">Pórtico 2D · acciones de extremo positivas según los ejes locales.</p>
    <ResultTable label="Acciones locales de extremo" headings={['Extremo', 'Fx′ (kN)', 'Fy′ (kN)', 'Mz (kN·m)']}
      rows={['Inicial', 'Final'].map((label, i) => ({
        id: label, cells: [label, ...bar.endForces.slice(i * 3, i * 3 + 3).map(value => resultNumber(value, .001))],
      }))} />
    <h4>Sección interior</h4>
    <div className="result-controls">
      <label className="result-field">Estación s (m)
        <input value={station} inputMode="decimal" onChange={event => setStation(event.target.value)}
          onBlur={() => link(s, side)} onKeyDown={event => { if (event.key === 'Enter') link(s, side) }} />
      </label>
      <label className="result-field">Lado del corte
        <select value={side} onChange={event => {
          const next = event.target.value === 'left' ? 'left' : 'right'
          setSide(next)
          link(s, next)
        }}>
          <option value="right">Derecho</option><option value="left">Izquierdo</option>
        </select>
      </label>
    </div>
    <p className="result-hint">Desde el extremo inicial, entre 0 y {resultNumber(bar.length)} m.</p>
    {section ? <ResultTable label="Valores de sección" headings={['s (m)', 'N (kN)', 'V (kN)', 'M (kN·m)', 'u′ (mm)', 'v′ (mm)', 'θ (rad)']}
      rows={[{ id: 'section', cells: [resultNumber(section.s), resultNumber(section.N, .001), resultNumber(section.V, .001),
        resultNumber(section.M, .001), resultNumber(section.u, 1000), resultNumber(section.v, 1000), resultNumber(section.rotation)] }]} />
      : <p className="form-error" role="status">Introduce una estación representable dentro de la barra.</p>}
    <details className="result-detail">
      <summary>Estaciones registradas</summary>
      <label className="result-field">Ir a una estación
        <select value="" onChange={event => {
          const item = bar.sections[Number(event.target.value)]
          if (item) { setStation(String(item.s)); setSide(item.side); link(item.s, item.side) }
        }}>
          <option value="" disabled>Selecciona una estación</option>
          {bar.sections.map((item, i) => <option key={i} value={i}>
            {resultNumber(item.s)} m · {item.side === 'left' ? 'izquierda' : 'derecha'}
          </option>)}
        </select>
      </label>
    </details>
  </>
}
