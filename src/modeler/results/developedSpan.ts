import type { PlotMember } from './diagramModel'
import { isEffortJump } from './diagramFields'
import type { Effort } from './diagramFields'

export interface DevelopedMember {
  readonly member: PlotMember
  readonly from: number
  readonly to: number
  readonly reversed: boolean
}

function walk(selected: PlotMember, incident: ReadonlyMap<string, readonly PlotMember[]>, start: string,
  sign: number, seen: Set<string>): DevelopedMember[] | undefined {
  const steps: DevelopedMember[] = []
  let node = start
  let previous = selected.id
  while (true) {
    const neighbors = incident.get(node) ?? []
    if (neighbors.length > 2) return
    const member = neighbors.find(item => item.id !== previous)
    if (!member) return steps
    if (seen.has(member.id)) return
    const reversed = member.endId === node
    const direction = (reversed ? -1 : 1) * sign
    const dot = direction * (member.tangent.x * selected.tangent.x + member.tangent.y * selected.tangent.y)
    const cross = member.tangent.x * selected.tangent.y - member.tangent.y * selected.tangent.x
    if (dot <= 0 || Math.abs(cross) > 1e-10) return
    seen.add(member.id)
    steps.push({ member, from: 0, to: 0, reversed: sign > 0 ? reversed : !reversed })
    previous = member.id
    node = reversed ? member.startId : member.endId
  }
}

/** Una cadena desarrollable es un camino conectado, colineal y sin retrocesos ni ramificaciones. */
export function developedSpan(selected: PlotMember, members: readonly PlotMember[]): readonly DevelopedMember[] {
  const single = { member: selected, from: 0, to: selected.length, reversed: false }
  const adjacent = new Map<string, PlotMember[]>()
  for (const member of members) for (const id of [member.startId, member.endId]) {
    const list = adjacent.get(id)
    if (list) list.push(member)
    else adjacent.set(id, [member])
  }
  const seen = new Set([selected.id])
  const left = walk(selected, adjacent, selected.startId, -1, seen)
  const right = walk(selected, adjacent, selected.endId, 1, seen)
  if (!left || !right) return [single]
  let ordered = [...left.reverse(), single, ...right]
  if (ordered.length === 1) return ordered
  const first = ordered[0]!, last = ordered.at(-1)!
  const start = first.reversed ? first.member.end : first.member.start
  const end = last.reversed ? last.member.start : last.member.end
  if (start.x > end.x || (start.x === end.x && start.y > end.y)) {
    ordered = ordered.reverse().map(step => ({ ...step, reversed: !step.reversed }))
  }
  let station = 0
  return ordered.map(step => {
    const from = station
    station += step.member.length
    return { ...step, from, to: station }
  })
}

export function developedStation(step: DevelopedMember, s: number) {
  return step.reversed ? step.to - s : step.from + s
}

export function automaticPresentation(members: readonly PlotMember[]): 'developed' | 'compact' {
  const first = members[0]
  return !first || developedSpan(first, members).length === members.length ? 'developed' : 'compact'
}

export function localStation(step: DevelopedMember, s: number) {
  return Math.max(0, Math.min(step.member.length, step.reversed ? step.to - s : s - step.from))
}

/** Bajo inversión de ambos ejes locales, N y V conservan signo y M cambia de signo. */
export function developedValue(step: DevelopedMember, field: Effort, value: number) {
  return step.reversed && field === 'M' ? -value : value
}

export function developedSpans(members: readonly PlotMember[]) {
  const assigned = new Set<string>()
  const spans: (readonly DevelopedMember[])[] = []
  for (const member of members) {
    if (assigned.has(member.id)) continue
    const span = developedSpan(member, members)
    spans.push(span)
    for (const step of span) assigned.add(step.member.id)
  }
  return spans
}

export function jointJumps(steps: readonly DevelopedMember[], field: Effort, reference: number) {
  return steps.slice(1).flatMap((right, index) => {
    const left = steps[index]!
    const leftS = left.reversed ? 0 : left.member.length
    const rightS = right.reversed ? right.member.length : 0
    const nodeId = left.reversed ? left.member.startId : left.member.endId
    if (nodeId !== (right.reversed ? right.member.endId : right.member.startId)) return []
    function at(step: DevelopedMember, s: number) {
      const bar = step.member.bar
      if (bar.kind !== 'frame2d') return field === 'N' ? bar.axialForce : undefined
      const section = s === 0 ? bar.sections[0] : bar.sections.at(-1)
      return section && developedValue(step, field, section[field])
    }
    const before = at(left, leftS)
    const after = at(right, rightS)
    return before !== undefined && after !== undefined && isEffortJump(before, after, reference)
      ? [{ nodeId, S: left.to, left, right, leftS, rightS, before, after }] : []
  })
}
