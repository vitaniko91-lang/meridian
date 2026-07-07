import { describe, it, expect } from 'vitest'
import { scrollToNarrative, timerLabel } from './timeline'

describe('scrollToNarrative', () => {
  it('clamps and eases the ends', () => {
    expect(scrollToNarrative(-0.2)).toBe(0)
    expect(scrollToNarrative(1.7)).toBe(1)
    expect(scrollToNarrative(0)).toBe(0)
    expect(scrollToNarrative(1)).toBe(1)
  })
  it('is monotonic', () => {
    let prev = -1
    for (let i = 0; i <= 100; i++) {
      const v = scrollToNarrative(i / 100)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('timerLabel', () => {
  it('maps narrative time to the 0.400s clock', () => {
    expect(timerLabel(0)).toBe('t = 0.000s')
    expect(timerLabel(0.5)).toBe('t = 0.200s')
    expect(timerLabel(1)).toBe('t = 0.400s')
  })
})
