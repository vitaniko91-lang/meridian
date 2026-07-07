import { describe, expect, it } from 'vitest'
import { parseOverrides } from './overrides'

describe('parseOverrides', () => {
  it('returns defaults when no params are present', () => {
    expect(parseOverrides('')).toEqual({
      count: undefined,
      dpr: undefined,
      forceWebGL: false,
      scale: 1,
      alpha: 1,
    })
  })

  it('parses count (floored to integer) and dpr', () => {
    const o = parseOverrides('?count=300000.9&dpr=1.5')
    expect(o.count).toBe(300000)
    expect(o.dpr).toBe(1.5)
  })

  it('treats bare ?webgl as forceWebGL, off by default', () => {
    expect(parseOverrides('?webgl').forceWebGL).toBe(true)
    expect(parseOverrides('?count=1000').forceWebGL).toBe(false)
  })

  it('ignores garbage input (NaN / non-positive)', () => {
    const o = parseOverrides('?count=abc&dpr=-2&scale=NaN&alpha=0')
    expect(o.count).toBeUndefined()
    expect(o.dpr).toBeUndefined()
    expect(o.scale).toBe(1)
    expect(o.alpha).toBe(1)
  })

  it('parses scale and alpha multipliers', () => {
    const o = parseOverrides('?scale=0.5&alpha=0.4')
    expect(o.scale).toBe(0.5)
    expect(o.alpha).toBe(0.4)
  })
})
