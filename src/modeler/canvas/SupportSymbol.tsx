import type { NodalSupport } from '../../domain/support'
import { degrees } from '../../geometry/coordinates'
import type { Point } from '../../geometry/coordinates'

export function SupportSymbol({ support, point, selected = false, preview = false }: {
  support: NodalSupport
  point: Point
  selected?: boolean
  preview?: boolean
}) {
  // La pantalla invierte Y. Solo se gira el símbolo proyectado, en píxeles CSS.
  const angle = support.kind === 'roller' ? -degrees(support.surfaceAngle) : 0
  const ground = support.kind === 'roller' ? 23 : support.kind === 'pinned' ? 15 : 6
  return <g className={`support-symbol${selected ? ' is-selected' : ''}${preview ? ' is-preview' : ''}`}
    data-support-node-id={preview ? undefined : support.nodeId} data-support-kind={support.kind}
    transform={`translate(${point.x} ${point.y}) rotate(${angle})`}>
    {support.kind === 'fixed' ? <path d="M0 0v6" /> : <path className="support-triangle" d="M0 1l9 14H-9Z" />}
    {support.kind === 'roller' && <>
      <circle cx={-4.5} cy={19} r={3.5} />
      <circle cx={4.5} cy={19} r={3.5} />
      <path className="support-normal" d="M0-5v-13m-3 3 3-3 3 3" />
    </>}
    <path className="support-ground" d="M-13 0h26m-20 0-4 4m9-4-4 4m9-4-4 4m9-4-4 4m9-4-4 4"
      transform={`translate(0 ${ground})`} />
  </g>
}
