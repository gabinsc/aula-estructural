import { memo } from 'react'
import { worldToScreen } from '../../geometry/camera'
import type { Camera, Viewport } from '../../geometry/camera'
import type { CoordinateFrame } from '../../geometry/coordinates'

interface AxesProps {
  camera: Camera
  viewport: Viewport
  ucs: CoordinateFrame
}

export const Axes = memo(function Axes({ camera, viewport, ucs }: AxesProps) {
  const origin = worldToScreen({ x: 0, y: 0 }, camera, viewport)
  const work = worldToScreen(ucs.origin, camera, viewport)
  const showWork = ucs.origin.x !== 0 || ucs.origin.y !== 0 || ucs.angle !== 0
  const { width, height } = viewport
  return <g aria-hidden="true">
    {origin.y >= 26 && origin.y <= height && <g className="global-x">
      <line x1={26} x2={width} y1={origin.y} y2={origin.y} />
      <text x={width - 24} y={origin.y - 8}>X</text>
    </g>}
    {origin.x >= 26 && origin.x <= width && <g className="global-y">
      <line x1={origin.x} x2={origin.x} y1={26} y2={height} />
      <text x={origin.x + 9} y={47}>Y</text>
    </g>}
    <g className="global-origin">
      <circle cx={origin.x} cy={origin.y} r={3.5} />
      <text x={origin.x + 10} y={origin.y + 19}>(0, 0)</text>
    </g>
    {showWork && <g className="ucs-axes" transform={`translate(${work.x} ${work.y})`}>
      <path transform={`rotate(${-ucs.angle * 180 / Math.PI})`} d="M0 0H54m-6 -4 6 4 -6 4M0 0V-54m-4 6 4 -6 4 6" />
      <circle r={3} />
      <text x={9} y={16}>UCS</text>
    </g>}
  </g>
})
