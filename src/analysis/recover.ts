import type { ComponentChecks, FrameInteriorLoad, FrameResult, PreparedBar, PreparedComponent, PreparedModel, PreparedNodalLoad } from './contracts'
import { toGlobalVector } from './frame'
import { compensatedSum } from './summation'
import type { ReducedComponent } from './assembly'

const BALANCE_ABS_TOL = 1e-6
const BALANCE_REL_TOL = 1e-8
const COMPATIBILITY_ABS_TOL = 1e-11
const COMPATIBILITY_REL_TOL = 1e-10

function balance(terms: readonly number[]) {
  const value = compensatedSum(terms)
  const scale = compensatedSum(terms.map(Math.abs))
  return { value, scale, valid: Number.isFinite(scale) && Number.isFinite(value) &&
    Math.abs(value) <= BALANCE_ABS_TOL + BALANCE_REL_TOL * scale }
}

export function computeReactions(K: Float64Array, u: Float64Array, F: Float64Array): Float64Array {
  const size = u.length
  const terms = new Float64Array(size + 1)
  return F.map((value, row) => {
    for (let col = 0; col < size; col++) terms[col] = K[row * size + col]! * u[col]!
    terms[size] = -value
    return compensatedSum(terms)
  })
}

export function checkComponent(model: PreparedModel, component: PreparedComponent, reduced: ReducedComponent,
  u: Float64Array, R: Float64Array, loadsByNode: ReadonlyMap<string, readonly PreparedNodalLoad[]>,
  bars: ReadonlyMap<string, PreparedBar>, memberLoads: ReadonlyMap<string, readonly FrameInteriorLoad[]>,
  backwardError: number, scaledRcondEstimate: number | null): { checks: ComponentChecks; valid: boolean } {
  const nodeById = new Map(model.nodes.map(node => [node.id, node]))
  const origin = nodeById.get(component.nodeIds[0]!)!
  const fx: number[] = []
  const fy: number[] = []
  const mz: number[] = []
  let compatibilityResidual = 0
  let displacementScale = 0
  let rotationScale = 0
  let rotationCompatibilityResidual = 0
  let rollerTangentialResidual = 0
  let rollerValid = true
  for (const nodeId of component.nodeIds) {
    const node = nodeById.get(nodeId)!
    const [x, y, rz] = model.dofByNode.get(nodeId)!
    const armX = node.x - origin.x
    const armY = node.y - origin.y
    for (const load of loadsByNode.get(nodeId) ?? []) {
      fx.push(load.force.x)
      fy.push(load.force.y)
      mz.push(armX * load.force.y, -armY * load.force.x, load.moment)
    }
    displacementScale = Math.max(displacementScale, Math.hypot(u[x]!, u[y]!))
    if (rz !== undefined) rotationScale = Math.max(rotationScale, Math.abs(u[rz]!))
    if (rz !== undefined && model.rotationLocks.has(nodeId)) {
      mz.push(R[rz]!)
      rotationCompatibilityResidual = Math.max(rotationCompatibilityResidual, Math.abs(u[rz]!))
    }
    const support = model.supports.get(nodeId)
    if (!support) continue
    fx.push(R[x]!)
    fy.push(R[y]!)
    mz.push(armX * R[y]!, -armY * R[x]!)
    const normal = reduced.normals.get(nodeId)
    if (normal) {
      const tangentResidual = Math.abs(normal.y * R[x]! - normal.x * R[y]!)
      const reactionScale = Math.hypot(R[x]!, R[y]!)
      rollerTangentialResidual = Math.max(rollerTangentialResidual, tangentResidual)
      rollerValid &&= Number.isFinite(reactionScale) && tangentResidual <= BALANCE_ABS_TOL + BALANCE_REL_TOL * reactionScale
    }
    const violation = normal ? Math.abs(normal.x * u[x]! + normal.y * u[y]!) : Math.max(Math.abs(u[x]!), Math.abs(u[y]!))
    compatibilityResidual = Math.max(compatibilityResidual, violation)
  }
  // Balance con las cargas físicas, mediante resultantes y primeros momentos
  // analíticos. Esta comprobación no reutiliza el vector consistente F.
  for (const id of component.barIds) {
    const bar = bars.get(id)!
    const start = nodeById.get(bar.startId)!
    const armX = start.x - origin.x
    const armY = start.y - origin.y
    for (const load of memberLoads.get(id) ?? []) {
      const addForce = (force: { x: number; y: number }, station: number, weight: number) => {
        const global = toGlobalVector(force, bar.unit)
        fx.push(global.x * weight)
        fy.push(global.y * weight)
        mz.push(armX * global.y * weight, -armY * global.x * weight, station * force.y * weight)
      }
      if (load.kind === 'point') addForce(load.force, load.s, 1)
      else {
        const span = load.s1 - load.s0
        addForce(load.q0, load.s0 + span / 3, span / 2)
        addForce(load.q1, load.s1 - span / 3, span / 2)
      }
    }
  }
  const xBalance = balance(fx)
  const yBalance = balance(fy)
  const momentBalance = balance(mz)
  let freeResidual = 0
  let freeMomentResidual = 0
  for (const { nodeId, direction, axis } of reduced.reducedDofs) {
    const [x, y, rz] = model.dofByNode.get(nodeId)!
    if (axis === 'rz') freeMomentResidual = Math.max(freeMomentResidual, Math.abs(R[rz!]!))
    else freeResidual = Math.max(freeResidual, Math.abs(direction.x * R[x]! + direction.y * R[y]!))
  }
  const checks = {
    nodeIds: component.nodeIds, forceResidual: { x: xBalance.value, y: yBalance.value },
    momentOriginNodeId: origin.id, momentResidual: momentBalance.value, compatibilityResidual, freeResidual, rollerTangentialResidual,
    freeMomentResidual, rotationCompatibilityResidual, backwardError, scaledRcondEstimate,
  }
  const forceScale = Math.max(xBalance.scale, yBalance.scale)
  const valid = rollerValid && xBalance.valid && yBalance.valid && momentBalance.valid && Number.isFinite(displacementScale) &&
    freeResidual <= BALANCE_ABS_TOL + BALANCE_REL_TOL * forceScale &&
    freeMomentResidual <= BALANCE_ABS_TOL + BALANCE_REL_TOL * momentBalance.scale &&
    compatibilityResidual <= COMPATIBILITY_ABS_TOL + COMPATIBILITY_REL_TOL * displacementScale &&
    rotationCompatibilityResidual <= COMPATIBILITY_ABS_TOL + COMPATIBILITY_REL_TOL * rotationScale
  return { checks, valid }
}

export function checkFrameEnds(bar: FrameResult): boolean {
  const first = bar.sections[0]!
  const last = bar.sections.at(-1)!
  const [, , , px, py, mz] = bar.endForces
  const [, , , uj, vj, tj] = bar.localDisplacements
  const close = (a: number, b: number, abs: number, scale: number) =>
    Number.isFinite(scale) && Math.abs(a - b) <= abs + BALANCE_REL_TOL * scale
  const axial = Math.max(Math.abs(first.N), Math.abs(px))
  const shear = Math.max(Math.abs(first.V), Math.abs(py))
  const moment = Math.max(Math.abs(first.M), Math.abs(mz), shear * bar.length)
  return close(last.N, px, BALANCE_ABS_TOL, axial) &&
    close(last.V, -py, BALANCE_ABS_TOL, shear) &&
    close(last.M, mz, BALANCE_ABS_TOL, moment) &&
    close(last.u, uj, 1e-10, Math.max(Math.abs(first.u), Math.abs(uj))) &&
    close(last.v, vj, 1e-10, Math.max(Math.abs(first.v), Math.abs(vj))) &&
    close(last.rotation, tj, 1e-10, Math.max(Math.abs(first.rotation), Math.abs(tj)))
}
