import { describe, it, expect } from 'vitest'
import { lerpAnchors, scrollToNarrative, timerLabel, narrativeSeconds, type ChapterAnchor } from './timeline'

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
    // piecewise clock: mid-chapter-4 — 0.12 + (0.18-0.12)*0.5 = 0.150
    expect(timerLabel(0.5)).toBe('t = 0.150s')
    expect(timerLabel(1)).toBe('t = 0.400s')
  })
})

describe('lerpAnchors', () => {
  const anchors: ChapterAnchor[] = [
    { id: 'a', u: 0, camOffset: [0, 0, 4], lookAhead: 0.02 },
    { id: 'b', u: 0.5, camOffset: [2, 1, 8], lookAhead: 0.04 },
    { id: 'c', u: 1, camOffset: [0, 4, 16], lookAhead: 0.08 },
  ]

  it('returns exact anchor values at anchor boundaries', () => {
    expect(lerpAnchors(0, anchors)).toEqual({ camOffset: [0, 0, 4], lookAhead: 0.02 })
    expect(lerpAnchors(0.5, anchors)).toEqual({ camOffset: [2, 1, 8], lookAhead: 0.04 })
    expect(lerpAnchors(1, anchors)).toEqual({ camOffset: [0, 4, 16], lookAhead: 0.08 })
  })

  it('interpolates linearly at segment midpoints', () => {
    const mid1 = lerpAnchors(0.25, anchors)
    expect(mid1.camOffset[0]).toBeCloseTo(1, 10)
    expect(mid1.camOffset[1]).toBeCloseTo(0.5, 10)
    expect(mid1.camOffset[2]).toBeCloseTo(6, 10)
    expect(mid1.lookAhead).toBeCloseTo(0.03, 10)
    const mid2 = lerpAnchors(0.75, anchors)
    expect(mid2.camOffset[0]).toBeCloseTo(1, 10)
    expect(mid2.camOffset[1]).toBeCloseTo(2.5, 10)
    expect(mid2.camOffset[2]).toBeCloseTo(12, 10)
    expect(mid2.lookAhead).toBeCloseTo(0.06, 10)
  })

  it('clamps outside 0..1 to the first/last anchor', () => {
    expect(lerpAnchors(-0.4, anchors)).toEqual({ camOffset: [0, 0, 4], lookAhead: 0.02 })
    expect(lerpAnchors(1.7, anchors)).toEqual({ camOffset: [0, 4, 16], lookAhead: 0.08 })
  })
})

describe('narrativeSeconds', () => {
  it('hits the spec timestamps at chapter boundaries', () => {
    expect(narrativeSeconds(0)).toBeCloseTo(0, 5)
    expect(narrativeSeconds(1 / 7)).toBeCloseTo(0.008, 5)
    expect(narrativeSeconds(2 / 7)).toBeCloseTo(0.05, 5)
    expect(narrativeSeconds(3 / 7)).toBeCloseTo(0.12, 5)
    expect(narrativeSeconds(4 / 7)).toBeCloseTo(0.18, 5)
    expect(narrativeSeconds(5 / 7)).toBeCloseTo(0.39, 5)
    expect(narrativeSeconds(6 / 7)).toBeCloseTo(0.3996, 5)
    expect(narrativeSeconds(1)).toBeCloseTo(0.4, 5)
  })
  it('is monotonic', () => {
    let prev = -1
    for (let i = 0; i <= 140; i++) {
      const v = narrativeSeconds(i / 140)
      expect(v).toBeGreaterThanOrEqual(prev); prev = v
    }
  })
})
