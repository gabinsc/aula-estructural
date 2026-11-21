export const CONDITION_WARNING = 1e-8
export const CONDITION_LIMIT = 1e-12
const BACKWARD_LIMIT = 1e-10

type LinearFailure = {
  readonly ok: false
  readonly code: 'UNSTABLE_OR_SINGULAR' | 'ILL_CONDITIONED' | 'NUMERICAL_FAILURE'
  readonly message: string
  readonly index?: number
}

type LinearResult = LinearFailure | {
  readonly ok: true
  readonly z: Float64Array
  readonly scaling: Float64Array
  readonly backwardError: number
  readonly rcond: number | null
}

function vectorNorm(vector: Float64Array): number {
  let maximum = 0
  for (const value of vector) maximum = Math.max(maximum, Math.abs(value))
  return maximum
}

function matrixNorm(matrix: Float64Array, size: number): number {
  let maximum = 0
  for (let i = 0; i < size; i++) {
    let row = 0
    for (let j = 0; j < size; j++) row += Math.abs(matrix[i * size + j]!)
    maximum = Math.max(maximum, row)
  }
  return maximum
}

function triangularSolve(factor: Float64Array, rhs: Float64Array): Float64Array {
  const size = rhs.length
  const x = rhs.slice()
  for (let i = 0; i < size; i++) {
    let value = x[i]!
    for (let j = 0; j < i; j++) value -= factor[i * size + j]! * x[j]!
    x[i] = value / factor[i * size + i]!
  }
  for (let i = size - 1; i >= 0; i--) {
    let value = x[i]!
    for (let j = i + 1; j < size; j++) value -= factor[j * size + i]! * x[j]!
    x[i] = value / factor[i * size + i]!
  }
  return x
}

/** Estima la norma 1 mediante resoluciones con los factores, sin construir A⁻¹. */
function reciprocalCondition(factor: Float64Array, size: number, norm: number): number {
  const test = new Float64Array(size).fill(1 / size)
  let estimate = 0
  let lastIndex = -1
  for (let pass = 0; pass < 8; pass++) {
    const y = triangularSolve(factor, test)
    const next = y.reduce((sum, value) => sum + Math.abs(value), 0)
    if (!Number.isFinite(next)) return 0
    if (next <= estimate) break
    estimate = next
    const z = triangularSolve(factor, y.map(value => value < 0 ? -1 : 1))
    let index = 0
    for (let i = 1; i < size; i++) if (Math.abs(z[i]!) > Math.abs(z[index]!)) index = i
    if (index === lastIndex || Math.abs(z[index]!) <= z.reduce((sum, value, i) => sum + value * test[i]!, 0)) break
    test.fill(0)
    test[index] = 1
    lastIndex = index
  }
  // Una prueba alternante evita que el vector inicial uniforme pierda por
  // cancelación modos dominantes de signo opuesto (por ejemplo [1, −1]).
  if (size > 1) {
    const alternate = Float64Array.from({ length: size }, (_, i) => (i % 2 ? -1 : 1) * (1 + i / (size - 1)))
    const magnitude = triangularSolve(factor, alternate).reduce((sum, value) => sum + Math.abs(value), 0)
    if (!Number.isFinite(magnitude)) return 0
    estimate = Math.max(estimate, magnitude / (1.5 * size))
  }
  return Math.min(1, 1 / (norm * estimate))
}

export function solvePositiveDefinite(Kr: Float64Array, Fr: Float64Array, incident: Float64Array): LinearResult {
  const size = Fr.length
  const scaling = new Float64Array(size)
  if (!size) return { ok: true, z: new Float64Array(0), scaling, backwardError: 0, rcond: null }
  const failure = (message: string): LinearFailure => ({ ok: false, code: 'NUMERICAL_FAILURE', message })
  for (let i = 0; i < size; i++) {
    const diagonal = Kr[i * size + i]!
    if (!Number.isFinite(diagonal) || !Number.isFinite(incident[i]!)) return failure('La rigidez reducida excede la precisión representable.')
    if (diagonal <= 0) return { ok: false, code: 'UNSTABLE_OR_SINGULAR', index: i, message: 'Coordenada libre sin rigidez positiva.' }
    if (diagonal / incident[i]! < CONDITION_LIMIT) return {
      ok: false, code: 'ILL_CONDITIONED', index: i,
      message: 'La dirección libre es casi ortogonal a las barras incidentes. El escalado ocultaría una rigidez efectiva muy baja.',
    }
    scaling[i] = 1 / Math.sqrt(diagonal)
  }
  const matrix = new Float64Array(Kr.length)
  for (let i = 0; i < size; i++) for (let j = i; j < size; j++) {
    const value = scaling[i]! * Kr[i * size + j]! * scaling[j]!
    matrix[i * size + j] = value
    matrix[j * size + i] = value
  }
  const rhs = Fr.map((value, i) => value * scaling[i]!)
  const norm = matrixNorm(matrix, size)
  if (!Number.isFinite(norm) || !Number.isFinite(vectorNorm(rhs))) return failure('No se pudo equilibrar el sistema reducido en Float64.')
  const pivotLimit = 10 * Number.EPSILON * size * norm
  const factor = new Float64Array(matrix.length)
  for (let i = 0; i < size; i++) {
    for (let j = 0; j <= i; j++) {
      let value = matrix[i * size + j]!
      for (let k = 0; k < j; k++) value -= factor[i * size + k]! * factor[j * size + k]!
      if (!Number.isFinite(value)) return failure('La factorización produjo valores no finitos.')
      if (i === j && value <= pivotLimit) return {
        ok: false, code: 'UNSTABLE_OR_SINGULAR', index: i,
        message: 'Cholesky encontró un pivote nulo, negativo o demasiado pequeño. El sistema no admite una solución fiable.',
      }
      factor[i * size + j] = i === j ? Math.sqrt(value) : value / factor[j * size + j]!
    }
  }
  const rcond = reciprocalCondition(factor, size, norm)
  if (!Number.isFinite(rcond) || rcond < CONDITION_LIMIT) return {
    ok: false, code: 'ILL_CONDITIONED', message: 'La estimación de condición del sistema equilibrado no permite una solución fiable.',
  }
  const y = triangularSolve(factor, rhs)
  const z = y.map((value, i) => value * scaling[i]!)
  let residual = 0
  for (let i = 0; i < size; i++) {
    let value = -rhs[i]!
    for (let j = 0; j < size; j++) value += matrix[i * size + j]! * y[j]!
    residual = Math.max(residual, Math.abs(value))
  }
  const denominator = norm * vectorNorm(y) + vectorNorm(rhs)
  const backwardError = denominator === 0 && residual === 0 ? 0 : residual / denominator
  if (!Number.isFinite(denominator) || !Number.isFinite(backwardError) || backwardError > BACKWARD_LIMIT ||
    !Number.isFinite(vectorNorm(z))) return failure('La solución no superó el control de residuo o representabilidad.')
  return { ok: true, z, scaling, backwardError, rcond }
}
