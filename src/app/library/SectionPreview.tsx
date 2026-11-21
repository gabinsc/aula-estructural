import { sectionBounds, LENGTH_MM } from '../../geometry/sections'
import type { SectionCalculation } from '../../geometry/sections'
import { formatted } from './fields'

export function SectionPreview({ section }: { section: SectionCalculation }) {
  const { parts, values } = section
  const bounds = parts.map(sectionBounds)
  const left = Math.min(...bounds.map(item => item.left)), right = Math.max(...bounds.map(item => item.right))
  const bottom = Math.min(...bounds.map(item => item.bottom)), top = Math.max(...bounds.map(item => item.top))
  const width = right - left, height = top - bottom
  const scale = Math.min(258 / width, 172 / height)
  const x = (value: number) => 190 + (value - (left + right) / 2) * scale
  const y = (value: number) => 124 - (value - (bottom + top) / 2) * scale
  const center = { x: x(values.cx), y: y(values.cy) }
  const dimY = y(bottom) + 18, dimX = x(right) + 18
  return <div className="section-preview">
    {parts.length > 0 && <>
      <svg className="section-svg" data-section-svg viewBox="0 0 420 255" role="img" aria-label="Sección transversal con centroide, ejes y dimensiones">
        {[...parts].sort((a, b) => Number(!!a.hole) - Number(!!b.hole)).map((p, index) => p.kind === 'disk'
          ? <circle key={index} className={p.hole ? 'section-void' : 'section-solid'} cx={x(p.x)} cy={y(p.y)} r={p.r * scale} />
          : <rect key={index} className={p.hole ? 'section-void' : 'section-solid'} x={x(p.x)} y={y(p.y + p.h)}
            width={p.b * scale} height={p.h * scale} />)}
        {x(0) >= 21 && x(0) <= 377 && <line className="section-reference" x1={x(0)} x2={x(0)} y1={14} y2={228} />}
        {y(0) >= 15 && y(0) <= 230 && <line className="section-reference" x1={21} x2={377} y1={y(0)} y2={y(0)} />}
        <line className="section-centroid-axis" x1={center.x} x2={center.x} y1={14} y2={225} />
        <line className="section-centroid-axis" x1={21} x2={377} y1={center.y} y2={center.y} />
        <text x={center.x + 5} y={21}>ȳ</text><text x={368} y={center.y - 5}>x̄</text>
        <circle className="section-centroid" data-section-centroid cx={center.x} cy={center.y} r={4} />
        <line className="section-dimension" x1={x(left)} x2={x(right)} y1={dimY} y2={dimY} />
        <line className="section-dimension" x1={dimX} x2={dimX} y1={y(top)} y2={y(bottom)} />
        <path className="section-dimension" d={`M${x(left)} ${dimY - 4}v8 M${x(right)} ${dimY - 4}v8 M${dimX - 4} ${y(top)}h8 M${dimX - 4} ${y(bottom)}h8`} />
        <text x={190} y={dimY + 15} textAnchor="middle">{formatted(width / LENGTH_MM)} mm</text>
        <text x={dimX + 5} y={(y(top) + y(bottom)) / 2} transform={`rotate(-90 ${dimX + 5} ${(y(top) + y(bottom)) / 2})`}
          textAnchor="middle" dy={11}>{formatted(height / LENGTH_MM)} mm</text>
      </svg>
      <p className="field-help">Gris discontinuo · referencia. Ámbar · ejes centroidales.</p>
    </>}
    <dl className="properties section-properties">
      <dt>A (cm²)</dt><dd>{formatted(values.A * 1e4)}</dd>
      <dt>Centroide (mm)</dt><dd>{formatted(values.cx / LENGTH_MM)}, {formatted(values.cy / LENGTH_MM)}</dd>
      <dt>Ixx (cm⁴)</dt><dd>{formatted(values.Ixx * 1e8)}</dd>
      <dt>Iyy (cm⁴)</dt><dd>{formatted(values.Iyy * 1e8)}</dd>
      <dt>Ixy (cm⁴)</dt><dd>{formatted(values.Ixy * 1e8)}</dd>
    </dl>
  </div>
}
