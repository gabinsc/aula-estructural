export function decimal(value: string) {
  const text = value.trim().replace(',', '.')
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : NaN
}

export function formatted(value: number) { return String(Number(value.toPrecision(7))) }
