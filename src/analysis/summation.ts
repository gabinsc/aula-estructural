/** Suma compensada de Neumaier para combinar contribuciones de signos opuestos. */
export function compensatedSum(values: Iterable<number>): number {
  let sum = 0
  let correction = 0
  for (const value of values) {
    const next = sum + value
    correction += Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum
    sum = next
  }
  return sum + correction
}
