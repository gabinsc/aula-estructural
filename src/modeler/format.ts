export function formatNumber(value: number, digits = 3): string {
  if (value !== 0 && (Math.abs(value) < 10 ** -digits || Math.abs(value) >= 1e6)) {
    return value.toExponential(digits).replace('.', ',')
  }
  return new Intl.NumberFormat('es', {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(Object.is(value, -0) ? 0 : value)
}

export function parseNumber(value: string): number | null {
  const input = value.trim().replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input)) return null
  const result = Number(input)
  return Number.isFinite(result) ? result : null
}
