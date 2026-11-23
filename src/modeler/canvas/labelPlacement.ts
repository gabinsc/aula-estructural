interface Bounds { left: number; right: number; top: number; bottom: number }

const intersects = (a: Bounds, b: Bounds) => a.left < b.right + 3 && a.right > b.left - 3 &&
  a.top < b.bottom + 2 && a.bottom > b.top - 2

const OFFSETS = [[0, 0], [0, -15], [0, 16], [22, -12], [-22, -12], [22, 18], [-22, 18], [0, -30]] as const
const GROUPS = [
  '.load-layer text, .avm-reactions text',
  '.avm-emphasized [data-avm-mark] text',
  '[data-label-rank="critical"] text',
  '.joint text, .member text, .cad-dimensions text, [data-avm-mark] text',
]

/** Resolves collisions in CSS pixels after SVG layout. Structural symbols remain stationary. */
export function arrangeCanvasLabels(svg: SVGSVGElement, enabled: boolean) {
  const labels = new Set(GROUPS.flatMap(group => [...svg.querySelectorAll<SVGTextElement>(group)]))
  for (const label of labels) {
    label.style.removeProperty('translate')
    label.style.removeProperty('visibility')
    const guide = label.parentElement?.querySelector<SVGLineElement>('[data-label-guide]')
    if (guide) guide.style.visibility = 'hidden'
  }
  if (!enabled) return

  const viewport = svg.getBoundingClientRect()
  const occupied: Bounds[] = [...svg.querySelectorAll('.joint-mark, .member-release, [data-support-node-id], .load-anchor')]
    .map(symbol => symbol.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0)
  const measured = [...labels].map(label => ({ label, box: label.getBoundingClientRect() }))
  const shownMarks = new Set<string>()
  for (const { label, box } of measured) {
    if (box.width === 0 || box.height === 0) continue
    const mark = label.parentElement?.closest('[data-avm-mark]')
    const anchor = mark?.querySelector('circle')
    const key = anchor && JSON.stringify([mark?.parentElement?.getAttribute('data-effort'), label.textContent,
      Math.round(Number(anchor.getAttribute('cx')) * 10), Math.round(Number(anchor.getAttribute('cy')) * 10)])
    if (key && shownMarks.has(key)) {
      label.style.visibility = 'hidden'
      continue
    }
    const place = OFFSETS.find(([dx, dy]) => {
      const moved = { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy }
      return moved.left > viewport.left + 3 && moved.right < viewport.right - 3 && moved.top > viewport.top + 3 &&
        moved.bottom < viewport.bottom - 3 && !occupied.some(other => intersects(moved, other))
    })
    if (!place) {
      label.style.visibility = 'hidden'
      continue
    }
    const [dx, dy] = place
    label.style.translate = `${dx}px ${dy}px`
    if (key) shownMarks.add(key)
    if (Math.hypot(dx, dy) > 18) {
      const guide = mark?.querySelector<SVGLineElement>('[data-label-guide]')
      if (guide && anchor) {
        guide.setAttribute('x2', String(Number(anchor.getAttribute('cx')) + dx))
        guide.setAttribute('y2', String(Number(anchor.getAttribute('cy')) + dy - 4))
        guide.style.visibility = 'visible'
      }
    }
    occupied.push({ left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy })
  }
}
