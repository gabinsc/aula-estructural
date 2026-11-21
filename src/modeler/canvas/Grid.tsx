import { memo } from 'react'
import { screenToWorld, worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import { formatNumber } from '../format'

const RULER = 26

export function gridStep(scale: number): number {
  const target = 50 / scale
  const power = 10 ** Math.floor(Math.log10(target))
  const ratio = target / power
  return (ratio < 2 ? 1 : ratio < 5 ? 2 : 5) * power
}

function entries(min: number, max: number, step: number) {
  const start = Math.ceil(min / step)
  const count = Math.max(0, Math.min(400, Math.floor(max / step) - start + 1))
  return Array.from({ length: count }, (_, index) => {
    const tick = index + start
    return { value: tick * step, major: tick % 5 === 0 }
  })
}

interface GridProps {
  camera: Camera
  viewport: Viewport
  rulers?: boolean
}

export const Grid = memo(function Grid({ camera, viewport, rulers = false }: GridProps) {
  const { width, height } = viewport
  const step = gridStep(camera.scale)
  const topLeft = screenToWorld({ x: 0, y: 0 }, camera, viewport)
  const bottomRight = screenToWorld({ x: width, y: height }, camera, viewport)
  const xTicks = entries(topLeft.x, bottomRight.x, step).map(tick => ({
    ...tick, pixel: worldToScreen({ x: tick.value, y: 0 }, camera, viewport).x,
  }))
  const yTicks = entries(bottomRight.y, topLeft.y, step).map(tick => ({
    ...tick, pixel: worldToScreen({ x: 0, y: tick.value }, camera, viewport).y,
  }))
  if (rulers) {
    return <g className="rulers" aria-hidden="true">
      <path className="ruler-background" d={`M0 0H${width}V${RULER}H${RULER}V${height}H0Z`} />
      <path className="ruler-edge" d={`M${RULER} ${height}V${RULER}H${width}`} />
      <text className="ruler-unit" x={RULER / 2} y={17} textAnchor="middle">m</text>
      {xTicks.filter(tick => tick.pixel > RULER + 13).map(({ value, pixel, major }) => <g key={value}>
        <line x1={pixel} x2={pixel} y1={major ? 17 : 21} y2={RULER} />
        {major && <text x={pixel} y={13} textAnchor="middle">{formatNumber(value)}</text>}
      </g>)}
      {yTicks.filter(tick => tick.pixel > RULER + 12).map(({ value, pixel, major }) => <g key={value}>
        <line x1={major ? 17 : 21} x2={RULER} y1={pixel} y2={pixel} />
        {major && <text transform={`translate(12 ${pixel}) rotate(-90)`} textAnchor="middle">{formatNumber(value)}</text>}
      </g>)}
    </g>
  }

  return <g aria-hidden="true">
    {xTicks.map(({ value, pixel, major }) => <line className={major ? 'grid-major' : 'grid-line'} key={value}
      x1={pixel} x2={pixel} y1={0} y2={height} />)}
    {yTicks.map(({ value, pixel, major }) => <line className={major ? 'grid-major' : 'grid-line'} key={value}
      x1={0} x2={width} y1={pixel} y2={pixel} />)}
  </g>
})
