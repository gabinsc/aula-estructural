import { useState } from 'react'
import type { PointerEvent } from 'react'
import { DEFAULT_LOAD_ANGLE, forceComponents, forceDirectionAngle, normalizeDirection } from '../loadDirection'
import { formatNumber, parseNumber } from '../format'
import { VectorFields } from './LoadFields'
import type { VectorDraft } from './LoadFields'

export function DirectionControl({ value, onChange, xLabel, yLabel, magnitudeLabel, angleLabel, dial = true, local = false }: {
  value: VectorDraft; onChange: (value: VectorDraft) => void
  xLabel: string; yLabel: string; magnitudeLabel: string; angleLabel: string; dial?: boolean; local?: boolean
}) {
  const [magnitude, setMagnitude] = useState(() => String(Math.hypot(Number(value.x), Number(value.y))))
  const [angle, setAngle] = useState(() => String(Number(value.x) || Number(value.y)
    ? forceDirectionAngle({ x: Number(value.x), y: Number(value.y) }) : DEFAULT_LOAD_ANGLE))
  const parsedAngle = parseNumber(angle)
  const shownAngle = parsedAngle === null ? DEFAULT_LOAD_ANGLE : normalizeDirection(parsedAngle)
  const axis = forceComponents(28, shownAngle)

  function polar(nextMagnitude: string, nextAngle: string) {
    setMagnitude(nextMagnitude)
    setAngle(nextAngle)
    const p = parseNumber(nextMagnitude)
    const direction = parseNumber(nextAngle)
    if (p === null || p < 0 || direction === null) {
      onChange({ x: '', y: '' })
      return
    }
    const vector = forceComponents(p, direction)
    onChange({ x: String(vector.x), y: String(vector.y) })
  }

  function cartesian(vector: VectorDraft) {
    onChange(vector)
    const x = parseNumber(vector.x)
    const y = parseNumber(vector.y)
    if (x === null || y === null) {
      setMagnitude('')
      return
    }
    setMagnitude(String(Math.hypot(x, y)))
    if (x || y) setAngle(String(forceDirectionAngle({ x, y })))
  }

  function pick(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - box.left - box.width / 2
    const y = box.top + box.height / 2 - event.clientY
    if (Math.hypot(x, y) < 4) return
    polar(magnitude, String(Number(forceDirectionAngle({ x, y }).toFixed(2)) % 360))
  }

  return <div className="direction-fields">
    <div className={dial ? 'direction-with-dial' : 'field-row'}>
      <label>{magnitudeLabel}<input inputMode="decimal" value={magnitude}
        onChange={event => polar(event.target.value, angle)} /></label>
      <label>{angleLabel}<input inputMode="decimal" value={angle}
        onChange={event => polar(magnitude, event.target.value)} /></label>
      {dial && <svg className="direction-dial" viewBox="0 0 84 84" role="slider" tabIndex={0}
        aria-label="Dirección gráfica" aria-valuemin={0} aria-valuemax={360}
        aria-valuenow={shownAngle} aria-valuetext={`${formatNumber(shownAngle, 2)} grados`}
        onPointerDown={event => {
          if (event.button !== 0) return
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          pick(event)
        }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event) }}
        onKeyDown={event => {
          const step = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1
            : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : 0
          if (!step) return
          event.preventDefault()
          polar(magnitude, String(normalizeDirection(shownAngle + step * (event.shiftKey ? 15 : 1))))
        }}>
        <circle className="dial-ring" cx="42" cy="42" r="36" />
        <path className="dial-axes" d="M7 42h70M42 7v70" />
        <text x="68" y="38">{local ? 'X′' : 'X'}</text><text x="46" y="16">{local ? 'Y′' : 'Y'}</text>
        <g className="dial-pointer" transform={`rotate(${-shownAngle} 42 42)`}>
          <path d="M42 42h28m-6-4 6 4-6 4" />
        </g>
        <circle className="dial-origin" cx={42 + axis.x} cy={42 - axis.y} r="2" />
      </svg>}
    </div>
    <VectorFields value={value} onChange={cartesian} xLabel={xLabel} yLabel={yLabel} />
  </div>
}
