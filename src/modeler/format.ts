export function formatNumber(value: number, digits = 3): string {
  if (value !== 0 && (Math.abs(value) < 10 ** -digits || Math.abs(value) >= 1e6)) {
    return value.toExponential(digits).replace('.', ',')
  }
  return new Intl.NumberFormat('es', {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(Object.is(value, -0) ? 0 : value)
}

/** Presentation only. The reference is in the same physical unit as value. */
export function formatResult(value: number | undefined, options: {
  readonly scale?: number; readonly decimals?: number; readonly reference?: number; readonly exact?: boolean
} = {}): string {
  if (value === undefined) return '—'
  const scale = options.scale ?? 1
  const shown = value * scale
  if (!Number.isFinite(shown)) return 'Fuera de rango'
  if (options.exact) return String(shown)
  const decimals = Math.min(4, Math.max(0, Math.trunc(options.decimals ?? 2)))
  const noise = 64 * Number.EPSILON * Math.abs(options.reference ?? 0)
  if (value === 0 || Math.abs(value) <= noise) return '0'
  if (Math.abs(shown) < .5 * 10 ** -decimals) return shown.toExponential(Math.min(decimals, 2))
  return String(Number(shown.toFixed(decimals)))
}

export function formatCalculation(value: number | undefined, scale = 1): string {
  if (value === undefined) return '—'
  const shown = value * scale
  return Number.isFinite(shown) ? String(Number(shown.toPrecision(7))) : 'Fuera de rango'
}

export function parseNumber(value: string): number | null {
  const input = value.trim().replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input)) return null
  const result = Number(input)
  return Number.isFinite(result) ? result : null
}
