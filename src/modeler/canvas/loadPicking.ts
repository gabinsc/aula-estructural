import type { Selection } from '../../domain/structure'
import type { Point } from '../../geometry/coordinates'
import { distanceToSegment } from '../../geometry/picking'
import { selectionWindow } from './selection'
import type { SelectionBox } from './selection'

type Stroke = { start: Point; end: Point }
const CLICK_RADIUS = 9

/** Lee los trazos confirmados en píxeles SVG. Los textos y los borradores quedan fuera del hit test. */
function loadStrokes(canvas: SVGSVGElement, attribute = 'data-load-id') {
  return Array.from(canvas.querySelectorAll<SVGGElement>(`[${attribute}]`), group => {
    const strokes: Stroke[] = []
    for (const shape of group.querySelectorAll<SVGGeometryElement>('line, path, circle')) {
      const matrix = shape.getCTM()
      if (!matrix) continue
      const length = shape.getTotalLength()
      const count = shape.tagName === 'line' ? 1 : Math.max(2, Math.ceil(length / 3))
      const point = (i: number) => shape.getPointAtLength(length * i / count).matrixTransform(matrix)
      let start = point(0)
      for (let i = 1; i <= count; i++) {
        const end = point(i)
        strokes.push({ start, end })
        start = end
      }
    }
    return { id: group.getAttribute(attribute)!, strokes }
  })
}

function strokesAt(canvas: SVGSVGElement, point: Point, attribute: string, radius: number) {
  return loadStrokes(canvas, attribute).map(({ id, strokes }) => ({
    id, distance: strokes.reduce((best, { start, end }) => Math.min(best, distanceToSegment(point, start, end)), Infinity),
  })).filter(item => item.distance <= radius).sort((a, b) => a.distance - b.distance)
}

export function loadsAt(canvas: SVGSVGElement, point: Point): Selection[] {
  return strokesAt(canvas, point, 'data-load-id', CLICK_RADIUS).map(({ id }) => ({ kind: 'load', id }))
}

export function supportAt(canvas: SVGSVGElement, point: Point): string | undefined {
  return strokesAt(canvas, point, 'data-support-node-id', 6)[0]?.id
}

export function loadsInBox(canvas: SVGSVGElement, box: SelectionBox): Selection[] {
  const { crossing, contains, intersects } = selectionWindow(box)
  return loadStrokes(canvas).filter(({ strokes }) => strokes.length && (crossing
    ? strokes.some(({ start, end }) => intersects(start, end))
    : strokes.every(({ start, end }) => contains(start) && contains(end))))
    .map(({ id }) => ({ kind: 'load', id }))
}
