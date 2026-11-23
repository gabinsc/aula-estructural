import { expect, it } from 'vitest'
import { formatResult } from './format'

it('elimina residuos escalados sin ocultar una acción pequeña significativa', () => {
  expect(formatResult(-1.818989e-10, { scale: .001, reference: 20000 })).toBe('0')
  expect(formatResult(-9.094947e-11, { scale: .001, reference: 10000 })).toBe('0')
  expect(formatResult(-0)).toBe('0')
  expect(formatResult(1e-6, { scale: .001, reference: 10000 })).toBe('1.00e-9')
  expect(formatResult(1.234567, { decimals: 4 })).toBe('1.2346')
  expect(formatResult(1.234567, { exact: true })).toBe('1.234567')
})
