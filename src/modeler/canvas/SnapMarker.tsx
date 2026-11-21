import type { Point } from '../../geometry/coordinates'
import type { SnapKind } from '../tools/snap'

export function SnapMarker({ point, kind }: { point: Point; kind: SnapKind }) {
  return <g className={`crosshair snap-${kind}`} transform={`translate(${point.x} ${point.y})`} aria-hidden="true">
    <path className="snap-guide" d={kind === 'free' ? 'M-10 0h20M0-10v20' : 'M-15 0h8m14 0h8M0-15v8m0 14v8'} />
    {kind === 'grid' && <circle r="4" />}
    {kind === 'endpoint' && <rect x="-5" y="-5" width="10" height="10" />}
    {kind === 'midpoint' && <path d="M0-6 6 5H-6Z" />}
    {kind === 'intersection' && <path d="m-5-5 10 10m-10 0 10-10" />}
  </g>
}
