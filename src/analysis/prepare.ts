import { barGeometry, isModelPoint } from '../geometry/coordinates'
import type { Point } from '../geometry/coordinates'
import type { NodalSupport } from '../domain/support'
import { validateLoad } from '../domain/load'
import type { AnalysisDiagnostic, AnalysisInput, DofReference, ElementAssignment, NodeDofs, PreparedBar, PreparedComponent, PreparedLoad, PreparedModel, PreparedTrussModel } from './contracts'
import { frameLocalStiffness, toGlobalVector, toLocalVector } from './frame'

export const MAX_TRUSS_DOFS = 1024

export type Preparation<Model extends PreparedModel = PreparedModel> =
  | { readonly ok: true; readonly model: Model; readonly diagnostics: readonly AnalysisDiagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly AnalysisDiagnostic[] }

function compareIds(a: string, b: string): number {
  const left = Number(a.slice(1))
  const right = Number(b.slice(1))
  if (a[0] === b[0] && Number.isSafeInteger(left) && Number.isSafeInteger(right) && left !== right) return left - right
  return a < b ? -1 : Number(a !== b)
}

function components(nodeIds: readonly string[], bars: readonly PreparedBar[]): PreparedComponent[] {
  const incident = new Map(nodeIds.map(id => [id, [] as PreparedBar[]]))
  for (const bar of bars) {
    incident.get(bar.startId)!.push(bar)
    incident.get(bar.endId)!.push(bar)
  }
  const visited = new Set<string>()
  const result: PreparedComponent[] = []
  for (const id of nodeIds) {
    if (visited.has(id)) continue
    const queue = [id]
    const barIds = new Set<string>()
    visited.add(id)
    for (let i = 0; i < queue.length; i++) {
      const nodeId = queue[i]!
      for (const bar of incident.get(nodeId)!) {
        barIds.add(bar.barId)
        const other = bar.startId === nodeId ? bar.endId : bar.startId
        if (visited.has(other)) continue
        visited.add(other)
        queue.push(other)
      }
    }
    result.push({ nodeIds: queue.sort(compareIds), barIds: [...barIds].sort(compareIds) })
  }
  return result
}

export function prepareTruss(input: AnalysisInput): Preparation<PreparedTrussModel> {
  return prepare(input, false)
}

export function prepareAnalysis(input: AnalysisInput): Preparation {
  return prepare(input, true)
}

