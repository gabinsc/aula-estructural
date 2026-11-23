import { useEffect, useRef, useState } from 'react'
import type { InfluenceDetail } from '../../analysis/influence'
import type { Structure } from '../../domain/structure'
import { formatResult } from '../../modeler/format'
import { BAND_HEIGHT, DEFAULT_BAND_OPTIONS, InfluenceBand, InfluenceReference, PATH_HEIGHT } from './InfluenceBands'
import type { InfluenceBandData } from './InfluenceBands'
import { exportInfluenceReport, paperSize } from './influenceReportExport'
import type { ReportFormat, ReportOrientation, ReportPaper } from './influenceReportExport'
import type { MovingPosition } from './InfluenceResults'

const FLAGS = { ...DEFAULT_BAND_OPTIONS, supports: true, dimensions: true, hinges: true, table: false, explanations: false }
const FLAG_NAMES = { fill: 'Relleno', zeros: 'Ceros', extremes: 'Extremos', jumps: 'Saltos', annotations: 'Anotaciones',
  supports: 'Apoyos', dimensions: 'Cotas', hinges: 'Rótulas', table: 'Tabla de extremos', explanations: 'Explicaciones' }
const MARGIN = 22
const CONTENT_TOP = 54
const TABLE_LINE = 15

export function InfluenceReport({ model, detail, lines, position, decimals }: {
  model: Structure; detail: InfluenceDetail; lines: readonly InfluenceBandData[]; position: MovingPosition; decimals: number
}) {
  const [paper, setPaper] = useState<ReportPaper>('a4')
  const [orientation, setOrientation] = useState<ReportOrientation>('landscape')
  const [format, setFormat] = useState<ReportFormat>('pdf')
  const [flags, setFlags] = useState(FLAGS)
  const [selected, setSelected] = useState<readonly string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const preview = useRef<HTMLDivElement>(null)
  const active = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => active.current?.abort(), [])
  const selection = selected ?? lines.filter(line => line.visible).map(line => line.id)
  const included = lines.filter(line => selection.includes(line.id))
  const { width, height } = paperSize(paper, orientation)
  const plotWidth = width - 2 * MARGIN
  const explained = flags.explanations ? 32 : 0
  const lineHeight = BAND_HEIGHT + (flags.table ? TABLE_LINE : 0)
  const capacity = Math.max(1, Math.floor((height - CONTENT_TOP - PATH_HEIGHT - 38 - explained) / lineHeight))
  const pageCount = Math.ceil(included.length / capacity)

  async function save() {
    const pages = [...(preview.current?.querySelectorAll<SVGSVGElement>('svg[data-report-page]') ?? [])]
    if (!pages.length || busy) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setMessage('')
    try {
      await exportInfluenceReport(pages, paper, orientation, format, controller.signal)
      setMessage('Reporte generado.')
    } catch (cause) {
      if (!controller.signal.aborted) setMessage(cause instanceof Error ? cause.message : 'No se pudo exportar el reporte.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <details className="result-detail influence-report">
    <summary>Exportar reporte de líneas de influencia</summary>
    <div className="result-controls">
      <label className="result-field">Formato<select value={format} onChange={event => setFormat(event.target.value as ReportFormat)}>
        <option value="pdf">PDF</option><option value="svg">SVG</option><option value="png">PNG</option></select></label>
      <label className="result-field">Papel<select value={paper} onChange={event => setPaper(event.target.value as ReportPaper)}>
        <option value="a4">A4</option><option value="a3">A3</option></select></label>
      <label className="result-field">Orientación<select value={orientation}
        onChange={event => setOrientation(event.target.value as ReportOrientation)}>
        <option value="landscape">Horizontal</option><option value="portrait">Vertical</option></select></label>
    </div>
    <fieldset className="method-fields"><legend>Líneas del reporte</legend>
      <button type="button" className="button secondary" onClick={() => setSelected(null)}>Usar líneas visibles</button>
      {lines.map(line => <label key={line.id}><input type="checkbox" checked={selection.includes(line.id)}
        onChange={event => setSelected(event.target.checked ? [...selection, line.id] : selection.filter(id => id !== line.id))} />
        {line.name || line.id}</label>)}
    </fieldset>
    <fieldset className="method-fields"><legend>Contenido del reporte</legend>
      <div className="influence-report-flags">
        {(Object.keys(FLAG_NAMES) as (keyof typeof FLAG_NAMES)[]).map(key => <label key={key}>
          <input type="checkbox" checked={flags[key]} onChange={event => setFlags({ ...flags, [key]: event.target.checked })} />
          {FLAG_NAMES[key]}</label>)}
      </div>
    </fieldset>
    <button type="button" className="button primary" disabled={!included.length || busy} onClick={() => void save()}>Descargar reporte</button>
    {message && <p role="status">{message}</p>}
    <div className="influence-report-preview" ref={preview} aria-label="Vista previa del reporte">
      {Array.from({ length: pageCount }, (_, index) => (
        <svg key={index} data-report-page={index + 1} role="img" aria-label={`Reporte, página ${index + 1} de ${pageCount}`}
          viewBox={`0 0 ${width} ${height}`} fontFamily="Helvetica, sans-serif" fill="#162633">
          <rect width={width} height={height} fill="white" />
          <text x={MARGIN} y={33} fontSize={21} fontWeight="bold">
            {position.mode === 'train' ? 'Respuesta al tren de cargas' : 'Líneas de influencia'}
          </text>
          <text x={width - MARGIN} y={32} fontSize={11} textAnchor="end">Aula Estructural</text>
          <g transform={`translate(${MARGIN} ${CONTENT_TOP})`}>
            <InfluenceReference model={model} detail={detail} position={position} width={plotWidth} supports={flags.supports}
              dimensions={flags.dimensions} hinges={flags.hinges} decimals={decimals} />
            {included.slice(index * capacity, (index + 1) * capacity).map((line, i) => {
              const curve = position.mode === 'train' && line.detail.train ? line.detail.train.envelope : line.detail
              return <g key={line.id} transform={`translate(0 ${PATH_HEIGHT + i * lineHeight})`}>
                <InfluenceBand line={line} width={plotWidth} position={position} options={flags} decimals={decimals} />
                {flags.table && <text x={12} y={BAND_HEIGHT + 10} fontSize={11}>
                  Estaciones críticas · mínimo en S = {formatResult(curve.min.s, { decimals })} m
                  {' · '}máximo en S = {formatResult(curve.max.s, { decimals })} m
                </text>}
              </g>
            })}
          </g>
          {flags.explanations && <text x={MARGIN} y={height - 44} fontSize={10}>
            Ordenadas del método de rigideces. Los círculos abiertos identifican límites unilaterales.
          </text>}
          <text x={MARGIN} y={height - 21} fontSize={10}>Uso educativo</text>
          <text x={width - MARGIN} y={height - 21} textAnchor="end" fontSize={10}>{index + 1} / {pageCount}</text>
        </svg>
      ))}
    </div>
  </details>
}
