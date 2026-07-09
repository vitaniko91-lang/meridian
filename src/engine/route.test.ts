import { describe, it, expect } from 'vitest'
import { CHAPTER_ANCHORS, CHAPTER_ANCHORS_PORTRAIT, CHAPTER_U, createRoute, ROUTE_SAMPLES } from './route'
import { PRISM_AT } from './prism'

describe('CHAPTER_U', () => {
  it('maps chapter index to equal sevenths of route progress', () => {
    expect(CHAPTER_U(0)).toBe(0)
    expect(CHAPTER_U(7)).toBe(1)
    expect(CHAPTER_U(5)).toBeCloseTo(5 / 7, 10)
  })
})

describe('CHAPTER_ANCHORS', () => {
  it('has 8 anchors: hero start + 7 chapters', () => {
    expect(CHAPTER_ANCHORS).toHaveLength(8)
  })

  it('u is strictly increasing 0→1 on equal scroll segments (u = i/7)', () => {
    expect(CHAPTER_ANCHORS[0].u).toBe(0)
    expect(CHAPTER_ANCHORS[CHAPTER_ANCHORS.length - 1].u).toBe(1)
    CHAPTER_ANCHORS.forEach((a, i) => expect(a.u).toBeCloseTo(CHAPTER_U(i), 10))
    for (let i = 1; i < CHAPTER_ANCHORS.length; i++) {
      expect(CHAPTER_ANCHORS[i].u).toBeGreaterThan(CHAPTER_ANCHORS[i - 1].u)
    }
  })

  it('PRISM_AT falls inside chapter 5 (The Prism) u range [4/7, 5/7]', () => {
    expect(PRISM_AT).toBeGreaterThan(CHAPTER_U(4))
    expect(PRISM_AT).toBeLessThan(CHAPTER_U(5))
  })

  it('camOffset arrays are finite length-3; lookAhead in a sane range', () => {
    for (const a of CHAPTER_ANCHORS) {
      expect(a.camOffset).toHaveLength(3)
      for (const v of a.camOffset) expect(Number.isFinite(v)).toBe(true)
      expect(a.lookAhead).toBeGreaterThan(0)
      expect(a.lookAhead).toBeLessThanOrEqual(0.2)
    }
  })

  it('every anchor has a non-empty id', () => {
    for (const a of CHAPTER_ANCHORS) expect(a.id.length).toBeGreaterThan(0)
    expect(new Set(CHAPTER_ANCHORS.map((a) => a.id)).size).toBe(CHAPTER_ANCHORS.length)
  })
})

describe('CHAPTER_ANCHORS_PORTRAIT', () => {
  it('mirrors the landscape anchor ids/us and swaps the hero framing', () => {
    expect(CHAPTER_ANCHORS_PORTRAIT).toHaveLength(CHAPTER_ANCHORS.length)
    CHAPTER_ANCHORS_PORTRAIT.forEach((a, i) => {
      expect(a.id).toBe(CHAPTER_ANCHORS[i].id)
      expect(a.u).toBe(CHAPTER_ANCHORS[i].u)
      expect(a.camOffset).toHaveLength(3)
      for (const v of a.camOffset) expect(Number.isFinite(v)).toBe(true)
    })
    expect(CHAPTER_ANCHORS_PORTRAIT[0].camOffset).not.toEqual(CHAPTER_ANCHORS[0].camOffset)
  })
})

describe('createRoute', () => {
  it('samples ROUTE_SAMPLES equally-spaced finite points', () => {
    const { points } = createRoute()
    expect(points).toHaveLength(ROUTE_SAMPLES)
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(p.z)).toBe(true)
    }
  })

  it('route runs left→right (x strictly increasing at anchor samples)', () => {
    const { curve } = createRoute()
    let prevX = -Infinity
    for (let i = 0; i <= 7; i++) {
      const x = curve.getPointAt(CHAPTER_U(i)).x
      expect(x).toBeGreaterThan(prevX)
      prevX = x
    }
  })
})