function prepare(input: AnalysisInput, allowFrames: false): Preparation<PreparedTrussModel>
function prepare(input: AnalysisInput, allowFrames: true): Preparation
function prepare(input: AnalysisInput, allowFrames: boolean): Preparation {
  const { model, definition, loadCase } = input
  const diagnostics: AnalysisDiagnostic[] = []
  function error(code: AnalysisDiagnostic['code'], message: string, ids: Partial<AnalysisDiagnostic> = {}) {
    diagnostics.push({ ...ids, code, severity: 'error', message })
  }
  if (model.nodes.length * 2 > MAX_TRUSS_DOFS) {
    error('MODEL_TOO_LARGE', `El ensamblaje denso admite hasta ${MAX_TRUSS_DOFS} grados activos.`)
    return { ok: false, diagnostics }
  }
  if (!model.nodes.length || !model.bars.length) error('INVALID_MODEL', 'El análisis requiere una estructura con nudos y barras.')
  if (definition.version !== 1) error('INVALID_ASSIGNMENT', 'Versión de la definición mecánica incompatible.')
  if (!loadCase.id.trim()) error('INVALID_CASE', 'El caso de carga debe tener un identificador.')

  const nodes = [...model.nodes].sort((a, b) => compareIds(a.id, b.id))
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  if (nodeById.size !== nodes.length) error('INVALID_MODEL', 'Hay identificadores de nudo repetidos.')
  for (const node of nodes) if (!isModelPoint(node)) {
    error('INVALID_MODEL', 'Coordenadas de nudo inválidas.', { nodeIds: [node.id] })
  }
  const dofs: DofReference[] = []
  const dofByNode = new Map<string, NodeDofs>()
  const barIds = new Set(model.bars.map(bar => bar.id))
  if (barIds.size !== model.bars.length) error('INVALID_MODEL', 'Hay identificadores de barra repetidos.')
  const assignments = new Map<string, ElementAssignment>()
  for (const assignment of definition.assignments) {
    const { barId, kind, E, A } = assignment
    const validKind = kind === 'truss2d' || (allowFrames && kind === 'frame2d')
    if (!barIds.has(barId) || assignments.has(barId) || !validKind ||
      !Number.isFinite(E) || E <= 0 || !Number.isFinite(A) || A <= 0 ||
      (kind === 'frame2d' && (!Number.isFinite(assignment.I) || assignment.I <= 0))) {
      error('INVALID_ASSIGNMENT', 'Se requiere una sola asignación válida por barra con E, A e I (en pórticos) finitos y positivos.', { barIds: [barId] })
      continue
    }
    assignments.set(barId, assignment)
  }
  const rotationalNodes = new Set<string>()
  for (const bar of model.bars) if (assignments.get(bar.id)?.kind === 'frame2d') {
    rotationalNodes.add(bar.startId)
    rotationalNodes.add(bar.endId)
  }
  for (const node of nodes) {
    const x = dofs.length
    dofs.push({ index: x, nodeId: node.id, axis: 'ux' }, { index: x + 1, nodeId: node.id, axis: 'uy' })
    if (rotationalNodes.has(node.id)) {
      dofByNode.set(node.id, [x, x + 1, x + 2])
      dofs.push({ index: x + 2, nodeId: node.id, axis: 'rz' })
    } else dofByNode.set(node.id, [x, x + 1])
  }
  if (dofs.length > MAX_TRUSS_DOFS) {
    error('MODEL_TOO_LARGE', `El ensamblaje denso admite hasta ${MAX_TRUSS_DOFS} grados activos.`)
    return { ok: false, diagnostics }
  }
  const joints = new Set<string>()
  const bars: PreparedBar[] = []
  for (const bar of [...model.bars].sort((a, b) => compareIds(a.id, b.id))) {
    const ids = { barIds: [bar.id], nodeIds: [bar.startId, bar.endId] }
    const start = nodeById.get(bar.startId)
    const end = nodeById.get(bar.endId)
    const geometry = start && end && barGeometry(start, end)
    if (!start || !end || !geometry || !Number.isFinite(geometry.length)) {
      error('INVALID_MODEL', 'Barra con extremos inexistentes o longitud inválida.', ids)
      continue
    }
    const key = JSON.stringify([bar.startId, bar.endId].sort())
    if (joints.has(key)) error('INVALID_MODEL', 'Hay barras duplicadas entre los mismos nudos.', ids)
    joints.add(key)
    const assignment = assignments.get(bar.id)
    if (!assignment) {
      error('INVALID_ASSIGNMENT', 'Faltan E y A para la barra.', ids)
      continue
    }
    const { length } = geometry
    const EA = assignment.E * assignment.A
    const axialStiffness = EA / length
    if (!Number.isFinite(axialStiffness) || axialStiffness <= 0) {
      error('INVALID_ASSIGNMENT', 'EA/L no es una rigidez positiva representable en Float64.', ids)
      continue
    }
    const base = { startId: start.id, endId: end.id, length, axialStiffness,
      unit: { x: (end.x - start.x) / length, y: (end.y - start.y) / length } }
    const [xi, yi, ri] = dofByNode.get(start.id)!
    const [xj, yj, rj] = dofByNode.get(end.id)!
    if (assignment.kind === 'truss2d') bars.push({ ...assignment, ...base, dofIndices: [xi, yi, xj, yj] })
    else {
      const EI = assignment.E * assignment.I
      const k = frameLocalStiffness({ ...base, EI })
      if (!Number.isFinite(EI) || ![7, 8, 14, 17].every(index => k[index]! > 0) || !k.every(Number.isFinite)) {
        error('INVALID_ASSIGNMENT', 'EI y los coeficientes de flexión deben ser positivos y representables en Float64.', ids)
        continue
      }
      bars.push({ ...assignment, ...base, EI, dofIndices: [xi, yi, ri!, xj, yj, rj!] })
    }
  }

  const supports = new Map<string, NodalSupport>()
  for (const support of model.supports) {
    const { nodeId, kind } = support
    if (!nodeById.has(nodeId) || supports.has(nodeId) ||
      (kind !== 'pinned' && kind !== 'fixed' && (kind !== 'roller' || !Number.isFinite(support.surfaceAngle) ||
        support.surfaceAngle <= -Math.PI || support.surfaceAngle > Math.PI))) {
      error('INVALID_MODEL', 'Apoyo sin nudo válido, duplicado o con orientación inválida.', { nodeIds: [nodeId] })
      continue
    }
    supports.set(nodeId, { ...support })
    if (kind === 'fixed' && !rotationalNodes.has(nodeId)) diagnostics.push({
      code: 'INACTIVE_FIXED_ROTATION', severity: 'info', nodeIds: [nodeId], supportNodeId: nodeId,
      message: 'El empotramiento restringe las dos traslaciones. El giro no es un grado activo en truss2d.',
    })
  }

  const rotationLocks = new Set([...supports.values()]
    .filter(support => support.kind === 'fixed' && rotationalNodes.has(support.nodeId)).map(support => support.nodeId))
  for (const nodeId of input.rotationLocks ?? []) {
    if (!rotationalNodes.has(nodeId)) error('INVALID_MODEL', 'Bloqueo temporal en un nudo sin giro activo.', { nodeIds: [nodeId] })
    else rotationLocks.add(nodeId)
  }

  const selected = new Set(loadCase.loadIds ?? model.loads.map(load => load.id))
  const allLoads = new Set(model.loads.map(load => load.id))
  if (allLoads.size !== model.loads.length) error('INVALID_MODEL', 'Hay identificadores de carga repetidos.')
  if (loadCase.loadIds && selected.size !== loadCase.loadIds.length) error('INVALID_CASE', 'El caso repite IDs de carga.')
  for (const loadId of selected) if (!allLoads.has(loadId)) error('INVALID_CASE', 'El caso refiere una carga inexistente.', { loadIds: [loadId] })
  const loads: PreparedLoad[] = []
  const preparedBars = new Map(bars.map(bar => [bar.barId, bar]))
  for (const load of [...model.loads].sort((a, b) => compareIds(a.id, b.id))) {
    if (!selected.has(load.id)) continue
    if (!allowFrames && load.kind !== 'nodal') {
      error('UNSUPPORTED_LOAD', 'Este incremento solo admite fuerzas nodales. Las cargas sobre barras requieren otra formulación.',
        { barIds: [load.barId], loadIds: [load.id] })
      continue
    }
    if (load.kind !== 'nodal') {
      const ids = { barIds: [load.barId], loadIds: [load.id] }
      const issue = validateLoad(model, load)
      const bar = preparedBars.get(load.barId)
      if (issue || !bar || (load.frame !== 'local' && load.frame !== 'global') ||
        (load.kind === 'distributed' && load.profile !== 'uniform' && load.profile !== 'linear')) {
        error('INVALID_MODEL', issue ?? 'Carga de barra o sistema de referencia inválido.', ids)
        continue
      }
      const local = (vector: Point) => load.frame === 'local' ? { ...vector } : toLocalVector(vector, bar.unit)
      if (load.kind === 'point' && (load.s === 0 || load.s === bar.length)) {
        const force = load.frame === 'global' ? { ...load.force } : toGlobalVector(load.force, bar.unit)
        loads.push({ kind: 'nodal', id: load.id, barId: bar.barId, nodeId: load.s === 0 ? bar.startId : bar.endId, force, moment: 0 })
      } else if (bar.kind !== 'frame2d') {
        error('UNSUPPORTED_LOAD', 'Las cargas interiores sobre barras requieren un elemento de pórtico.', ids)
      } else if (load.kind === 'point') {
        loads.push({ kind: 'point', id: load.id, barId: bar.barId, s: load.s, force: local(load.force) })
      } else {
        loads.push({ kind: 'distributed', id: load.id, barId: bar.barId, s0: load.s0, s1: load.s1, q0: local(load.q0), q1: local(load.q1) })
      }
      continue
    }
    const ids = { nodeIds: [load.nodeId], loadIds: [load.id] }
    if (!nodeById.has(load.nodeId) || !Number.isFinite(Math.hypot(load.force.x, load.force.y)) || !Number.isFinite(load.moment)) {
      error('INVALID_MODEL', 'Carga nodal con nudo inexistente o magnitud inválida.', ids)
    } else if (load.moment !== 0 && !rotationalNodes.has(load.nodeId)) {
      error('INACTIVE_ROTATION', 'Se aplicó un momento a un nudo sin grado de giro activo.', ids)
    } else {
      loads.push({ kind: 'nodal', id: load.id, nodeId: load.nodeId, force: { ...load.force }, moment: load.moment })
    }
  }
  if (diagnostics.some(item => item.severity === 'error')) return { ok: false, diagnostics }
  const connected = components(nodes.map(node => node.id), bars)
  for (const group of connected) if (!group.barIds.length) {
    error('ISOLATED_NODE', 'El nudo está aislado y no pertenece a ningún elemento.', { nodeIds: group.nodeIds })
  }
  if (diagnostics.some(item => item.severity === 'error')) return { ok: false, diagnostics }
  return { ok: true, model: { nodes: nodes.map(node => ({ ...node })), bars, loads, supports, rotationLocks, components: connected, dofs, dofByNode }, diagnostics }
}
