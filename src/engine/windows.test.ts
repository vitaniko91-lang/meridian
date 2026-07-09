import { describe, it, expect } from 'vitest'
import { triangleWindow } from './windows'

// triangleWindow is the pure-numeric mirror of the TSL `routeWindow`; testing
// it pins the window formula both effects (prism, gate) rely on.
describe('triangleWindow', () => {
  const at = 0.5
  const half = 0.04

  it('peaks at 1 exactly at `at`', () => {
    expect(triangleWindow(at, at, half)).toBe(1)
  })

  it('is 0 at both edges `at ± half`', () => {
    expect(triangleWindow(at - half, at, half)).toBeCloseTo(0, 12)
    expect(triangleWindow(at + half, at, half)).toBeCloseTo(0, 12)
  })

  it('falls linearly to 0.5 at the half-way point', () => {
    expect(triangleWindow(at + half / 2, at, half)).toBeCloseTo(0.5, 12)
    expect(triangleWindow(at - half / 2, at, half)).toBeCloseTo(0.5, 12)
  })

  it('clamps to 0 beyond the edges (never negative)', () => {
    expect(triangleWindow(at + half * 2, at, half)).toBe(0)
    expect(triangleWindow(at - half * 5, at, half)).toBe(0)
    expect(triangleWindow(0, at, half)).toBe(0)
    expect(triangleWindow(1, at, half)).toBe(0)
  })

  it('is symmetric around `at`', () => {
    for (const d of [0.01, 0.02, 0.03]) {
      expect(triangleWindow(at + d, at, half)).toBeCloseTo(triangleWindow(at - d, at, half), 12)
    }
  })
})
